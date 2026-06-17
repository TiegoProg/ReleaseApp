import { randomUUID } from "crypto";
import { getServerSupabase } from "./supabase";

// ============================================================================
// Avatar + Character Sheet — el "identity-lock" del pipeline UGC.
// El AVATAR HÉROE (retrato 9:16) es el ancla maestra de identidad. La CHARACTER
// SHEET (multi-vista + detalles) se deriva del héroe con input_fidelity=high
// para mantener el MISMO rostro. Todo lo demás del pipeline (Seedance) usa el
// avatar héroe como primer frame.
// Si no hay OPENAI_API_KEY, devuelve placeholders visibles (la UI sigue viva).
// ============================================================================

const IMAGE_BUCKET = "orbita-images";

export interface AvatarAssets {
  avatarUrl: string; // retrato héroe 9:16 (ancla de identidad)
  sheetUrl: string; // character sheet (vistas + detalles)
  sourceUrl?: string; // foto de referencia entregada (si hubo)
  identity: string; // descriptor textual de la persona
  mode: string; // motor usado / stub
}

// Sube un b64 a Supabase Storage; si no hay storage, usa data-URL.
// Exportado: el compositor de keyframes (lib/keyframe.ts) reutiliza el MISMO
// almacenamiento que avatars/sheets — una sola fuente de verdad de Storage.
export async function storeImage(b64: string, folder: string): Promise<string | null> {
  const sb = getServerSupabase();
  if (!sb) return null;
  try {
    const buffer = Buffer.from(b64, "base64");
    const path = `${folder}/${randomUUID()}.png`;
    const { error } = await sb.storage
      .from(IMAGE_BUCKET)
      .upload(path, buffer, { contentType: "image/png", upsert: true });
    if (error) return null;
    return sb.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

function placeholder(text: string, w: number, h: number, color = "f472b6"): string {
  const t = encodeURIComponent(text.slice(0, 48));
  return `https://placehold.co/${w}x${h}/0b1220/${color}?text=${t}`;
}

// Receta estructurada de avatar UGC (sujeto + look + setting + cámara).
function buildAvatarPrompt(brief: string, opts: { product?: string }): string {
  const parts = [
    brief.trim(),
    "",
    "Generate a HYPER-REALISTIC UGC creator avatar — a real-looking person, NOT a stock model:",
    "- Vertical 9:16 selfie/portrait framing, shot on an iPhone front camera: natural HDR, slight exposure shifts, real skin texture (pores, subtle imperfections), authentic 'creator' energy.",
    "- Warm natural indoor lighting, casual everyday wardrobe, relaxed authentic expression looking at the camera.",
    "- Photoreal, sharp focus on the face, shallow depth of field, believable—never plastic or over-retouched.",
  ];
  if (opts.product) {
    parts.push(
      `- The person is naturally holding / using the product: ${opts.product}. Keep the product faithful and recognizable.`
    );
  }
  parts.push(
    "- Avoid: distorted hands/faces, extra fingers, watermarks, text overlays, uncanny plastic skin."
  );
  return parts.join("\n");
}

// Prompt de character sheet (deriva del héroe → misma identidad).
function buildSheetPrompt(): string {
  return [
    "Create a professional CHARACTER REFERENCE SHEET of the SAME person shown in the provided image — keep the face, hair, skin tone and features IDENTICAL.",
    "Layout on a clean light background:",
    "- Top row: four full-body views of the person in the same casual outfit — FRONT VIEW, SIDE VIEW, BACK VIEW, THREE-QUARTER VIEW, evenly spaced.",
    "- A detail panel with labeled close-up crops: EYE DETAIL, BROW & UPPER FACE, LIP SHAPE & LOWER FACE, SKIN TEXTURE (freckles/pores), HAIR TEXTURE, and HANDS/NAILS.",
    "Consistent identity across every view. Photorealistic, neutral studio lighting, no text other than the small panel labels.",
  ].join("\n");
}

// Descriptor textual de identidad (para reusar al regenerar / pasar a Seedance).
function buildIdentity(brief: string, product?: string): string {
  const base = brief.trim().replace(/\s+/g, " ").slice(0, 220);
  return product ? `${base} · producto: ${product}` : base;
}

const OPENAI_GEN = "https://api.openai.com/v1/images/generations";
const OPENAI_EDIT = "https://api.openai.com/v1/images/edits";

// Llama a /generations (sin referencia).
async function genImage(
  prompt: string,
  size: string,
  model: string,
  apiKey: string
): Promise<string | null> {
  const res = await fetch(OPENAI_GEN, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, prompt, size, n: 1 }),
  });
  if (!res.ok) throw new Error(`OpenAI gen ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data?.data?.[0]?.b64_json ?? null;
}

// input_fidelity solo existe en gpt-image-1 (no en 1.5 / 2). En esos casos la
// fidelidad de rostro se logra solo con la imagen de referencia.
function supportsFidelity(model: string): boolean {
  return model === "gpt-image-1";
}

// Llama a /edits con UNA O VARIAS imágenes de referencia (preserva la identidad
// del rostro). El endpoint /v1/images/edits de OpenAI acepta varias imágenes
// como `image[]` en el form (gpt-image-1): la PRIMERA es el ancla maestra; las
// siguientes enriquecen la composición (p.ej. avatar héroe + character sheet).
//
// Descarga defensiva: si una referencia secundaria no se puede bajar, se omite
// y se sigue con las demás. Solo la primera (el ancla) es obligatoria.
export async function editImage(
  refUrls: string[],
  prompt: string,
  size: string,
  model: string,
  apiKey: string
): Promise<string | null> {
  const urls = refUrls.filter(Boolean);
  if (!urls.length) throw new Error("editImage necesita al menos una referencia.");

  const blobs: Blob[] = [];
  for (let i = 0; i < urls.length; i++) {
    const imgRes = await fetch(urls[i]);
    if (!imgRes.ok) {
      if (i === 0) throw new Error(`No se pudo descargar la referencia (${imgRes.status}).`);
      continue; // referencias secundarias son opcionales
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const contentType = imgRes.headers.get("content-type") || "image/png";
    blobs.push(new Blob([buf], { type: contentType }));
  }

  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("size", size);
  form.append("n", "1");
  if (supportsFidelity(model)) form.append("input_fidelity", "high"); // solo gpt-image-1
  // `image[]` para multi-referencia; `image` (compat) cuando solo hay una.
  const field = blobs.length > 1 ? "image[]" : "image";
  blobs.forEach((blob, idx) => form.append(field, blob, `reference-${idx}.png`));

  const res = await fetch(OPENAI_EDIT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`OpenAI edit ${res.status}: ${(await res.text()).slice(0, 220)}`);
  const data = await res.json();
  return data?.data?.[0]?.b64_json ?? null;
}

/**
 * Genera el avatar héroe (9:16) y su character sheet. Si hay foto de referencia
 * (sourceImageUrl), el héroe se crea con /edits + input_fidelity=high para
 * mantener fiel a la persona real. La sheet siempre se deriva del héroe.
 */
export async function generateAvatarAssets(input: {
  brief: string;
  sourceImageUrl?: string;
  productImageUrl?: string;
  product?: string;
}): Promise<AvatarAssets> {
  const brief = input.brief?.trim() || "A relatable UGC creator in their twenties";
  const identity = buildIdentity(brief, input.product);
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

  // Sin key → placeholders (la UI sigue funcionando para ver el flujo).
  if (!apiKey) {
    return {
      avatarUrl: placeholder("AVATAR " + brief, 1024, 1536),
      sheetUrl: placeholder("CHARACTER SHEET", 1536, 1024, "a78bfa"),
      sourceUrl: input.sourceImageUrl,
      identity,
      mode: "stub",
    };
  }

  let mode = model;
  let avatarUrl = placeholder("AVATAR " + brief, 1024, 1536);
  let sheetUrl = placeholder("CHARACTER SHEET", 1536, 1024, "a78bfa");

  try {
    // 1) Avatar héroe (9:16)
    const avatarPrompt = buildAvatarPrompt(brief, { product: input.product });
    let heroB64: string | null = null;
    if (input.sourceImageUrl) {
      try {
        heroB64 = await editImage([input.sourceImageUrl], avatarPrompt, "1024x1536", model, apiKey);
        mode = `${model}+ref`;
      } catch {
        heroB64 = null; // cae a generación normal
      }
    }
    if (!heroB64) heroB64 = await genImage(avatarPrompt, "1024x1536", model, apiKey);
    if (heroB64) {
      avatarUrl = (await storeImage(heroB64, "avatars")) ?? `data:image/png;base64,${heroB64}`;
    }

    // 2) Character sheet derivada del héroe (misma identidad). La sheet es
    // secundaria: si /edits falla, caemos a generación por prompt antes del placeholder.
    if (heroB64) {
      let sheetB64: string | null = null;
      const heroRef = avatarUrl.startsWith("http") ? avatarUrl : input.sourceImageUrl;
      if (heroRef) {
        try {
          sheetB64 = await editImage([heroRef], buildSheetPrompt(), "1536x1024", model, apiKey);
        } catch (e: any) {
          console.error("[avatar] sheet /edits falló, fallback a prompt:", e?.message);
        }
      }
      if (!sheetB64) {
        try {
          sheetB64 = await genImage(
            `${buildAvatarPrompt(brief, { product: input.product })}\n\n${buildSheetPrompt()}`,
            "1536x1024",
            model,
            apiKey
          );
        } catch (e: any) {
          console.error("[avatar] sheet /generations falló:", e?.message);
        }
      }
      if (sheetB64)
        sheetUrl = (await storeImage(sheetB64, "sheets")) ?? `data:image/png;base64,${sheetB64}`;
    }
  } catch (err) {
    mode = "stub-fallback";
  }

  return { avatarUrl, sheetUrl, sourceUrl: input.sourceImageUrl, identity, mode };
}
