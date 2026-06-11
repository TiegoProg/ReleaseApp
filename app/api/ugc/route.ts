import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPersona } from "@/lib/personas";
import { generateVoice } from "@/lib/voice";
import { startVideo } from "@/lib/seedance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Material de referencia adicional (más allá del avatar, que siempre es @Image1).
const RefSchema = z.object({
  kind: z.enum(["image", "video", "audio"]),
  url: z.string().url(),
});

const Body = z.object({
  personaId: z.string().min(1),
  prompt: z.string().optional().default(""), // prompt libre con tags @Image1/@Video1/@Audio1…
  script: z.string().optional().default(""), // lo que dice el avatar (→ voz @Audio1)
  speak: z.boolean().optional().default(true), // generar voz a partir del guion
  motionPreset: z.string().optional(),
  references: z.array(RefSchema).optional().default([]),
  model: z.string().optional(), // override puntual del modelo Seedance (p.ej. pro)
});

// Reglas OCULTAS de calidad — se añaden a TODO render UGC. El dolor #1 de
// reference-to-video con fondo es que el sujeto se ve "pegado" / sobreexpuesto;
// estas reglas fuerzan integración de luz y realismo sin que el usuario lo escriba.
function enhanceUgcPrompt(prompt: string): string {
  return [
    prompt.trim(),
    "",
    "— Realism & lighting integration (apply silently, always):",
    "- The shot must look like ONE real photograph/video, never composited or pasted-on. Match lighting DIRECTION, intensity, color temperature, white balance and shadows between the person and the environment.",
    "- Relight the subject to sit naturally INTO the scene: the person must NOT look brighter, flatter or more HDR than the background. Blend their skin with the ambient warm/cool cast of the set, lower their exposure to the room's level, and add soft, believable contact shadows. No glowing or over-exposed skin, no flat frontal ring-light look that clashes with the set.",
    "- Preserve the EXACT identity, face and features of the @Image1 subject; keep real skin texture (visible pores, fine detail), tack-sharp focus on the eyes, natural catchlights, and NO waxy or plastic over-smoothing.",
    "- Cinematic, photoreal color grade consistent across the whole frame; gentle film-like contrast, no blown highlights on the face.",
    "- Avoid: halo / cut-out edges around the subject, distorted hands or faces, extra fingers, watermarks, captions, subtitles, logos or UI overlays.",
  ].join("\n");
}

// Límites de Seedance 2.0 multi-referencia.
const LIMITS = { image: 9, video: 3, audio: 3, total: 12 };

// Menú cerrado de presets de movimiento (se usa solo si el prompt va vacío).
const PRESETS: Record<string, string> = {
  "talking-head": "Static selfie shot, the creator talks directly to the camera with natural micro-gestures.",
  unboxing: "The creator excitedly unboxes and shows the product to the camera.",
  review: "The creator gives an honest product review, holding the product up to the camera.",
  "try-on": "The creator demonstrates / tries the product, casual lifestyle setting.",
};

// POST /api/ugc -> arranca la generación del clip (voz + Seedance). No bloqueante.
export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (e: any) {
    const msg = e?.issues?.[0]?.message ?? "Body inválido.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const persona = await getPersona(parsed.personaId);
  if (!persona) return NextResponse.json({ error: "Persona no encontrada." }, { status: 404 });

  // Materiales por tipo, en el ORDEN recibido (= orden de los tags del prompt).
  const refImages = parsed.references.filter((r) => r.kind === "image").map((r) => r.url);
  const refVideos = parsed.references.filter((r) => r.kind === "video").map((r) => r.url);
  const refAudios = parsed.references.filter((r) => r.kind === "audio").map((r) => r.url);

  // 1) Voz pineada del guion (coherencia por persona). Va como @Audio1 si existe.
  let voiceMode = "off";
  let voiceUrl: string | undefined;
  if (parsed.speak && parsed.script.trim()) {
    const voice = await generateVoice({
      text: parsed.script,
      voiceName: persona.voiceName,
      language: persona.language,
    });
    voiceMode = voice.mode;
    voiceUrl = voice.audioUrl;
  }

  // 2) Arma los arrays finales. @Image1 = avatar; @Audio1 = voz (si hay).
  const images = [persona.avatarUrl, ...refImages];
  const videos = refVideos;
  const audios = [...(voiceUrl ? [voiceUrl] : []), ...refAudios];

  // 3) Valida los límites de Seedance 2.0.
  const total = images.length + videos.length + audios.length;
  const overflow =
    images.length > LIMITS.image ||
    videos.length > LIMITS.video ||
    audios.length > LIMITS.audio ||
    total > LIMITS.total;
  if (overflow) {
    return NextResponse.json(
      {
        error: `Límites de materiales: ≤${LIMITS.image} imágenes, ≤${LIMITS.video} videos, ≤${LIMITS.audio} audios, ≤${LIMITS.total} en total. Recibí ${images.length}/${videos.length}/${audios.length} (total ${total}).`,
      },
      { status: 400 }
    );
  }

  // 4) Prompt final. Si el usuario escribió uno, manda él; si no, lo armamos del preset.
  let prompt = parsed.prompt.trim();
  if (!prompt) {
    const presetText = PRESETS[parsed.motionPreset ?? "talking-head"] ?? PRESETS["talking-head"];
    prompt = `@Image1 is a UGC creator, vertical 9:16 selfie framing. ${presetText}`;
  }
  // Garantiza el lip-sync a la voz / el guion hablado aunque el usuario no lo escriba.
  if (voiceUrl && !/@Audio1/i.test(prompt)) {
    prompt += ` Lip-sync the speech precisely to @Audio1.`;
  } else if (!voiceUrl && parsed.script.trim() && !/\bsays?\b/i.test(prompt)) {
    prompt += ` The creator says: "${parsed.script.trim()}".`;
  }

  // Reglas ocultas de calidad/iluminación (siempre).
  prompt = enhanceUgcPrompt(prompt);

  // 5) Lanza el video (async). Stub si falta FAL_KEY.
  const job = await startVideo({
    imageUrls: images,
    videoUrls: videos,
    audioUrls: audios,
    prompt,
    model: parsed.model,
  });

  return NextResponse.json({
    job,
    voiceMode,
    prompt,
    counts: { images: images.length, videos: videos.length, audios: audios.length, total },
  });
}
