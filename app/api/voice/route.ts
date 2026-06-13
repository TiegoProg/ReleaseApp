import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPersona } from "@/lib/personas";
import { generateVoice } from "@/lib/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/voice — preview de voz STANDALONE (sin tocar Seedance ni gastar en
// video). Permite escuchar/validar la voz de una persona (pronunciación, tags
// de emoción de eleven v3, pausas) ANTES de aprobar una producción paga.
// Workflow del spec: la voz es la fuente de verdad — se valida primero.
const Body = z.object({
  personaId: z.string().min(1),
  text: z.string().min(1).max(600),
});

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: e?.issues?.[0]?.message ?? "Body inválido." }, { status: 400 });
  }

  const persona = await getPersona(parsed.personaId);
  if (!persona) return NextResponse.json({ error: "Persona no encontrada." }, { status: 404 });

  const voice = await generateVoice({
    text: parsed.text,
    voiceName: persona.voiceName,
    language: persona.language,
    elevenVoiceId: persona.elevenVoiceId,
  });

  if (!voice.audioUrl) {
    return NextResponse.json(
      { error: `La voz no se generó (mode: ${voice.mode}). Revisa keys/storage.`, mode: voice.mode },
      { status: 502 }
    );
  }
  return NextResponse.json({
    audioUrl: voice.audioUrl,
    mode: voice.mode,
    model: voice.model,
    voiceId: voice.voiceId,
    elevenError: voice.elevenError,
    persona: persona.name,
  });
}
