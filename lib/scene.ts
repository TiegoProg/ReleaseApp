import { randomUUID } from "crypto";
import { getServerSupabase } from "./supabase";

// ============================================================================
// Generación de escenarios/fondos (sin personas) con GPT Image — el frame de
// escena compartido (@Image2) es el ancla de continuidad de fondo entre shots.
// Extraído de app/api/scene para que el motor de producciones lo reutilice.
// ============================================================================

const BUCKET = "orbita-images";

export interface SceneResult {
  url?: string;
  mode: string;
  error?: string;
}

function sizeFor(aspect: string): string {
  if (aspect === "16:9") return "1536x1024";
  if (aspect === "1:1") return "1024x1024";
  return "1024x1536"; // 9:16
}

async function store(b64: string): Promise<string | null> {
  const sb = getServerSupabase();
  if (!sb) return null;
  try {
    const buffer = Buffer.from(b64, "base64");
    const path = `uploads/scene/${randomUUID()}.png`;
    const { error } = await sb.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: "image/png", upsert: true });
    if (error) return null;
    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

/** Genera una imagen de escenario y la persiste en Storage. Stub sin OPENAI_API_KEY. */
export async function generateScene(
  prompt: string,
  aspect: "9:16" | "16:9" | "1:1" = "9:16"
): Promise<SceneResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { url: `https://placehold.co/1024x1536/0b1220/38bdf8?text=SCENE`, mode: "stub" };
  }

  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, prompt, size: sizeFor(aspect), n: 1 }),
    });
    if (!res.ok) {
      return { mode: model, error: `OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}` };
    }
    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return { mode: model, error: "OpenAI no devolvió imagen." };
    const url = (await store(b64)) ?? `data:image/png;base64,${b64}`;
    return { url, mode: model };
  } catch (e: any) {
    return { mode: model, error: e?.message ?? "No se pudo generar el escenario." };
  }
}
