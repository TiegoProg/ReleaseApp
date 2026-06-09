import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasAnthropicKey } from "@/lib/anthropic";
import { sendUserMessage } from "@/lib/agents/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  campaignId: z.string().min(1),
  agentId: z.string().min(1),
  text: z.string().min(1),
});

export async function POST(req: NextRequest) {
  if (!hasAnthropicKey()) {
    return NextResponse.json({ error: "Falta ANTHROPIC_API_KEY." }, { status: 400 });
  }

  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Body inválido. Se requiere { campaignId, agentId, text }." },
      { status: 400 }
    );
  }

  const res = await sendUserMessage(parsed.campaignId, parsed.agentId, parsed.text);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
