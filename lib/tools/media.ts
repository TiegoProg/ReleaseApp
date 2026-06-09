import type { ToolDef } from "./context";
import { saveDeliverable } from "./board";

export const allocateBudget: ToolDef = {
  schema: {
    name: "allocate_budget",
    description:
      "Publica una distribución de presupuesto en el board: monto total y splits por canal y fase (prueba vs escala).",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        total: { type: "string", description: "Presupuesto total (con moneda)." },
        splits: {
          type: "array",
          items: {
            type: "object",
            properties: {
              channel: { type: "string" },
              amount: { type: "string" },
              phase: { type: "string", description: "Ej: prueba | escala." },
            },
            required: ["channel", "amount"],
          },
        },
      },
      required: ["title", "total", "splits"],
    },
  },
  handler: async (input, ctx) => {
    await saveDeliverable(ctx, { type: "budget", title: input.title, payload: input });
    return `Distribución de presupuesto "${input.title}" publicada (total ${input.total}).`;
  },
};

export const channelPlan: ToolDef = {
  schema: {
    name: "channel_plan",
    description:
      "Publica un plan de pauta en el board: por canal, su objetivo, estructura de testing y KPIs de corte.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        channels: {
          type: "array",
          items: {
            type: "object",
            properties: {
              channel: { type: "string" },
              objective: { type: "string" },
              testing: { type: "string", description: "Estructura de testing / ad sets." },
              kpis: { type: "string", description: "KPIs de corte." },
            },
            required: ["channel", "objective"],
          },
        },
      },
      required: ["title", "channels"],
    },
  },
  handler: async (input, ctx) => {
    await saveDeliverable(ctx, { type: "channel_plan", title: input.title, payload: input });
    return `Plan de pauta "${input.title}" publicado con ${input.channels?.length ?? 0} canales.`;
  },
};
