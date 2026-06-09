import { NextResponse } from "next/server";
import { listCampaigns } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/campaigns -> lista de proyectos/campañas guardados (más nuevos primero).
export async function GET() {
  const campaigns = await listCampaigns();
  return NextResponse.json({ campaigns });
}
