import { randomUUID } from "crypto";
import type { ToolDef } from "./context";
import { saveDeliverable } from "./board";
import { getServerSupabase } from "../supabase";

const IMAGE_BUCKET = "orbita-images";

// Sube la imagen (b64) a Supabase Storage y devuelve la URL pública.
// Si Storage no está disponible o falla, devuelve null (el caller usa data-URL).
async function storeImage(b64: string, campaignId: string): Promise<string | null> {
  const sb = getServerSupabase();
  if (!sb) return null;
  try {
    const buffer = Buffer.from(b64, "base64");
    const path = `${campaignId}/${randomUUID()}.png`;
    const { error } = await sb.storage
      .from(IMAGE_BUCKET)
      .upload(path, buffer, { contentType: "image/png", upsert: true });
    if (error) return null;
    return sb.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

// Mapea aspect ratio -> tamaño soportado por gpt-image-1 y dimensiones de placeholder.
function sizeFor(aspect?: string): { size: string; w: number; h: number } {
  switch (aspect) {
    case "16:9":
      return { size: "1536x1024", w: 1536, h: 1024 };
    case "9:16":
      return { size: "1024x1536", w: 1024, h: 1536 };
    default:
      return { size: "1024x1024", w: 1024, h: 1024 };
  }
}

function placeholder(prompt: string, w: number, h: number): string {
  const text = encodeURIComponent(prompt.slice(0, 60));
  return `https://placehold.co/${w}x${h}/0b1220/38bdf8?text=${text}`;
}

/**
 * generate_image — interfaz fija + STUB.
 * Si existe OPENAI_API_KEY, llama de verdad a OpenAI Images (gpt-image-1).
 * Si no, devuelve un placeholder visible. No hay que tocar nada más para activarlo.
 */
export const generateImage: ToolDef = {
  schema: {
    name: "generate_image",
    description:
      "Genera una imagen para un anuncio a partir de un prompt visual detallado. Devuelve una URL de imagen. Úsalo para producir el creativo visual de un concepto.",
    input_schema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Prompt visual detallado en inglés o español." },
        aspect_ratio: {
          type: "string",
          enum: ["1:1", "16:9", "9:16"],
          description: "Relación de aspecto deseada.",
        },
        title: { type: "string", description: "Título corto del creativo." },
      },
      required: ["prompt"],
    },
  },
  handler: async (input, ctx) => {
    const { prompt } = input as { prompt: string; aspect_ratio?: string; title?: string };
    const title = input.title || "Imagen de anuncio";
    const { size, w, h } = sizeFor(input.aspect_ratio);
    let url = placeholder(prompt, w, h);
    let mode = "stub";

    if (process.env.OPENAI_API_KEY) {
      try {
        // Modelo configurable: usa el último ("image 2.0") vía OPENAI_IMAGE_MODEL.
        const imageModel = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
        const res = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({ model: imageModel, prompt, size, n: 1 }),
          signal: ctx.signal,
        });
        if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
        const data = await res.json();
        const b64 = data?.data?.[0]?.b64_json;
        const realUrl = data?.data?.[0]?.url;
        if (b64) {
          // Sube a Storage (URL pequeña en la DB); fallback a data-URL si falla.
          url = (await storeImage(b64, ctx.campaignId)) ?? `data:image/png;base64,${b64}`;
        } else if (realUrl) {
          url = realUrl;
        }
        mode = imageModel;
      } catch (err: any) {
        mode = "stub-fallback";
        url = placeholder(prompt, w, h);
      }
    }

    await saveDeliverable(ctx, { type: "image", title, payload: { prompt, url, size, mode } });
    return `Imagen "${title}" generada (modo: ${mode}).`;
  },
};
