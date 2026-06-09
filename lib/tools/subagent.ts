import type { ToolDef } from "./context";
import { AREAS, AREA_KEYS, type AreaKey } from "../types";
import { getEnabledAreas } from "../agents/runtimeConfig";
import { addMessage } from "../store";

// delegate_to_area — solo del Director. Activa un agente de área y corre su loop completo.
export const delegateToArea: ToolDef = {
  schema: {
    name: "delegate_to_area",
    description:
      "Delega un objetivo a un agente de área para que lo ejecute. El área trabajará y publicará sus entregables en el board, y te devolverá un resumen. Delega de a una área por vez, respetando dependencias (p. ej. Creativo necesita los ángulos de Investigación).",
    input_schema: {
      type: "object",
      properties: {
        area: {
          type: "string",
          enum: AREA_KEYS,
          description:
            "Área a la que delegas: research (Investigación/Estrategia), creative (Creativo), content (Contenido), media (Medios/Performance).",
        },
        objective: {
          type: "string",
          description: "Objetivo claro y accionable para esa área.",
        },
        context: {
          type: "string",
          description: "Contexto relevante: insights, ángulos, restricciones, etc.",
        },
      },
      required: ["area", "objective"],
    },
  },
  handler: async (input, ctx) => {
    const area = input.area as AreaKey;
    if (!AREA_KEYS.includes(area)) {
      return `Área inválida: ${input.area}. Usa una de: ${AREA_KEYS.join(", ")}.`;
    }
    const enabled = getEnabledAreas(ctx.campaignId);
    if (enabled && !enabled.includes(area)) {
      return `El usuario NO activó el área "${AREAS[area].short}" para esta campaña. No la ejecutes; continúa solo con las áreas activas (${enabled
        .map((a) => AREAS[a].short)
        .join(", ")}).`;
    }
    const summary = await ctx.runChild({
      kind: "area",
      area,
      role: AREAS[area].label,
      objective: input.objective,
      context: input.context,
      parentNodeId: ctx.agentId,
    });
    return `El área "${AREAS[area].short}" completó su trabajo.\nResumen:\n${summary}`;
  },
};

// request_user_input — pide aprobación/decisión al humano sin bloquear el avance.
export const requestUserInput: ToolDef = {
  schema: {
    name: "request_user_input",
    description:
      "Surface una pregunta o decisión al usuario humano (p. ej. aprobar la producción final de anuncios). No bloquea: la pregunta aparece en la UI y tú continúas con un supuesto razonable.",
    input_schema: {
      type: "object",
      properties: {
        question: { type: "string", description: "La pregunta o decisión para el usuario." },
        options: {
          type: "array",
          items: { type: "string" },
          description: "Opciones sugeridas (si aplica).",
        },
      },
      required: ["question"],
    },
  },
  handler: async (input, ctx) => {
    const question = String(input.question ?? "");
    const options = Array.isArray(input.options) ? input.options : [];
    ctx.emit("user_input_request", { payload: { question, options } });
    // Persiste la pregunta para que sobreviva a recargas/rehidratación del snapshot.
    await addMessage({
      agentId: ctx.agentId,
      campaignId: ctx.campaignId,
      role: "assistant",
      content: { type: "user_request", question, options },
    });
    return "La solicitud se mostró al usuario en la UI. No bloquees el avance: continúa con un supuesto razonable y deja esto marcado como pendiente de aprobación del usuario.";
  },
};

// spawn_subagent — un área abre un subagente de tarea (limitado por profundidad).
export const spawnSubagent: ToolDef = {
  schema: {
    name: "spawn_subagent",
    description:
      "Abre un subagente para una tarea acotada (ej. producir un concepto específico, profundizar un ángulo). El subagente trabaja y te devuelve un resumen.",
    input_schema: {
      type: "object",
      properties: {
        task: { type: "string", description: "Tarea concreta para el subagente." },
        role: { type: "string", description: "Rol/nombre del subagente (ej. 'Concepto A')." },
      },
      required: ["task"],
    },
  },
  handler: async (input, ctx) => {
    if (ctx.area === "director") {
      return "El Director no abre subagentes directamente; delega a las áreas.";
    }
    const summary = await ctx.runChild({
      kind: "subagent",
      area: ctx.area,
      role: input.role || "Subagente",
      objective: input.task,
      parentNodeId: ctx.agentId,
    });
    return `Subagente "${input.role || "Subagente"}" completó la tarea.\nResumen:\n${summary}`;
  },
};
