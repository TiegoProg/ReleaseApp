import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordShotQa } from "@/lib/productions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/ugc/produce/qa — registra el QA scorecard de un shot (spec §QA):
// scores 1-10 por eje + decisión (keep / edit-in-post / regenerate /
// change-concept) + el issue exacto y el parche de prompt si aplica.
const Body = z.object({
  productionId: z.string().min(1),
  shotIndex: z.number().int().min(0),
  scores: z.record(z.number().min(1).max(10)).optional(),
  decision: z.enum(["keep", "edit-in-post", "regenerate", "change-concept"]).optional(),
  exactIssue: z.string().optional(),
  promptPatch: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: e?.issues?.[0]?.message ?? "Body inválido." }, { status: 400 });
  }

  const production = await recordShotQa(parsed.productionId, parsed.shotIndex, {
    scores: parsed.scores,
    decision: parsed.decision,
    exactIssue: parsed.exactIssue,
    promptPatch: parsed.promptPatch,
    notes: parsed.notes,
  });
  if (!production) {
    return NextResponse.json({ error: "Producción o shot no encontrado." }, { status: 404 });
  }
  return NextResponse.json({ production });
}
