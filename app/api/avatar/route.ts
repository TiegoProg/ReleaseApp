import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateAvatarAssets } from "@/lib/avatar";
import { createPersona, listPersonas } from "@/lib/personas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  brief: z.string().min(1, "Describe el avatar que quieres."),
  name: z.string().optional(),
  sourceImageUrl: z.string().url().optional().or(z.literal("")),
  productImageUrl: z.string().url().optional().or(z.literal("")),
  product: z.string().optional(),
});

// GET /api/avatar -> lista de personas del roster
export async function GET() {
  return NextResponse.json({ personas: listPersonas() });
}

// POST /api/avatar -> genera avatar héroe + character sheet y crea la persona
export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (e: any) {
    const msg = e?.issues?.[0]?.message ?? "Body inválido.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    const assets = await generateAvatarAssets({
      brief: parsed.brief,
      sourceImageUrl: parsed.sourceImageUrl || undefined,
      productImageUrl: parsed.productImageUrl || undefined,
      product: parsed.product || undefined,
    });

    const persona = createPersona({
      name: parsed.name,
      avatarUrl: assets.avatarUrl,
      sheetUrl: assets.sheetUrl,
      sourceUrl: assets.sourceUrl,
      identity: assets.identity,
      product: parsed.product || undefined,
      mode: assets.mode,
    });

    return NextResponse.json({ persona });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "No se pudo generar el avatar." },
      { status: 500 }
    );
  }
}
