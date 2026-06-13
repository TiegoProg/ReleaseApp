import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPersona } from "@/lib/personas";
import {
  createProduction,
  planProduction,
  listProductions,
  type CreateProductionInput,
} from "@/lib/productions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ============================================================================
// POST /api/ugc/produce — el endpoint de PRODUCCIÓN (ad completo de N shots).
//
// Spend control del spec: sin `approve: true` NO se gasta nada — la respuesta
// es el render plan (qué se va a generar, con qué modelo, cuántos clips, costo
// estimado, presupuesto). Con approve, el motor corre: escena compartida →
// voz de todos los shots → gate → resto en paralelo. El avance lo hace
// GET /api/ugc/produce/status?id=…
// ============================================================================

const Shot = z.object({
  name: z.string().optional(),
  prompt: z.string().min(1),
  script: z.string().optional().default(""),
});

const Lock = z
  .object({
    outfit: z.string().optional(),
    background: z.string().optional(),
    lighting: z.string().optional(),
    camera: z.string().optional(),
    emotionArc: z.string().optional(),
    gestures: z.string().optional(),
    product: z.string().optional(),
    extra: z.string().optional(),
  })
  .optional();

const Body = z.object({
  personaId: z.string().min(1),
  title: z.string().min(1),
  shots: z.array(Shot).min(1).max(8),
  scenePrompt: z.string().optional(),
  sceneUrl: z.string().url().optional(),
  extraImageUrls: z.array(z.string().url()).optional().default([]),
  lock: Lock,
  model: z.string().optional(),
  seed: z.number().int().optional(),
  gate: z.boolean().optional().default(true),
  budgetUsd: z.number().positive().optional(),
  /** Aprobación EXPLÍCITA del render pago. false/ausente = dry-run (plan). */
  approve: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: e?.issues?.[0]?.message ?? "Body inválido." }, { status: 400 });
  }

  const persona = await getPersona(parsed.personaId);
  if (!persona) return NextResponse.json({ error: "Persona no encontrada." }, { status: 404 });

  const input: CreateProductionInput = { ...parsed, lock: parsed.lock ?? {} };
  const plan = planProduction(input, persona);

  // Dry-run: render plan sin gastar (regla de oro del spec).
  if (!parsed.approve) {
    return NextResponse.json({
      plan,
      message: "Dry-run: nada se renderizó. Reenvía con approve:true para producir.",
    });
  }
  if (!plan.withinBudget) {
    return NextResponse.json(
      { plan, error: `Estimado $${plan.estimatedCostUsd} excede el cap $${plan.budgetUsd}.` },
      { status: 400 }
    );
  }

  const { production, error } = await createProduction(input);
  if (error && !production) return NextResponse.json({ error, plan }, { status: 400 });
  return NextResponse.json({ production, plan });
}

// GET /api/ugc/produce — lista de producciones (recientes primero).
export async function GET() {
  const productions = await listProductions();
  return NextResponse.json({ productions });
}
