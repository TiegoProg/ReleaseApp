import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addPersonaVideo } from "@/lib/personas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  personaId: z.string().min(1),
  videoUrl: z.string().url(),
  script: z.string().default(""),
  preset: z.string().optional(),
});

// POST /api/ugc/save -> adjunta el clip generado a la persona (galería persistente)
export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const persona = addPersonaVideo(parsed.personaId, {
    url: parsed.videoUrl,
    script: parsed.script,
    preset: parsed.preset,
    createdAt: new Date().toISOString(),
  });
  if (!persona) return NextResponse.json({ error: "Persona no encontrada." }, { status: 404 });

  return NextResponse.json({ persona });
}
