import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasAnthropicKey } from "@/lib/anthropic";
import { startCampaign } from "@/lib/agents/orchestrator";
import { getSnapshot } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ goal: z.string().min(3) });

// GET /api/campaign?id=...  -> snapshot para rehidratar la UI.
export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Falta ?id" }, { status: 400 });
  }
  const snapshot = await getSnapshot(id);
  if (!snapshot) {
    return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });
  }
  const times = [
    ...snapshot.messages.map((m) => m.createdAt),
    ...snapshot.deliverables.map((d) => d.createdAt),
    ...snapshot.agents.map((a) => a.createdAt),
  ];
  const maxTs = times.length ? times.sort().slice(-1)[0] : snapshot.campaign.createdAt;
  return NextResponse.json({ snapshot, maxTs });
}

export async function POST(req: NextRequest) {
  if (!hasAnthropicKey()) {
    return NextResponse.json(
      {
        error:
          "Falta ANTHROPIC_API_KEY. Crea .env.local con tu key de Anthropic y reinicia `npm run dev`.",
      },
      { status: 400 }
    );
  }

  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Body inválido. Se requiere { goal }." }, { status: 400 });
  }

  const { campaignId, directorId } = await startCampaign(parsed.goal);
  return NextResponse.json({ campaignId, directorId });
}
