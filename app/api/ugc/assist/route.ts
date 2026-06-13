import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAnthropic, hasAnthropicKey, MODEL_AREA } from "@/lib/anthropic";
import { getPersona } from "@/lib/personas";
import { UGC_TEMPLATES } from "@/lib/ugcTemplates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ============================================================================
// Agente de prompts del UGC Studio — estratega creativo que conversa con el
// usuario, pregunta lo esencial y entrega un PLAN ejecutable: N clips, cada uno
// con su template + campos listos para producir vía /api/ugc.
// ============================================================================

const Body = z.object({
  personaId: z.string().min(1),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .min(1)
    .max(30),
});

// Lo que el agente puede devolver. clips[].values usa las keys de cada template.
export interface AssistPlanClip {
  templateId: string;
  values: Record<string, string>;
  rationale?: string;
}
export interface AssistResponse {
  reply: string;
  questions?: string[];
  plan?: { title?: string; clips: AssistPlanClip[] };
}

// Serializa los templates para el system prompt (solo lo que el agente necesita).
function templatesForPrompt(): string {
  return UGC_TEMPLATES.map((t) => {
    const fields = t.fields
      .map((f) => `    - ${f.key}${f.required ? " (REQUERIDO)" : ""}: ${f.label}. Ej: "${f.placeholder}"`)
      .join("\n");
    return `- id "${t.id}" — ${t.label} (${t.tagline})\n  Por qué convierte: ${t.why}\n  Campos:\n${fields}`;
  }).join("\n\n");
}

function systemPrompt(persona: {
  name: string;
  identity: string;
  language: string;
  product?: string;
}): string {
  return `Eres el Director Creativo de UGC de una agencia de performance. Tu trabajo: convertir lo que el usuario quiere ("quiero un ad de X") en un plan de producción EJECUTABLE de anuncios UGC para Meta Ads (Reels/Stories 9:16, 8s por clip).

EL AVATAR (ya existe, no se cambia):
- Nombre: ${persona.name}
- Identidad: ${persona.identity}
- Idioma de los guiones: ${persona.language} (los guiones SIEMPRE en este idioma)
${persona.product ? `- Producto asociado: ${persona.product}` : ""}

FORMATOS DISPONIBLES (templates; usa SOLO estos ids y sus campos exactos):
${templatesForPrompt()}

REGLAS DEL OFICIO:
- Por defecto un plan tiene 3 clips con el MISMO objetivo pero hooks/ángulos DISTINTOS (para A/B test en Meta). Mezcla formatos si tiene sentido (p.ej. 2 testimonial + 1 hook-broll).
- Cada clip dura 8s: guiones de 18-25 palabras máximo. Hook entendible SIN audio (mucha gente mira en mute).
- Una sola idea por clip: un dolor, un beneficio, un CTA.
- Nada de claims médicos/curativos absolutos; usa lenguaje de experiencia personal ("a mí me…", "I noticed…").
- Si el usuario no dio lo esencial (qué producto es, a quién apunta, idioma si difiere del avatar, qué NO quiere mostrar), PREGUNTA primero — máximo 3 preguntas, en UNA sola ronda. Si ya puedes asumir algo razonable, asume y dilo.
- Cuando tengas lo suficiente, entrega el plan completo. No alargues la conversación.

FORMATO DE RESPUESTA — devuelve EXCLUSIVAMENTE un objeto JSON válido (sin markdown, sin \`\`\`):
{
  "reply": "tu respuesta conversacional en español (breve, directa)",
  "questions": ["pregunta 1", "..."],            // solo si NECESITAS respuestas para continuar
  "plan": {                                       // solo cuando esté listo para producir
    "title": "nombre corto de la campaña",
    "clips": [
      {
        "templateId": "testimonial",
        "values": { "hook": "...", "benefit": "...", "cta": "...", "setting": "..." },
        "rationale": "por qué este ángulo (1 frase)"
      }
    ]
  }
}
- En "values" usa EXACTAMENTE las keys del template elegido; completa SIEMPRE los campos requeridos.
- Si entregas "plan", no incluyas "questions".`;
}

// Extrae el primer objeto JSON balanceado del texto (defensivo ante texto extra).
function extractJson(text: string): AssistResponse | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// Valida el plan contra los templates reales (ids y campos requeridos).
function validatePlan(plan: AssistResponse["plan"]): string | null {
  if (!plan?.clips?.length) return null;
  for (const clip of plan.clips) {
    const tpl = UGC_TEMPLATES.find((t) => t.id === clip.templateId);
    if (!tpl) return `El plan usa un formato inexistente: "${clip.templateId}".`;
    const missing = tpl.fields.filter((f) => f.required && !(clip.values?.[f.key] ?? "").trim());
    if (missing.length)
      return `Al clip "${tpl.label}" le faltan campos: ${missing.map((f) => f.label).join(", ")}.`;
  }
  return null;
}

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: e?.issues?.[0]?.message ?? "Body inválido." }, { status: 400 });
  }

  if (!hasAnthropicKey()) {
    return NextResponse.json(
      { error: "Falta ANTHROPIC_API_KEY — el asistente necesita Claude." },
      { status: 503 }
    );
  }

  const persona = await getPersona(parsed.personaId);
  if (!persona) return NextResponse.json({ error: "Persona no encontrada." }, { status: 404 });

  try {
    const client = getAnthropic();
    const model = process.env.UGC_ASSIST_MODEL || MODEL_AREA;
    const msg = await client.messages.create({
      model,
      max_tokens: 2000,
      system: systemPrompt(persona),
      messages: parsed.messages,
    });

    const text = msg.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .filter(Boolean)
      .join("\n");

    const out = extractJson(text);
    if (!out?.reply) {
      // Respuesta no parseable: la devolvemos como texto plano para no romper el chat.
      return NextResponse.json({ reply: text.trim() || "No pude generar una respuesta.", raw: true });
    }

    // Plan inválido → lo degradamos a conversación con el error como contexto.
    const planError = validatePlan(out.plan);
    if (planError) {
      return NextResponse.json({
        reply: `${out.reply}\n\n⚠️ ${planError} Pídeme que lo corrija.`,
        questions: out.questions,
      });
    }

    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "El asistente falló." },
      { status: 500 }
    );
  }
}
