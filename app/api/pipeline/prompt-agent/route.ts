import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAnthropic, hasAnthropicKey, MODEL_DIRECTOR } from "@/lib/anthropic";
import {
  buildAgentSystem,
  buildAgentUserMessage,
  buildVideoAgentSystem,
  cleanPromptOutput,
} from "@/lib/promptAgent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ============================================================================
// Nodo "Agente Prompt" de la pizarra. Recibe el contexto del proyecto (de un
// nodo upstream) + una instrucción, y devuelve un prompt de generación de imagen
// escrito por Opus 4.8. Glue fino sobre lib/promptAgent (lógica pura + testeada).
// ============================================================================

const Body = z.object({
  context: z.string().optional().default(""),
  instruction: z.string().min(1, "Dime qué quieres que el agente genere."),
  mode: z.enum(["image", "video"]).optional().default("image"),
});

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: e?.issues?.[0]?.message ?? "Body inválido." }, { status: 400 });
  }

  if (!hasAnthropicKey()) {
    return NextResponse.json(
      { error: "Falta ANTHROPIC_API_KEY — el agente de prompt necesita Claude." },
      { status: 503 }
    );
  }

  try {
    const client = getAnthropic();
    const model = process.env.PIPELINE_PROMPT_MODEL || MODEL_DIRECTOR;
    const system = parsed.mode === "video" ? buildVideoAgentSystem() : buildAgentSystem();
    const msg = await client.messages.create({
      model,
      max_tokens: 800,
      system,
      messages: [{ role: "user", content: buildAgentUserMessage(parsed) }],
    });

    const text = msg.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .filter(Boolean)
      .join("\n");

    const prompt = cleanPromptOutput(text);
    if (!prompt) {
      return NextResponse.json({ error: "El agente no devolvió un prompt." }, { status: 502 });
    }

    return NextResponse.json({ prompt, model });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "El agente de prompt falló." }, { status: 500 });
  }
}
