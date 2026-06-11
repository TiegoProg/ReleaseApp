// ============================================================================
// Seedance 2.0 (talking video) vía fal — REST directo (sin SDK extra).
// Provider abstraído: hoy "fal"; mañana se puede agregar "byteplus".
// Si falta FAL_KEY, devuelve un stub visible (la UI sigue mostrando el flujo).
//
// generate_audio: true SIEMPRE (si no, el output sale mudo). Pasamos además la
// voz pineada de Gemini como @Audio1 para el lip-sync. El mp4 final se descarga
// a Supabase (las URLs de fal son temporales).
// ============================================================================

import { randomUUID } from "crypto";
import { getServerSupabase } from "./supabase";

export interface VideoJob {
  status: "rendering" | "ready" | "failed" | "stub";
  videoUrl?: string;
  requestId?: string;
  mode: string;
  error?: string;
  costUsd?: number; // costo estimado del render (USD)
}

// Costo estimado por render (USD). NO son precios oficiales de fal — son tarifas
// configurables por env para mostrar un costo aproximado por video en la UI.
function estimateCostUsd(tier: string, resolution: string, durationSec: number): number {
  if (tier === "stub") return 0;
  const perSecPro = Number(process.env.SEEDANCE_COST_PRO_PER_SEC || 0.15);
  const perSecFast = Number(process.env.SEEDANCE_COST_FAST_PER_SEC || 0.09);
  const base = tier === "fal-pro" ? perSecPro : perSecFast;
  const resMult = resolution.includes("1080") ? 1.5 : 1;
  return Math.round(base * durationSec * resMult * 100) / 100;
}

const FAL_QUEUE = "https://queue.fal.run";

function model(): string {
  return process.env.SEEDANCE_MODEL || "bytedance/seedance-2.0/pro/reference-to-video";
}

// fal devuelve status_url / response_url al encolar; las guardamos por requestId
// (sobrevive HMR vía globalThis) para pollear exactamente esas URLs.
const g = globalThis as unknown as {
  __orbitaFalJobs?: Map<string, { statusUrl: string; responseUrl: string }>;
};
if (!g.__orbitaFalJobs) g.__orbitaFalJobs = new Map();
const falJobs = g.__orbitaFalJobs;

// Parseo defensivo: si el body viene vacío, no reventamos el poll.
async function safeJson(res: Response): Promise<any | null> {
  const txt = await res.text();
  if (!txt.trim()) return null;
  try {
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

function placeholderVideo(): string {
  // Clip de muestra (la UI renderiza <video>); en stub no llamamos a fal.
  return "https://placehold.co/720x1280/0b1220/f472b6.png?text=RENDER+UGC";
}

// Descarga el mp4 de fal (URL temporal) y lo sube a Supabase (URL permanente).
// Reutiliza el bucket público existente bajo videos/. Si no hay storage, null.
async function storeVideo(remoteUrl: string): Promise<string | null> {
  const sb = getServerSupabase();
  if (!sb) return null;
  try {
    // no-store: el mp4 (>2MB) no puede entrar al data-cache de Next.js y lo rompe.
    const r = await fetch(remoteUrl, { cache: "no-store" });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const path = `videos/${randomUUID()}.mp4`;
    const { error } = await sb.storage
      .from("orbita-images")
      .upload(path, buf, { contentType: "video/mp4", upsert: true });
    if (error) return null;
    return sb.storage.from("orbita-images").getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

/**
 * Lanza la generación de video en fal (cola async) y devuelve el request_id.
 * No bloquea: el estado real se consulta con pollVideo().
 *
 * Multi-referencia (Seedance 2.0): el prompt referencia los materiales por su
 * posición — image_urls[0] = @Image1, image_urls[1] = @Image2, video_urls[0] =
 * @Video1, audio_urls[0] = @Audio1, etc. El caller arma esos arrays en el MISMO
 * orden en que numeró los tags del prompt.
 */
export async function startVideo(input: {
  imageUrls: string[];
  videoUrls?: string[];
  audioUrls?: string[];
  prompt: string;
  model?: string; // override puntual del modelo (p.ej. forzar pro sin tocar el env)
}): Promise<VideoJob> {
  const key = process.env.FAL_KEY;
  if (!key) {
    return { status: "stub", videoUrl: placeholderVideo(), mode: "stub", costUsd: 0 };
  }

  const selectedModel = input.model || model();
  const tier = selectedModel.includes("/pro/") ? "fal-pro" : selectedModel.includes("/fast/") ? "fal-fast" : "fal";
  const resolution = process.env.SEEDANCE_RESOLUTION || "720p";
  const duration = process.env.SEEDANCE_DURATION || "8";
  const costUsd = estimateCostUsd(tier, resolution, Number(duration) || 8);

  const images = (input.imageUrls ?? []).filter(Boolean);
  const videos = (input.videoUrls ?? []).filter(Boolean);
  const audios = (input.audioUrls ?? []).filter(Boolean);

  const body: Record<string, any> = {
    prompt: input.prompt,
    image_urls: images,
    resolution,
    duration,
    aspect_ratio: "9:16",
    generate_audio: true, // el output DEBE traer pista de audio o sale mudo
  };
  // Materiales de referencia adicionales (Seedance 2.0).
  if (videos.length) body.video_urls = videos;
  // Voz pineada de Gemini + audios de referencia (@Audio1.. en el prompt).
  if (audios.length) body.audio_urls = audios;

  try {
    const res = await fetch(`${FAL_QUEUE}/${selectedModel}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Key ${key}` },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        status: "failed",
        mode: tier,
        error: `fal ${res.status}: ${(await res.text()).slice(0, 200)}`,
        costUsd,
      };
    }
    const data = await safeJson(res);
    const requestId = data?.request_id ?? data?.requestId;
    if (!requestId) return { status: "failed", mode: tier, error: "fal no devolvió request_id.", costUsd };
    // Guarda las URLs canónicas que fal entrega (más fiable que reconstruirlas).
    const statusUrl = data?.status_url ?? `${FAL_QUEUE}/${selectedModel}/requests/${requestId}/status`;
    const responseUrl = data?.response_url ?? `${FAL_QUEUE}/${selectedModel}/requests/${requestId}`;
    falJobs.set(requestId, { statusUrl, responseUrl });
    return { status: "rendering", requestId, mode: tier, costUsd };
  } catch (e: any) {
    return { status: "failed", mode: tier, error: e?.message ?? String(e), costUsd };
  }
}

/** Consulta el estado de un job de fal y, si terminó, devuelve la URL del video. */
export async function pollVideo(requestId: string): Promise<VideoJob> {
  const key = process.env.FAL_KEY;
  if (!key) return { status: "stub", videoUrl: placeholderVideo(), mode: "stub" };

  const urls = falJobs.get(requestId);
  const statusUrl = urls?.statusUrl ?? `${FAL_QUEUE}/${model()}/requests/${requestId}/status`;
  const responseUrl = urls?.responseUrl ?? `${FAL_QUEUE}/${model()}/requests/${requestId}`;

  try {
    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Key ${key}` },
      cache: "no-store",
    });
    const status = await safeJson(statusRes);
    const s = status?.status;
    // IN_QUEUE / IN_PROGRESS / null (aún sin body) -> seguimos renderizando.
    if (s !== "COMPLETED") {
      return { status: "rendering", requestId, mode: "fal" };
    }
    const resultRes = await fetch(responseUrl, {
      headers: { Authorization: `Key ${key}` },
      cache: "no-store",
    });
    const result = await safeJson(resultRes);
    const falUrl = result?.video?.url ?? result?.data?.video?.url ?? result?.videos?.[0]?.url;
    if (!falUrl) {
      return { status: "failed", requestId, mode: "fal", error: "Render listo pero sin URL de video." };
    }
    // Persistimos el mp4 (la URL de fal expira); si no hay storage, usamos la de fal.
    const permanentUrl = (await storeVideo(falUrl)) ?? falUrl;
    return { status: "ready", videoUrl: permanentUrl, requestId, mode: "fal" };
  } catch (e: any) {
    return { status: "failed", requestId, mode: "fal", error: e?.message ?? String(e) };
  }
}
