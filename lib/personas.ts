import { randomUUID } from "crypto";
import { getServerSupabase } from "./supabase";

// ============================================================================
// Roster de personas (avatares reutilizables) — PERSISTENTE en Supabase Storage.
// Se guarda un índice JSON (personas/index.json) en el bucket existente; así los
// avatares sobreviven reinicios del server y cambios de modelo. La Map en memoria
// (globalThis) actúa como caché; se hidrata 1 vez por proceso desde Storage.
// Si no hay Supabase, cae a memoria pura (no persiste, pero la UI sigue viva).
// ============================================================================

const BUCKET = "orbita-images";
const INDEX_PATH = "personas/index.json";

export interface PersonaVideo {
  url: string;
  script: string;
  preset?: string;
  cost?: number; // USD estimado del render
  model?: string; // tier usado (fal-pro / fal-fast / stub)
  createdAt: string;
}

export interface Persona {
  id: string;
  name: string;
  avatarUrl: string; // retrato héroe (ancla de identidad visual)
  sheetUrl: string; // character sheet
  sourceUrl?: string; // foto de referencia entregada
  identity: string; // descriptor textual
  voiceName: string; // voz pineada (Gemini TTS) — ancla de voz
  language: string; // idioma de la voz
  seed: number; // seed de movimiento (Seedance) — reproducibilidad
  product?: string; // producto asociado
  mode: string; // motor / stub
  videos: PersonaVideo[]; // clips UGC generados (persistidos)
  createdAt: string;
}

// Voces de Gemini TTS rotadas por defecto (determinista por persona).
const VOICES = ["Kore", "Puck", "Charon", "Aoede", "Leda", "Zephyr", "Enceladus", "Sulafat"];

const g = globalThis as unknown as {
  __orbitaPersonas?: Map<string, Persona>;
  __orbitaPersonasLoad?: Promise<void>;
};
if (!g.__orbitaPersonas) g.__orbitaPersonas = new Map();
const store = g.__orbitaPersonas;

// Vuelca el roster completo al índice JSON de Storage (upsert).
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
    /* si Storage falla, el roster sigue en memoria */
  }
}

// Hidrata la caché desde Storage una sola vez por proceso. Si en memoria había
// personas que aún no estaban en Storage (p.ej. recién creadas antes de migrar),
// las persiste para que sobrevivan un reinicio real.
function ensureLoaded(): Promise<void> {
  if (g.__orbitaPersonasLoad) return g.__orbitaPersonasLoad;
  g.__orbitaPersonasLoad = (async () => {
    const sb = getServerSupabase();
    if (!sb) return;
    const loadedIds = new Set<string>();
    try {
      const { data, error } = await sb.storage.from(BUCKET).download(INDEX_PATH);
      if (!error && data) {
        const list: Persona[] = JSON.parse(await data.text());
        for (const p of list) {
          loadedIds.add(p.id);
          if (!store.has(p.id)) store.set(p.id, p);
        }
      }
    } catch {
      /* índice inexistente en el primer arranque → roster vacío */
    }
    const hasUnsaved = Array.from(store.keys()).some((id) => !loadedIds.has(id));
    if (hasUnsaved) await persist();
  })();
  return g.__orbitaPersonasLoad;
}

export async function createPersona(input: {
  name?: string;
  avatarUrl: string;
  sheetUrl: string;
  sourceUrl?: string;
  identity: string;
  product?: string;
  mode: string;
  voiceName?: string;
  language?: string;
}): Promise<Persona> {
  await ensureLoaded();
  const id = randomUUID();
  const persona: Persona = {
    id,
    name: input.name?.trim() || personaName(input.identity),
    avatarUrl: input.avatarUrl,
    sheetUrl: input.sheetUrl,
    sourceUrl: input.sourceUrl,
    identity: input.identity,
    voiceName: input.voiceName || VOICES[store.size % VOICES.length],
    language: input.language || "es-ES",
    seed: Math.floor(Math.random() * 1_000_000),
    product: input.product,
    mode: input.mode,
    videos: [],
    createdAt: new Date().toISOString(),
  };
  store.set(id, persona);
  await persist();
  return persona;
}

// Adjunta un clip generado a la persona (galería persistente).
export async function addPersonaVideo(
  id: string,
  video: PersonaVideo
): Promise<Persona | undefined> {
  await ensureLoaded();
  const p = store.get(id);
  if (!p) return undefined;
  p.videos = [video, ...(p.videos ?? [])];
  store.set(id, p);
  await persist();
  return p;
}

export async function listPersonas(): Promise<Persona[]> {
  await ensureLoaded();
  return Array.from(store.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getPersona(id: string): Promise<Persona | undefined> {
  await ensureLoaded();
  return store.get(id);
}

function personaName(identity: string): string {
  const first = identity.split(/[,.·]/)[0]?.trim() || "Avatar";
  return first.length > 28 ? first.slice(0, 28) + "…" : first;
}
