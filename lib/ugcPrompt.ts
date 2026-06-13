// ============================================================================
// Reglas de prompt compartidas del estudio UGC (AI_UGC_SYSTEM.md hecho código).
//
// Tres bloques que se estampan SERVER-SIDE en todo render (el usuario no tiene
// que escribirlos y no puede olvidarlos):
//   1. NEGATIVE_INSTRUCTIONS — la lista negativa canónica del sistema.
//   2. enhanceUgcPrompt()    — integración de luz/realismo (anti "pegado").
//   3. buildLockBlock()      — consistency lock por secuencia: cara, voz,
//      outfit, fondo, cámara y arco emocional idénticos en todos los shots.
// ============================================================================

export const LIMITS = { image: 9, video: 3, audio: 3, total: 12 };

// Lista negativa canónica (idéntica al spec AI_UGC_SYSTEM.md §Seedance).
export const NEGATIVE_INSTRUCTIONS =
  "No captions, no subtitles, no lower thirds, no floating text, no watermark, no UI, " +
  "no extra limbs, no distorted hands, no product label hallucination, no text on " +
  "clothing/walls, no overacting, no fake commercial energy.";

// Reglas OCULTAS de calidad — se añaden a TODO render UGC. El dolor #1 de
// reference-to-video con fondo es que el sujeto se ve "pegado" / sobreexpuesto;
// estas reglas fuerzan integración de luz y realismo sin que el usuario lo escriba.
export function enhanceUgcPrompt(prompt: string): string {
  return [
    prompt.trim(),
    "",
    "— Realism & lighting integration (apply silently, always):",
    "- The shot must look like ONE real photograph/video, never composited or pasted-on. Match lighting DIRECTION, intensity, color temperature, white balance and shadows between the person and the environment.",
    "- Relight the subject to sit naturally INTO the scene: the person must NOT look brighter, flatter or more HDR than the background. Blend their skin with the ambient warm/cool cast of the set, lower their exposure to the room's level, and add soft, believable contact shadows. No glowing or over-exposed skin, no flat frontal ring-light look that clashes with the set.",
    "- Preserve the EXACT identity, face and features of the @Image1 subject; keep real skin texture (visible pores, fine detail), tack-sharp focus on the eyes, natural catchlights, and NO waxy or plastic over-smoothing.",
    "- Cinematic, photoreal color grade consistent across the whole frame; gentle film-like contrast, no blown highlights on the face.",
    `- Avoid: halo / cut-out edges around the subject, ${NEGATIVE_INSTRUCTIONS}`,
  ].join("\n");
}

// ----------------------------------------------------------------------------
// Consistency lock — el corazón de los ads consistentes.
// ----------------------------------------------------------------------------

export interface ConsistencyLock {
  /** Ropa exacta del creador (idéntica en todos los shots). */
  outfit?: string;
  /** Set/fondo (si hay @Image2 de escena, se referencia automáticamente). */
  background?: string;
  /** Dirección/temperatura de luz. */
  lighting?: string;
  /** Framing y feel de cámara (selfie a un brazo, chest-up, etc.). */
  camera?: string;
  /** Arco emocional de la secuencia completa. */
  emotionArc?: string;
  /** Reglas de gestos/manos (p.ej. "hands EMPTY, no product"). */
  gestures?: string;
  /** Regla de producto (default seguro: jamás generado en mano → overlay en post). */
  product?: string;
  /** Notas extra de continuidad. */
  extra?: string;
}

// Defaults seguros del sistema (Product Handling Rules del spec).
const LOCK_DEFAULTS: Required<Pick<ConsistencyLock, "product" | "gestures">> = {
  product:
    "The product is NEVER generated in-hand or in-frame; the real packshot is overlaid in post-production. Do not invent any product or label.",
  gestures: "Natural micro-gestures only; hands stay EMPTY unless explicitly stated otherwise.",
};

/**
 * Construye el bloque de consistencia que se estampa en CADA shot de una
 * secuencia. `shotIndex` es 0-based; `hasScene` indica que @Image2 es el frame
 * de escena compartido; `hasAudio` que existe @Audio1 (voz TTS fuente de verdad).
 */
export function buildLockBlock(
  lock: ConsistencyLock,
  opts: { shotIndex: number; totalShots: number; hasScene: boolean; hasAudio: boolean }
): string {
  const merged: ConsistencyLock & typeof LOCK_DEFAULTS = { ...LOCK_DEFAULTS, ...stripEmpty(lock) };
  const lines: string[] = [
    "",
    `— Consistency lock (shot ${opts.shotIndex + 1} of ${opts.totalShots} in ONE continuous ad — every shot must match the others exactly):`,
    "- Face lock: @Image1 is the SAME person in every shot of this sequence. Preserve identity, face shape, age, hairstyle and skin tone exactly. Do not beautify, do not change ethnicity, age, facial structure or gender.",
  ];
  if (opts.hasAudio) {
    lines.push(
      "- Voice lock: the provided @Audio1 is the source of truth. Lip-sync mouth movement and facial performance precisely to it, including its pauses. Do not invent a different voice."
    );
  }
  if (merged.outfit) lines.push(`- Outfit lock: ${merged.outfit} Identical wardrobe in every shot.`);
  if (opts.hasScene) {
    lines.push(
      `- Background lock: match the set shown in @Image2 exactly — same objects, same depth, same framing of the room.${merged.background ? ` ${merged.background}` : ""}`
    );
  } else if (merged.background) {
    lines.push(`- Background lock: ${merged.background} Identical in every shot.`);
  }
  if (merged.lighting) lines.push(`- Lighting lock: ${merged.lighting} Identical in every shot.`);
  if (merged.camera) lines.push(`- Camera lock: ${merged.camera} Identical framing and lens feel in every shot.`);
  if (merged.emotionArc) lines.push(`- Emotion arc of the full ad: ${merged.emotionArc}`);
  lines.push(`- Gesture rules: ${merged.gestures}`);
  lines.push(`- Product rule: ${merged.product}`);
  if (merged.extra) lines.push(`- Continuity notes: ${merged.extra}`);
  lines.push(`- Negative instructions: ${NEGATIVE_INSTRUCTIONS}`);
  return lines.join("\n");
}

// ----------------------------------------------------------------------------
// Presets de cámara/movimiento — librería curada estilo Higgsfield, acotada a
// UGC para paid social (nada cinematográfico). El lock.camera de una producción
// puede ser una key de aquí (se expande) o texto libre.
// ----------------------------------------------------------------------------

export const CAMERA_PRESETS: Record<string, string> = {
  "selfie-handheld":
    "Handheld front-camera selfie at arm's length, chest-up, slightly off-center, subtle natural shake, looks self-filmed on a phone.",
  "tripod-static":
    "Static phone-on-tripod framing, chest-up, eye-level, perfectly stable, natural social media framing.",
  "slow-push-in":
    "Slow subtle push-in toward the creator across the clip, starting chest-up and ending slightly tighter, smooth and organic, never robotic.",
  "punch-in":
    "Static framing with one quick digital punch-in (~105%) mid-clip to reset attention, then hold steady.",
  "walk-and-talk":
    "Handheld selfie while walking outdoors, natural bounce with each step, creator keeps eye contact with the lens.",
  "car-seat":
    "Front phone camera propped on the dashboard of a parked car, soft window light, casual confessional framing, chest-up.",
  "podcast-seated":
    "Seated podcast-guest framing, chest-up, slightly off-center, subtle documentary handheld feel, professional microphone on a boom arm in frame.",
  "street-interview":
    "Street-interview framing on a sidewalk: creator chest-up, an interviewer microphone may enter from off-screen, handheld documentary energy.",
  "pov-desk":
    "Phone propped on a desk at a slight low angle, creator leans in toward the camera, casual authentic vlog framing.",
  "unboxing-table":
    "45-degree angle over a table with phone on a small tripod, hands and product clearly in frame, stable and well lit.",
};

/** Expande una key de CAMERA_PRESETS; si no es una key, devuelve el texto tal cual. */
export function resolveCameraPreset(value?: string): string | undefined {
  if (!value) return undefined;
  return CAMERA_PRESETS[value.trim().toLowerCase()] ?? value;
}

function stripEmpty(obj: ConsistencyLock): ConsistencyLock {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out as ConsistencyLock;
}
