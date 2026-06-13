import { randomUUID } from "crypto";
import { getServerSupabase } from "./supabase";
import { getPersona, addPersonaVideo, type Persona } from "./personas";
import { generateVoice } from "./voice";
import { generateScene } from "./scene";
import { startVideo, pollVideo, estimateCostUsd } from "./seedance";
import {
  buildLockBlock,
  enhanceUgcPrompt,
  resolveCameraPreset,
  type ConsistencyLock,
} from "./ugcPrompt";

// ============================================================================
// Motor de PRODUCCIONES — una producción es un ad completo de N shots con
// continuidad total (cara/voz/outfit/fondo/cámara), producido con el workflow
// del spec AI_UGC_SYSTEM.md:
//
//   1. Voz primero (Gemini TTS / ElevenLabs): los N audios se generan ANTES de
//      gastar un dólar en video. Si la voz falla, la producción ni arranca.
//   2. Escena compartida (@Image2): un solo frame de set para todos los shots.
//   3. Consistency lock estampado server-side en cada prompt.
//   4. Gate de gasto: el shot 1 renderiza primero; los demás solo se encolan
//      si el gate sale bien. Presupuesto duro por producción.
//   5. Estado persistente en Supabase Storage: sobrevive reinicios; cualquier
//      poller (script, UI, agente) puede avanzar el pipeline.
//
// Patrón de persistencia idéntico a personas.ts (índice JSON + caché memoria).
// ============================================================================

const BUCKET = "orbita-images";
const INDEX_PATH = "productions/index.json";

export type ShotStatus = "pending" | "rendering" | "ready" | "failed" | "skipped";
export type ProductionStatus = "rendering" | "ready" | "partial" | "failed";

export interface ProductionShot {
  name: string;
  /** Prompt visual del shot (sin locks — se estampan al lanzar). */
  prompt: string;
  /** Guion hablado (→ @Audio1 vía TTS). Vacío = shot mudo. */
  script: string;
  status: ShotStatus;
  /** Prompt final realmente enviado a Seedance (con locks + reglas ocultas). */
  finalPrompt?: string;
  audioUrl?: string;
  voiceMode?: string;
  requestId?: string;
  statusUrl?: string;
  responseUrl?: string;
  videoUrl?: string;
  costUsd?: number;
  error?: string;
  qa?: ShotQa;
}

export interface ShotQa {
  scores?: Record<string, number>; // ejes del scorecard del spec (1-10)
  decision?: "keep" | "edit-in-post" | "regenerate" | "change-concept";
  exactIssue?: string;
  promptPatch?: string;
  notes?: string;
  reviewedAt?: string;
}

export interface Production {
  id: string;
  personaId: string;
  personaName: string;
  title: string;
  status: ProductionStatus;
  shots: ProductionShot[];
  /** Frame de escena compartido (@Image2 de todos los shots). */
  sceneUrl?: string;
  /** Referencias de imagen extra (@Image3…), p.ej. packshot del producto. */
  extraImageUrls: string[];
  lock: ConsistencyLock;
  model?: string;
  seed?: number;
  /** true = shot 1 actúa de gate; el resto se encola solo si sale bien. */
  gate: boolean;
  budgetUsd: number;
  estimatedCostUsd: number;
  spentUsd: number;
  log: string[]; // bitácora legible de decisiones del motor
  createdAt: string;
  updatedAt: string;
}

const g = globalThis as unknown as {
  __orbitaProductions?: Map<string, Production>;
  __orbitaProductionsLoad?: Promise<void>;
};
if (!g.__orbitaProductions) g.__orbitaProductions = new Map();
const store = g.__orbitaProductions;

async function persist(): Promise<void> {
  const sb = getServerSupabase();
  if (!sb) return;
  try {
    const list = Array.from(store.values());
    const buf = Buffer.from(JSON.stringify(list), "utf8");
    await sb.storage
      .from(BUCKET)
      .upload(INDEX_PATH, buf, { contentType: "application/json", upsert: true });
  } catch {
    /* si Storage falla, el estado sigue en memoria */
  }
}

function ensureLoaded(): Promise<void> {
  if (g.__orbitaProductionsLoad) return g.__orbitaProductionsLoad;
  g.__orbitaProductionsLoad = (async () => {
    const sb = getServerSupabase();
    if (!sb) return;
    try {
      const { data, error } = await sb.storage.from(BUCKET).download(INDEX_PATH);
      if (!error && data) {
        const list: Production[] = JSON.parse(await data.text());
        for (const p of list) if (!store.has(p.id)) store.set(p.id, p);
      }
    } catch {
      /* primer arranque → índice inexistente */
    }
  })();
  return g.__orbitaProductionsLoad;
}

function logLine(p: Production, msg: string) {
  p.log.push(`${new Date().toISOString().slice(11, 19)} ${msg}`);
  p.updatedAt = new Date().toISOString();
}

function perClipCost(model?: string): number {
  const selected = model || process.env.SEEDANCE_MODEL || "bytedance/seedance-2.0/reference-to-video";
  const tier = selected.includes("/fast/") ? "fal-fast" : "fal-pro";
  const resolution = process.env.SEEDANCE_RESOLUTION || "720p";
  const duration = Number(process.env.SEEDANCE_DURATION || "8") || 8;
  return estimateCostUsd(tier, resolution, duration, false);
}

// ----------------------------------------------------------------------------
// Render plan (dry run) — lo que el spec exige mostrar ANTES de gastar.
// ----------------------------------------------------------------------------

export interface RenderPlan {
  title: string;
  persona: string;
  shots: { name: string; script: string }[];
  model: string;
  perClipUsd: number;
  estimatedCostUsd: number;
  budgetUsd: number;
  withinBudget: boolean;
  gate: boolean;
  willGenerateScene: boolean;
  approvalNeeded: true;
}

export interface CreateProductionInput {
  personaId: string;
  title: string;
  shots: { name?: string; prompt: string; script?: string }[];
  /** Prompt del set compartido (se genera 1 vez) — o sceneUrl ya existente. */
  scenePrompt?: string;
  sceneUrl?: string;
  /** Refs de imagen extra (@Image3…), p.ej. packshot real del producto. */
  extraImageUrls?: string[];
  lock?: ConsistencyLock;
  model?: string;
  seed?: number;
  gate?: boolean;
  budgetUsd?: number;
}

const DEFAULT_BUDGET = Number(process.env.UGC_DEFAULT_BUDGET_USD || 10);

export function planProduction(input: CreateProductionInput, persona: Persona): RenderPlan {
  const perClip = perClipCost(input.model);
  const estimated = Math.round(perClip * input.shots.length * 100) / 100;
  const budget = input.budgetUsd ?? DEFAULT_BUDGET;
  return {
    title: input.title,
    persona: persona.name,
    shots: input.shots.map((s, i) => ({ name: s.name ?? `Shot ${i + 1}`, script: s.script ?? "" })),
    model: input.model || process.env.SEEDANCE_MODEL || "bytedance/seedance-2.0/reference-to-video",
    perClipUsd: perClip,
    estimatedCostUsd: estimated,
    budgetUsd: budget,
    withinBudget: estimated <= budget,
    gate: input.gate ?? true,
    willGenerateScene: Boolean(input.scenePrompt && !input.sceneUrl),
    approvalNeeded: true,
  };
}

// ----------------------------------------------------------------------------
// Creación + arranque (solo con aprobación explícita del caller).
// ----------------------------------------------------------------------------

export async function createProduction(
  input: CreateProductionInput
): Promise<{ production?: Production; error?: string }> {
  await ensureLoaded();
  const persona = await getPersona(input.personaId);
  if (!persona) return { error: "Persona no encontrada." };
  if (!input.shots.length) return { error: "La producción necesita al menos 1 shot." };

  const plan = planProduction(input, persona);
  if (!plan.withinBudget) {
    return {
      error: `Presupuesto insuficiente: ${input.shots.length} shots ≈ $${plan.estimatedCostUsd} > cap $${plan.budgetUsd}. Sube budgetUsd o reduce shots.`,
    };
  }

  const now = new Date().toISOString();
  const production: Production = {
    id: randomUUID(),
    personaId: persona.id,
    personaName: persona.name,
    title: input.title,
    status: "rendering",
    shots: input.shots.map((s, i) => ({
      name: s.name ?? `Shot ${i + 1}`,
      prompt: s.prompt,
      script: (s.script ?? "").trim(),
      status: "pending",
    })),
    sceneUrl: input.sceneUrl,
    extraImageUrls: input.extraImageUrls ?? [],
    // lock.camera acepta una key de CAMERA_PRESETS (p.ej. "selfie-handheld").
    lock: { ...(input.lock ?? {}), camera: resolveCameraPreset(input.lock?.camera) },
    model: input.model,
    seed: input.seed,
    gate: input.gate ?? true,
    budgetUsd: plan.budgetUsd,
    estimatedCostUsd: plan.estimatedCostUsd,
    spentUsd: 0,
    log: [],
    createdAt: now,
    updatedAt: now,
  };

  // 1) Escena compartida (@Image2) — UNA sola vez para toda la secuencia.
  if (!production.sceneUrl && input.scenePrompt) {
    const scene = await generateScene(input.scenePrompt, "9:16");
    if (scene.url) {
      production.sceneUrl = scene.url;
      logLine(production, `escena compartida lista (${scene.mode})`);
    } else {
      logLine(production, `⚠️ escena falló (${scene.error ?? "?"}) — sigo sin @Image2`);
    }
  }

  // 2) VOZ PRIMERO (gratis vs video): los N audios antes de gastar en Seedance.
  //    La voz es la fuente de verdad de consistencia — si falla, no quemamos plata.
  const paidRender = Boolean(process.env.FAL_KEY);
  for (const shot of production.shots) {
    if (!shot.script) continue;
    const voice = await generateVoice({
      text: shot.script,
      voiceName: persona.voiceName,
      language: persona.language,
      elevenVoiceId: persona.elevenVoiceId,
    });
    shot.voiceMode = voice.mode;
    shot.audioUrl = voice.audioUrl;
    if (!voice.audioUrl && paidRender) {
      return {
        error: `La voz del shot "${shot.name}" falló (${voice.mode}). No lanzo renders pagos sin voice lock — revisa GEMINI_API_KEY/ELEVENLABS_API_KEY o storage.`,
      };
    }
  }
  logLine(production, `voz lista para ${production.shots.filter((s) => s.audioUrl).length}/${production.shots.length} shots`);

  // 3) Lanza según estrategia: gate (shot 1) o todos en paralelo.
  const toLaunch = production.gate ? [0] : production.shots.map((_, i) => i);
  for (const i of toLaunch) {
    const err = await launchShot(production, persona, i);
    if (err) {
      production.status = "failed";
      logLine(production, `❌ no se pudo encolar "${production.shots[i].name}": ${err}`);
      store.set(production.id, production);
      await persist();
      return { production };
    }
  }
  if (production.gate && production.shots.length > 1) {
    logLine(production, `gate activo: shots 2..${production.shots.length} esperan el OK del shot 1`);
  }

  store.set(production.id, production);
  await persist();
  return { production };
}

// Estampa locks + reglas ocultas y encola el shot en Seedance.
async function launchShot(p: Production, persona: Persona, index: number): Promise<string | null> {
  const shot = p.shots[index];

  // Guard de presupuesto ANTES de encolar (gasto comprometido + este clip).
  const clipCost = perClipCost(p.model);
  if (p.spentUsd + clipCost > p.budgetUsd + 0.001) {
    shot.status = "skipped";
    shot.error = `Saltado por presupuesto: gastado $${p.spentUsd.toFixed(2)} + clip $${clipCost} > cap $${p.budgetUsd}.`;
    logLine(p, `⛔ ${shot.name}: ${shot.error}`);
    return null; // no es error fatal: el shot queda skipped
  }

  const hasScene = Boolean(p.sceneUrl);
  const hasAudio = Boolean(shot.audioUrl);

  let prompt = shot.prompt.trim();
  // Lip-sync garantizado aunque el prompt del shot no lo mencione.
  if (hasAudio && !/@Audio1/i.test(prompt)) prompt += " Lip-sync the speech precisely to @Audio1.";
  else if (!hasAudio && shot.script && !/\bsays?\b/i.test(prompt)) {
    prompt += ` The creator says: "${shot.script}".`;
  }
  prompt += buildLockBlock(p.lock, {
    shotIndex: index,
    totalShots: p.shots.length,
    hasScene,
    hasAudio,
  });
  prompt = enhanceUgcPrompt(prompt);
  shot.finalPrompt = prompt;

  // @Image1 = avatar · @Image2 = escena compartida · @Image3.. = refs extra.
  const images = [persona.avatarUrl, ...(p.sceneUrl ? [p.sceneUrl] : []), ...p.extraImageUrls];
  const audios = shot.audioUrl ? [shot.audioUrl] : [];

  const job = await startVideo({
    imageUrls: images,
    audioUrls: audios,
    prompt,
    model: p.model,
    seed: p.seed,
  });

  shot.costUsd = job.costUsd;
  if (job.status === "failed") {
    shot.status = "failed";
    shot.error = job.error;
    return job.error ?? "fal falló al encolar";
  }
  if (job.status === "stub") {
    shot.status = "ready";
    shot.videoUrl = job.videoUrl;
    logLine(p, `${shot.name}: stub (sin FAL_KEY) — $0`);
    return null;
  }
  shot.status = "rendering";
  shot.requestId = job.requestId;
  shot.statusUrl = job.statusUrl;
  shot.responseUrl = job.responseUrl;
  p.spentUsd = Math.round((p.spentUsd + (job.costUsd ?? 0)) * 100) / 100;
  logLine(p, `▶ ${shot.name} encolado (≈ $${job.costUsd} · total comprometido $${p.spentUsd})`);
  return null;
}

// ----------------------------------------------------------------------------
// Avance del pipeline — idempotente; lo llama cualquier poller.
// ----------------------------------------------------------------------------

export async function advanceProduction(id: string): Promise<Production | undefined> {
  await ensureLoaded();
  const p = store.get(id);
  if (!p) return undefined;
  if (p.status === "ready" || p.status === "failed" || p.status === "partial") return p;

  const persona = await getPersona(p.personaId);
  let changed = false;

  // 1) Poll de los shots en render.
  for (const shot of p.shots) {
    if (shot.status !== "rendering" || !shot.requestId) continue;
    const job = await pollVideo(shot.requestId, {
      statusUrl: shot.statusUrl,
      responseUrl: shot.responseUrl,
    });
    if (job.status === "ready") {
      shot.status = "ready";
      shot.videoUrl = job.videoUrl;
      changed = true;
      logLine(p, `✅ ${shot.name} listo`);
      // Galería persistente de la persona (igual que el flujo manual).
      if (persona && job.videoUrl) {
        await addPersonaVideo(persona.id, {
          url: job.videoUrl,
          script: `${p.title} · ${shot.name}: ${shot.script}`,
          preset: "production",
          cost: shot.costUsd,
          model: p.model,
          createdAt: new Date().toISOString(),
        });
      }
    } else if (job.status === "failed") {
      shot.status = "failed";
      shot.error = job.error;
      changed = true;
      logLine(p, `❌ ${shot.name} falló: ${job.error ?? "?"}`);
    }
  }

  // 2) Lógica de gate: cuando el shot 1 está listo, encola el resto en paralelo.
  if (p.gate && persona) {
    const gateShot = p.shots[0];
    const pendings = p.shots.map((s, i) => ({ s, i })).filter(({ s }) => s.status === "pending");
    if (gateShot.status === "ready" && pendings.length) {
      logLine(p, `gate OK → encolo ${pendings.length} shots restantes en paralelo`);
      for (const { i } of pendings) await launchShot(p, persona, i);
      changed = true;
    } else if (gateShot.status === "failed" && pendings.length) {
      for (const { s } of pendings) {
        s.status = "skipped";
        s.error = "Saltado: el shot gate falló. Diagnostica y parchea el prompt antes de re-renderizar.";
      }
      changed = true;
      logLine(p, `⛔ gate falló → ${pendings.length} shots saltados (presupuesto protegido)`);
    }
  }

  // 3) Estado global.
  const st = p.shots.map((s) => s.status);
  const prev = p.status;
  if (st.some((s) => s === "rendering" || s === "pending")) p.status = "rendering";
  else if (st.every((s) => s === "ready")) p.status = "ready";
  else if (st.some((s) => s === "ready")) p.status = "partial";
  else p.status = "failed";
  if (p.status !== prev) {
    changed = true;
    logLine(p, `producción → ${p.status} (gastado ≈ $${p.spentUsd})`);
  }

  if (changed) {
    store.set(p.id, p);
    await persist();
  }
  return p;
}

// ----------------------------------------------------------------------------
// QA scorecard (spec §QA) — se adjunta al shot y persiste.
// ----------------------------------------------------------------------------

export async function recordShotQa(
  productionId: string,
  shotIndex: number,
  qa: ShotQa
): Promise<Production | undefined> {
  await ensureLoaded();
  const p = store.get(productionId);
  if (!p || !p.shots[shotIndex]) return undefined;
  p.shots[shotIndex].qa = { ...qa, reviewedAt: new Date().toISOString() };
  logLine(p, `QA ${p.shots[shotIndex].name}: ${qa.decision ?? "scored"}`);
  store.set(p.id, p);
  await persist();
  return p;
}

export async function getProduction(id: string): Promise<Production | undefined> {
  await ensureLoaded();
  return store.get(id);
}

export async function listProductions(): Promise<Production[]> {
  await ensureLoaded();
  return Array.from(store.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
