import { getPersona } from "./personas";
import { editImage, storeImage } from "./avatar";
import { NEGATIVE_INSTRUCTIONS } from "./ugcPrompt";

// ============================================================================
// Keyframe-first — etapa de COMPOSICIÓN de personaje-en-escena como imagen fija.
//
// Antes de animar con Seedance, componemos al personaje dentro de la escena como
// un STILL fotorrealista aprobable. GPT Image (gpt-image-1, input_fidelity=high)
// LEE el avatar héroe (ancla de identidad) + la character sheet (vistas/detalle
// de cara/piel/pelo) y produce un único frame integrado.
//
//   avatar + sheet  ──►  GPT Image (/edits multi-imagen)  ──►  KEYFRAME
//                                                              ↑ se aprueba
//
// REGLA DE ORO: el sheet es ORO aquí (referencia de identidad para la imagen) y
// VENENO en video (Seedance copiaría el collage/etiquetas). Por eso el sheet
// solo entra en esta etapa; lo que va a Seedance es el keyframe aprobado como
// @Image1 — nunca el sheet. Ver HANDOFF.md.
// ============================================================================

export interface KeyframeResult {
  url?: string;
  mode: string; // motor usado (gpt-image-1 / gpt-image-1+sheet / stub) o "error"
  error?: string;
}

function sizeFor(aspect: "9:16" | "16:9" | "1:1"): string {
  if (aspect === "16:9") return "1536x1024";
  if (aspect === "1:1") return "1024x1024";
  return "1024x1536"; // 9:16
}

// Prompt de composición de un STILL (no un video, no un character sheet). Fuerza
// integración de luz/realismo y prohíbe explícitamente el look de collage/sheet
// que las referencias multi-vista podrían inducir.
export function buildKeyframePrompt(scene: string): string {
  return [
    "Compose ONE photorealistic still frame — a single real photograph, NOT a collage, NOT a character reference sheet, NOT multiple panels:",
    `Scene: ${scene.trim()}`,
    "",
    "Place the SAME person shown in the reference image(s) into this scene. The FIRST reference is the hero portrait (master identity). Any ADDITIONAL reference is a character sheet provided ONLY so you understand their face, hair, skin and build from multiple angles — do NOT reproduce the sheet's layout, multiple views, labels, grid or studio background.",
    "- Preserve the EXACT identity and face of the hero reference. Age, body and wardrobe follow the scene description (you may age, soften or change build per the scene) WITHOUT losing that it is the same person.",
    "- Keep real skin texture (visible pores, fine detail), natural catchlights, tack-sharp eyes, and NO waxy or plastic over-smoothing.",
    "- The person must sit naturally INTO the scene: match lighting direction, intensity, colour temperature, white balance and shadows; add soft, believable contact shadows; never look brighter, flatter or pasted-on than the environment.",
    "- Cinematic, photoreal colour grade across the whole frame; one continuous photograph with gentle film-like contrast, no blown highlights on the face.",
    `- Avoid: collage / multiple panels / reference-sheet look, halo or cut-out edges around the subject, ${NEGATIVE_INSTRUCTIONS}`,
  ].join("\n");
}

/**
 * Compone al personaje de una persona dentro de una escena como imagen fija.
 * Usa avatar (ancla) + sheet (si es una URL descargable) como referencias.
 * Persiste el still en Storage (keyframes/) y devuelve su URL pública.
 * Stub visible sin OPENAI_API_KEY (la UI sigue viva).
 */
export async function composeCharacterInScene(input: {
  personaId: string;
  prompt: string;
  aspect?: "9:16" | "16:9" | "1:1";
}): Promise<KeyframeResult> {
  const scene = input.prompt?.trim();
  if (!scene) return { mode: "error", error: "Describe la escena para el keyframe." };

  const persona = await getPersona(input.personaId);
  if (!persona) return { mode: "error", error: "Persona no encontrada." };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { url: "https://placehold.co/1024x1536/0b1220/f472b6?text=KEYFRAME", mode: "stub" };
  }

  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  const aspect = input.aspect ?? "9:16";

  // Solo URLs http(s) sirven como referencia descargable. El avatar es el ancla;
  // el sheet enriquece la identidad (multi-vista). Sin referencias utilizables,
  // GPT Image no puede preservar la cara → mejor avisar que improvisar.
  const refs = [persona.avatarUrl, persona.sheetUrl].filter((u) => /^https?:\/\//.test(u));
  if (!refs.length) {
    return { mode: "error", error: "La persona no tiene imágenes utilizables como referencia (¿modo stub?)." };
  }

  try {
    const b64 = await editImage(refs, buildKeyframePrompt(scene), sizeFor(aspect), model, apiKey);
    if (!b64) return { mode: model, error: "GPT Image no devolvió keyframe." };
    const url = (await storeImage(b64, "keyframes")) ?? `data:image/png;base64,${b64}`;
    return { url, mode: refs.length > 1 ? `${model}+sheet` : model };
  } catch (e: any) {
    return { mode: model, error: e?.message ?? "No se pudo componer el keyframe." };
  }
}
