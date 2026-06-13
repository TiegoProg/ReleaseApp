import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateScene } from "@/lib/scene";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  prompt: z.string().min(1, "Describe el escenario / fondo."),
  aspect: z.enum(["9:16", "16:9", "1:1"]).optional().default("9:16"),
});

// POST /api/scene -> genera una imagen de escenario/fondo (sin personas) y la
// sube a Storage. Pensada como material de referencia (@ImageN) para el compositor.
export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: e?.issues?.[0]?.message ?? "Body inválido." }, { status: 400 });
  }

  const scene = await generateScene(parsed.prompt, parsed.aspect);
  if (!scene.url) {
    return NextResponse.json({ error: scene.error ?? "No se pudo generar el escenario." }, { status: 500 });
  }
  return NextResponse.json({ url: scene.url, mode: scene.mode });
}
