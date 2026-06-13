// ============================================================================
// Templates UGC para Meta Ads — estructuras declarativas (tipo JSON) que
// codifican CÓMO se produce cada formato de anuncio de la mejor forma posible
// con Seedance 2.0 (reference-to-video) + voz @Audio1.
//
// Los 3 formatos que mejor convierten en Meta Ads (2025-2026):
//   1. testimonial — talking-head testimonial (confianza/social proof)
//   2. demo        — demo de producto en mano (demuestra, no promete)
//   3. hook-broll  — hook hablado + b-roll con voiceover (retención + CPM bajo)
//
// El template arma DOS cosas a partir de campos guiados:
//   - script      → lo que dice el avatar (se voicea con Gemini TTS → @Audio1)
//   - scenePrompt → el prompt visual para Seedance (framing, cortes, lip-sync)
//
// Convención de tags (igual que el compositor): @Image1 = avatar (siempre),
// @Image2 = primera imagen de referencia (producto/escena), @Audio1 = voz.
// {productRef} se resuelve en fill: "@Image2" si el usuario subió la foto del
// producto, o la descripción textual del campo {product} si no.
// ============================================================================

export interface UgcTemplateField {
  key: string;
  label: string;
  placeholder: string;
  required?: boolean;
  /** "short" = input de una línea; "long" = textarea */
  kind: "short" | "long";
  /** Valor usado si el campo queda vacío (solo campos opcionales). */
  fallback?: string;
}

export interface UgcTemplateDef {
  id: string;
  label: string;
  tagline: string;
  /** Por qué este formato convierte en Meta Ads (se muestra en la UI). */
  why: string;
  fields: UgcTemplateField[];
  /** Scaffold del guion hablado; placeholders {key} por campo. */
  scriptScaffold: string;
  /** Prompt visual para Seedance; placeholders {key} + {productRef}. */
  scenePrompt: string;
  /** Sugiere subir foto del producto (será @Image2). */
  needsProductRef?: boolean;
  /** Tips de producción que la UI muestra como ayuda. */
  notes?: string[];
}

const SETTING_FALLBACK = "a cozy, lived-in room with soft natural daylight";

export const UGC_TEMPLATES: UgcTemplateDef[] = [
  {
    id: "testimonial",
    label: "Testimonial",
    tagline: "Talking head a cámara",
    why: "El formato #1 en conversión: una persona real recomendando en selfie. Genera confianza inmediata y se siente contenido, no anuncio.",
    fields: [
      {
        key: "hook",
        label: "Hook (primeros 3s)",
        placeholder: "Ej: I was today years old when I found out about this…",
        required: true,
        kind: "short",
      },
      {
        key: "pain",
        label: "Problema / dolor",
        placeholder: "Ej: I used to crash every afternoon no matter how much coffee I drank.",
        kind: "long",
      },
      {
        key: "benefit",
        label: "Beneficio concreto",
        placeholder: "Ej: Two weeks in and my energy is stable all day.",
        required: true,
        kind: "long",
      },
      {
        key: "cta",
        label: "Llamado a la acción",
        placeholder: "Ej: Check the link below before it sells out.",
        required: true,
        kind: "short",
      },
      {
        key: "setting",
        label: "Ambiente (opcional)",
        placeholder: "Ej: kitchen with morning light",
        kind: "short",
        fallback: SETTING_FALLBACK,
      },
    ],
    scriptScaffold: "{hook} {pain} {benefit} {cta}",
    scenePrompt:
      "Vertical 9:16 selfie video, handheld front-camera look with subtle natural shake, filmed at arm's length. " +
      "@Image1 is a real UGC creator talking directly into the lens in {setting}. " +
      "Constant direct eye contact, warm conversational energy, natural micro-gestures, small head movements and authentic pauses while speaking. " +
      "The creator speaks the ENTIRE script on camera — lip-sync precisely to @Audio1 from the first frame to the last. " +
      "Amateur authentic framing (slightly off-center), looks self-filmed on a phone, NOT a studio production.",
    notes: [
      "El hook debe poder entenderse SIN audio (mucha gente mira en mute).",
      "Una sola idea por video: un dolor, un beneficio, un CTA.",
    ],
  },
  {
    id: "demo",
    label: "Demo de producto",
    tagline: "Producto en mano",
    why: "El segundo formato que más convierte: ver el producto en uso real demuestra en vez de prometer y baja la fricción de compra.",
    fields: [
      {
        key: "hook",
        label: "Hook (primeros 3s)",
        placeholder: "Ej: Okay so everyone kept asking about this — here it is.",
        required: true,
        kind: "short",
      },
      {
        key: "product",
        label: "Producto (qué es)",
        placeholder: "Ej: Cholibrium, a functional mushroom supplement",
        required: true,
        kind: "short",
      },
      {
        key: "demo",
        label: "Qué muestra / demuestra",
        placeholder: "Ej: shows the capsules, points at the label ingredients",
        required: true,
        kind: "long",
      },
      {
        key: "benefit",
        label: "Beneficio mientras muestra",
        placeholder: "Ej: This is the only one with zero fillers — that's why it works.",
        kind: "long",
      },
      {
        key: "cta",
        label: "Llamado a la acción",
        placeholder: "Ej: Link below — they ship in 2 days.",
        required: true,
        kind: "short",
      },
      {
        key: "setting",
        label: "Ambiente (opcional)",
        placeholder: "Ej: bright bathroom counter",
        kind: "short",
        fallback: SETTING_FALLBACK,
      },
    ],
    scriptScaffold: "{hook} {demo} {benefit} {cta}",
    scenePrompt:
      "Vertical 9:16 selfie video, handheld front-camera look, filmed at arm's length in {setting}. " +
      "@Image1 is a real UGC creator holding and showing {productRef} to the camera. " +
      "Natural demonstration gestures: lifting the product into frame, pointing at it, turning it to show the label — the product stays clearly visible and readable for most of the clip. " +
      "The creator talks to the camera the whole time — lip-sync precisely to @Audio1. " +
      "Authentic self-filmed energy, casual framing, real hands interacting naturally with the product (correct fingers, natural grip).",
    needsProductRef: true,
    notes: [
      "Sube una foto del producto: será @Image2 y Seedance lo replicará exacto.",
      "El producto debe verse nítido en los primeros 2 segundos.",
    ],
  },
  {
    id: "hook-broll",
    label: "Hook + B-roll",
    tagline: "Hook hablado → b-roll con voz en off",
    why: "El formato favorito para escalar en Meta: hook humano que retiene + b-roll del producto con voiceover. Además es el más eficiente en costo.",
    fields: [
      {
        key: "hook",
        label: "Hook hablado a cámara",
        placeholder: "Ej: Nobody is talking about this and it's actually insane.",
        required: true,
        kind: "short",
      },
      {
        key: "voiceover",
        label: "Voz en off (sobre el b-roll)",
        placeholder: "Ej: This little thing fixed my focus in two weeks — no jitters, no crash, just clean energy.",
        required: true,
        kind: "long",
      },
      {
        key: "broll",
        label: "Qué se ve en el b-roll",
        placeholder: "Ej: close-up of the supplement bottle on a kitchen counter, capsules spilling slowly, morning light",
        required: true,
        kind: "long",
      },
      {
        key: "cta",
        label: "Llamado a la acción (en off)",
        placeholder: "Ej: Tap the link to try it.",
        kind: "short",
      },
      {
        key: "setting",
        label: "Ambiente del hook (opcional)",
        placeholder: "Ej: parked car, daylight",
        kind: "short",
        fallback: SETTING_FALLBACK,
      },
    ],
    scriptScaffold: "{hook} {voiceover} {cta}",
    scenePrompt:
      "Vertical 9:16 UGC ad with TWO shots and a hard cut. " +
      "SHOT 1 (first ~3 seconds): @Image1 in a handheld selfie talking head in {setting}, speaks the opening hook directly into the camera with high energy — lip-sync precisely to @Audio1. " +
      "HARD CUT. " +
      "SHOT 2 (rest of the clip): handheld b-roll close-up — {broll} — featuring {productRef}. Nobody talks on camera in this shot; the creator's voice CONTINUES as an off-screen voiceover (@Audio1 keeps playing over the b-roll, perfectly continuous). " +
      "Both shots look self-filmed on the same phone: consistent color, handheld micro-shake, authentic UGC texture.",
    needsProductRef: true,
    notes: [
      "El corte duro a los ~3s es intencional: resetea la atención y retiene.",
      "Si subes la foto del producto (@Image2), el b-roll lo replica exacto.",
    ],
  },
];

export function getUgcTemplate(id: string | undefined | null): UgcTemplateDef | undefined {
  if (!id) return undefined;
  return UGC_TEMPLATES.find((t) => t.id === id);
}

/** Campos requeridos sin completar (para validar en UI y API). */
export function missingRequiredFields(
  def: UgcTemplateDef,
  values: Record<string, string>
): UgcTemplateField[] {
  return def.fields.filter((f) => f.required && !(values[f.key] ?? "").trim());
}

// Reemplaza {key} por el valor (o fallback) y colapsa espacios sobrantes de
// campos opcionales vacíos.
function fill(text: string, values: Record<string, string>): string {
  return text
    .replace(/\{(\w+)\}/g, (_, key: string) => (values[key] ?? "").trim())
    .replace(/\s{2,}/g, " ")
    .trim();
}

export interface FilledTemplate {
  /** Guion hablado (entrada del TTS → @Audio1). */
  script: string;
  /** Prompt visual para Seedance (sin las reglas ocultas; esas las añade la API). */
  scenePrompt: string;
}

/**
 * Arma guion + prompt visual desde un template y sus valores.
 * `hasProductRef` = el usuario subió al menos una imagen extra (será @Image2):
 * {productRef} se resuelve al tag para que Seedance replique el producto exacto.
 */
export function fillUgcTemplate(
  def: UgcTemplateDef,
  values: Record<string, string>,
  opts: { hasProductRef: boolean }
): FilledTemplate {
  // Aplica fallbacks de campos opcionales vacíos.
  const merged: Record<string, string> = { ...values };
  for (const f of def.fields) {
    if (!(merged[f.key] ?? "").trim() && f.fallback) merged[f.key] = f.fallback;
  }
  // {productRef} → tag @Image2 (réplica exacta) o descripción textual.
  const product = (merged["product"] ?? "").trim();
  merged["productRef"] = opts.hasProductRef
    ? `the exact product shown in @Image2${product ? ` (${product})` : ""}`
    : product
      ? `the product (${product})`
      : "the product";

  return {
    script: fill(def.scriptScaffold, merged),
    scenePrompt: fill(def.scenePrompt, merged),
  };
}
