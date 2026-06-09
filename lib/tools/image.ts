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

function placeholder(text: string, w: number, h: number): string {
  const t = encodeURIComponent(text.slice(0, 60));
  return `https://placehold.co/${w}x${h}/0b1220/38bdf8?text=${t}`;
}

/**
 * Convierte el prompt del creativo en un prompt de CALIDAD ANUNCIO: dirección de arte,
 * producto como héroe y, sobre todo, texto legible y con contraste (el dolor #1 de los
 * anuncios generados por IA).
 */
function enhanceAdPrompt(
  prompt: string,
  opts: { headline?: string; brand?: string; hasReference?: boolean }
): string {
  const parts: string[] = [
    prompt.trim(),
    "",
    "ART DIRECTION — produce a scroll-stopping, professional social-media advertising creative:",
    "- The product is the clear HERO: sharp focus, premium studio-quality lighting, realistic materials and shadows, clean and uncluttered composition using rule-of-thirds with generous negative space.",
    "- Photorealistic, high resolution, commercial photography look; lifestyle context that fits the target audience.",
  ];
  if (opts.hasReference) {
    parts.push(
      "- Keep the provided reference product (shape, label, colors, proportions) faithful and recognizable; do not redesign the packaging."
    );
  }
  if (opts.headline) {
    parts.push(
      `- Overlay this EXACT headline, spelled correctly: "${opts.headline}".`,
      "- TYPOGRAPHY (critical): bold modern sans-serif, very large and instantly legible, with STRONG contrast against whatever is behind it — place it over a clean area or add a subtle dark-to-transparent gradient scrim so it never blends into the background. Clear visual hierarchy, comfortable letter spacing, safe margins. Keep it short. Absolutely NO misspelled words, gibberish, lorem ipsum or random characters."
    );
  } else {
    parts.push(
      "- Reserve a clean, high-contrast zone where a short bold headline can be overlaid later. Do NOT invent random text."
    );
  }
  if (opts.brand) {
    parts.push(
      `- Brand: ${opts.brand}. On-brand and tasteful; if the brand name/label appears on the product, render it legibly and correctly.`
    );
  }
  parts.push(
    "- Avoid: clutter, watermarks, distorted hands or faces, low-contrast text, fake competitor logos, busy backgrounds that hurt text legibility."
  );
  return parts.join("\n");
}

// Llama a OpenAI Images con una imagen de referencia (endpoint /edits, multipart).
async function generateWithReference(
  refUrl: string,
  prompt: string,
  size: string,
  model: string,
  apiKey: string,
  signal: AbortSignal
): Promise<any> {
  const imgRes = await fetch(refUrl, { signal });
  if (!imgRes.ok) throw new Error(`No se pudo descargar la referencia (${imgRes.status}).`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const contentType = imgRes.headers.get("content-type") || "image/png";

  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("size", size);
  form.append("n", "1");
  form.append("image", new Blob([buf], { type: contentType }), "reference.png");

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal,
  });
  if (!res.ok) throw new Error(`OpenAI edits ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

/**
 * generate_image — calidad anuncio. Mejora el prompt, soporta headline/marca y una foto
 * de referencia del producto (genera con /edits para mantener el producto fiel).
 * Si no hay OPENAI_API_KEY, devuelve un placeholder visible.
 */
export const generateImage: ToolDef = {
  schema: {
    name: "generate_image",
    description:
      "Genera una imagen de CALIDAD ANUNCIO a partir de un prompt visual. Pasa un headline corto (el texto que irá en la imagen), la marca y, si existe, la URL de una foto de referencia del producto para que el anuncio sea fiel. El sistema refuerza la dirección de arte y la legibilidad del texto. Devuelve una URL de imagen.",
    input_schema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Prompt visual detallado (escena, composición, luz, contexto)." },
        headline: {
          type: "string",
          description: "Titular corto y potente que debe aparecer en la imagen (texto del anuncio).",
        },
        brand: { type: "string", description: "Marca / nombre del producto." },
        reference_image_url: {
          type: "string",
          description: "URL de una foto de referencia del producto (si el usuario la entregó).",
        },
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
    const rawPrompt = String(input.prompt ?? "");
    const headline = input.headline ? String(input.headline) : undefined;
    const brand = input.brand ? String(input.brand) : undefined;
    const referenceUrl = input.reference_image_url ? String(input.reference_image_url) : undefined;
    const title = input.title || headline || "Imagen de anuncio";
    const { size, w, h } = sizeFor(input.aspect_ratio);

    const prompt = enhanceAdPrompt(rawPrompt, { headline, brand, hasReference: !!referenceUrl });

    let url = placeholder(headline || rawPrompt, w, h);
    let mode = "stub";

    if (process.env.OPENAI_API_KEY) {
      const apiKey = process.env.OPENAI_API_KEY;
      const imageModel = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
      try {
        let data: any;
        if (referenceUrl) {
          try {
            data = await generateWithReference(referenceUrl, prompt, size, imageModel, apiKey, ctx.signal);
            mode = `${imageModel}+ref`;
          } catch {
            // Si la referencia falla (URL caída, etc.), cae a generación normal.
            data = null;
          }
        }
        if (!data) {
          const res = await fetch("https://api.openai.com/v1/images/generations", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ model: imageModel, prompt, size, n: 1 }),
            signal: ctx.signal,
          });
          if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
          data = await res.json();
          if (mode === "stub") mode = imageModel;
        }

        const b64 = data?.data?.[0]?.b64_json;
        const realUrl = data?.data?.[0]?.url;
        if (b64) {
          url = (await storeImage(b64, ctx.campaignId)) ?? `data:image/png;base64,${b64}`;
        } else if (realUrl) {
          url = realUrl;
        }
      } catch {
        mode = "stub-fallback";
        url = placeholder(headline || rawPrompt, w, h);
      }
    }

    await saveDeliverable(ctx, {
      type: "image",
      title,
      payload: { prompt, rawPrompt, headline, brand, referenceUsed: !!referenceUrl, url, size, mode },
    });
    return `Imagen "${title}" generada (modo: ${mode}${referenceUrl ? ", con foto de referencia" : ""}).`;
  },
};
