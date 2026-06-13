import { NextRequest, NextResponse } from "next/server";
import { advanceProduction } from "@/lib/productions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/ugc/produce/status?id=… — pollea los shots en render Y avanza el
// pipeline (gate OK → encola el resto; gate falló → protege el presupuesto).
// Idempotente: cualquier poller (script, UI, agente) puede llamarlo en loop.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id." }, { status: 400 });

  const production = await advanceProduction(id);
  if (!production) return NextResponse.json({ error: "Producción no encontrada." }, { status: 404 });
  return NextResponse.json({ production });
}
