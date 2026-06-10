import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPersona } from "@/lib/personas";
import { generateVoice } from "@/lib/voice";
import { startVideo } from "@/lib/seedance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  personaId: z.string().min(1),
  script: z.string().min(1, "Escribe el guion que dirá el avatar."),
  motionPreset: z.string().optional(),
});

// Menú cerrado de presets de movimiento (estilo Higgsfield), no prompt libre.
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

  const persona = getPersona(parsed.personaId);
  if (!persona) return NextResponse.json({ error: "Persona no encontrada." }, { status: 404 });

  // 1) Voz pineada (coherencia por persona)
  const voice = await generateVoice({
    text: parsed.script,
    voiceName: persona.voiceName,
    language: persona.language,
  });

  // 2) Prompt de Seedance con preset de movimiento
  const presetText =
    PRESETS[parsed.motionPreset ?? "talking-head"] ?? PRESETS["talking-head"];
  const prompt =
    `@Image1 is a UGC creator, vertical 9:16 selfie framing. ${presetText} ` +
    (voice.audioUrl ? "Lip-sync the speech precisely to @Audio1." : `The creator says: "${parsed.script}".`);

  // 3) Lanza el video (async). Stub si falta FAL_KEY.
  const job = await startVideo({
    imageUrl: persona.avatarUrl,
    audioUrl: voice.audioUrl,
    prompt,
  });

  return NextResponse.json({ job, voiceMode: voice.mode });
}
