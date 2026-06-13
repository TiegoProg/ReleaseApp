import type { ToolDef } from "./context";
import { listPersonas, getPersona } from "../personas";
import {
  planProduction,
  createProduction,
  advanceProduction,
  type CreateProductionInput,
  type Production,
} from "../productions";
import { CAMERA_PRESETS } from "../ugcPrompt";

// ============================================================================
// Tools del UGC Studio para los agentes in-app (área creative) — el mismo motor
// de producciones que usa el MCP server y la API, sin pasar por HTTP.
// Regla de gasto del spec: produce_ugc_ad SIN approve=true devuelve el render
// plan (dry-run); el agente debe pedir aprobación humana antes de aprobar.
// ============================================================================

function fmtPlan(plan: ReturnType<typeof planProduction>): string {
  const shots = plan.shots.map((s, i) => `  ${i + 1}. ${s.name} — "${s.script}"`).join("\n");
  return [
    `RENDER PLAN (dry-run, nada renderizado):`,
    `Campaña: ${plan.title} · Persona: ${plan.persona}`,
    `Modelo: ${plan.model} · Gate: ${plan.gate ? "sí" : "no"}`,
    shots,
    `Costo: ≈ $${plan.perClipUsd}/clip → estimado $${plan.estimatedCostUsd} (cap $${plan.budgetUsd} → ${plan.withinBudget ? "OK" : "EXCEDIDO"})`,
    `Para producir de verdad: pide aprobación al usuario (request_user_input) y reintenta con approve=true.`,
  ].join("\n");
}

function fmtProduction(p: Production): string {
  const shots = p.shots
    .map((s) => `  - ${s.name} [${s.status}]${s.videoUrl ? ` ${s.videoUrl}` : ""}${s.error ? ` (${s.error})` : ""}`)
    .join("\n");
  return [
    `Producción ${p.id} — "${p.title}" (${p.personaName})`,
    `Estado: ${p.status} · gastado ≈ $${p.spentUsd} de $${p.budgetUsd}`,
    shots,
    p.status === "rendering"
      ? `Sigue avanzando con check_ugc_production cada ~15s hasta ready/partial/failed.`
      : `Estado terminal.`,
  ].join("\n");
}

export const listUgcPersonas: ToolDef = {
  schema: {
    name: "list_ugc_personas",
    description:
      "Lista las personas del UGC Studio (avatares consistentes con voz pineada). Devuelve id, nombre, voz e idioma — el personaId es requerido para producir ads.",
    input_schema: { type: "object", properties: {} },
  },
  handler: async () => {
    const personas = await listPersonas();
    if (!personas.length) return "No hay personas en el roster. Crea una desde el Studio primero.";
    return personas
      .map(
        (p) =>
          `- ${p.name} (id: ${p.id}) · voz ${p.voiceName}/${p.language} · ${p.videos.length} clips${p.product ? ` · producto: ${p.product}` : ""}`
      )
      .join("\n");
  },
};

export const produceUgcAd: ToolDef = {
  schema: {
    name: "produce_ugc_ad",
    description:
      "Produce un ad UGC completo de N shots con consistencia total (cara/voz/outfit/fondo/cámara lockeados server-side, voz TTS primero, gate de gasto, presupuesto duro). SIN approve=true es un dry-run que devuelve el render plan con costos — muéstralo y pide aprobación humana ANTES de aprobar. Presets de cámara para lock.camera: " +
      Object.keys(CAMERA_PRESETS).join(", "),
    input_schema: {
      type: "object",
      properties: {
        personaId: { type: "string", description: "Id de la persona (list_ugc_personas)." },
        title: { type: "string", description: "Nombre de la campaña/concepto." },
        shots: {
          type: "array",
          description: "Secuencia de 1-8 shots.",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              prompt: {
                type: "string",
                description: "Prompt visual (acción/emoción/gestos). Sin locks: se estampan solos.",
              },
              script: { type: "string", description: "Guion hablado (18-25 palabras por 8s)." },
            },
            required: ["prompt"],
          },
        },
        scenePrompt: {
          type: "string",
          description: "Set compartido @Image2 (fotorrealista, SIN personas) — continuidad de fondo.",
        },
        lock: {
          type: "object",
          description: "Consistency lock: outfit, background, lighting, camera (key de preset o texto), emotionArc, gestures.",
          properties: {
            outfit: { type: "string" },
            background: { type: "string" },
            lighting: { type: "string" },
            camera: { type: "string" },
            emotionArc: { type: "string" },
            gestures: { type: "string" },
          },
        },
        budgetUsd: { type: "number", description: "Cap duro de gasto (default $10)." },
        approve: {
          type: "boolean",
          description: "true SOLO tras aprobación explícita del usuario. Sin esto: dry-run.",
        },
      },
      required: ["personaId", "title", "shots"],
    },
  },
  handler: async (input) => {
    const args = input as CreateProductionInput & { approve?: boolean };
    const persona = await getPersona(args.personaId);
    if (!persona) return `Persona no encontrada: ${args.personaId}. Usa list_ugc_personas.`;

    const plan = planProduction(args, persona);
    if (!args.approve) return fmtPlan(plan);
    if (!plan.withinBudget) {
      return `NO lanzado: estimado $${plan.estimatedCostUsd} excede el cap $${plan.budgetUsd}. Reduce shots o sube budgetUsd.`;
    }
    const { production, error } = await createProduction(args);
    if (error && !production) return `NO lanzado: ${error}`;
    return fmtProduction(production!);
  },
};

export const checkUgcProduction: ToolDef = {
  schema: {
    name: "check_ugc_production",
    description:
      "Consulta y AVANZA una producción UGC en curso: pollea renders, aplica el gate (shot 1 OK → encola el resto) y devuelve estado + URLs de video listos.",
    input_schema: {
      type: "object",
      properties: { productionId: { type: "string" } },
      required: ["productionId"],
    },
  },
  handler: async (input) => {
    const { productionId } = input as { productionId: string };
    const p = await advanceProduction(productionId);
    if (!p) return `Producción no encontrada: ${productionId}.`;
    return fmtProduction(p);
  },
};
