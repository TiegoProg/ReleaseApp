import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { composeCharacterInScene } from "@/lib/keyframe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  personaId: z.string().min(1),
  prompt: z.string().min(1, "Describe la escena del keyframe."),
  aspect: z.enum(["9:16", "16:9", "1:1"]).optional().default("9:16"),
});

// POST /api/ugc/keyframe -> compone al personaje en la escena como imagen fija
// (avatar + sheet vía GPT Image) para previsualizar/aprobar ANTES de animar.
// El keyframe aprobado se reenvía a /api/ugc como heroImageUrl (= @Image1).
export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: e?.issues?.[0]?.message ?? "Body inválido." }, { status: 400 });
  }

  const kf = await composeCharacterInScene(parsed);
  if (!kf.url) {
    const status = kf.error === "Persona no encontrada." ? 404 : 500;
    return NextResponse.json({ error: kf.error ?? "No se pudo componer el keyframe." }, { status });
  }
  return NextResponse.json({ url: kf.url, mode: kf.mode });
}
