import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPersona } from "@/lib/personas";
import { generateVoice } from "@/lib/voice";
import { startVideo } from "@/lib/seedance";
import { getUgcTemplate, fillUgcTemplate, missingRequiredFields } from "@/lib/ugcTemplates";
import { enhanceUgcPrompt, LIMITS } from "@/lib/ugcPrompt";

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
  // Keyframe aprobado (personaje YA compuesto en la escena). Si viene, REEMPLAZA
  // al avatar héroe como @Image1 — el modelo de video parte del still aprobado
  // en vez de improvisar vestuario/edad/entorno. Nunca se pasa el character sheet.
  heroImageUrl: z.string().url().optional(),
  motionPreset: z.string().optional(),
  references: z.array(RefSchema).optional().default([]),
  model: z.string().optional(), // override puntual del modelo Seedance (p.ej. pro)
  // Modo template (Meta Ads): el server arma guion + prompt desde la estructura.
  templateId: z.string().optional(),
  templateValues: z.record(z.string()).optional().default({}),
});

// Reglas ocultas de calidad + límites multi-referencia: viven en lib/ugcPrompt.ts
// (compartidas con el motor de producciones — una sola fuente de verdad).

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

  // 0) Modo template: el server arma guion + prompt desde la estructura (fuente
  // de verdad), ignorando script/prompt libres. @Image2 = primera ref de imagen.
  let script = parsed.script;
  let templatePrompt = "";
  if (parsed.templateId) {
    const tpl = getUgcTemplate(parsed.templateId);
    if (!tpl) {
      return NextResponse.json({ error: `Template desconocido: ${parsed.templateId}` }, { status: 400 });
    }
    const missing = missingRequiredFields(tpl, parsed.templateValues);
    if (missing.length) {
      return NextResponse.json(
        { error: `Faltan campos del template: ${missing.map((f) => f.label).join(", ")}.` },
        { status: 400 }
      );
    }
    const filled = fillUgcTemplate(tpl, parsed.templateValues, {
      hasProductRef: refImages.length > 0,
    });
    script = filled.script;
    templatePrompt = filled.scenePrompt;
  }

  // 1) Voz pineada del guion (coherencia por persona). Va como @Audio1 si existe.
  let voiceMode = "off";
  let voiceUrl: string | undefined;
  if (parsed.speak && script.trim()) {
    const voice = await generateVoice({
      text: script,
      voiceName: persona.voiceName,
      language: persona.language,
      elevenVoiceId: persona.elevenVoiceId,
    });
    voiceMode = voice.mode;
    voiceUrl = voice.audioUrl;
  }

  // 2) Arma los arrays finales. @Image1 = keyframe aprobado (si hay) o avatar;
  //    @Audio1 = voz (si hay).
  const heroImage = parsed.heroImageUrl || persona.avatarUrl;
  const images = [heroImage, ...refImages];
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

  // 4) Prompt final. Template > prompt del usuario > preset.
  let prompt = templatePrompt || parsed.prompt.trim();
  if (!prompt) {
    const presetText = PRESETS[parsed.motionPreset ?? "talking-head"] ?? PRESETS["talking-head"];
    prompt = `@Image1 is a UGC creator, vertical 9:16 selfie framing. ${presetText}`;
  }
  // Garantiza el lip-sync a la voz / el guion hablado aunque el usuario no lo escriba.
  if (voiceUrl && !/@Audio1/i.test(prompt)) {
    prompt += ` Lip-sync the speech precisely to @Audio1.`;
  } else if (!voiceUrl && script.trim() && !/\bsays?\b/i.test(prompt)) {
    prompt += ` The creator says: "${script.trim()}".`;
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
    script, // guion final (armado por el template si aplica) — la UI lo persiste
    counts: { images: images.length, videos: videos.length, audios: audios.length, total },
  });
}
