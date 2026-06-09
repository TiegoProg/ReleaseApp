import { addDeliverable, getDeliverables } from "../store";
import type { RunContext, ToolDef } from "./context";
import type { AreaKey, DeliverableRecord } from "../types";

// Guarda un entregable en el board compartido y emite el evento para la UI.
export async function saveDeliverable(
  ctx: RunContext,
  input: { type: string; title: string; payload: unknown }
): Promise<DeliverableRecord> {
  const area = (ctx.area === "director" ? "director" : ctx.area) as AreaKey | "director";
  const d = await addDeliverable({
    campaignId: ctx.campaignId,
    area,
    type: input.type,
    title: input.title,
    payload: input.payload,
  });
  ctx.emit("deliverable", {
    payload: {
      deliverableId: d.id,
      area: d.area,
      type: d.type,
      title: d.title,
      payload: d.payload,
    },
  });
  return d;
}

export const readBoard: ToolDef = {
  schema: {
    name: "read_board",
    description:
      "Lee el board compartido de la campaña: todos los entregables producidos por las demás áreas (briefs, copys, guiones, presupuestos, imágenes, videos). Úsalo para coordinarte con el trabajo de los otros agentes antes de producir el tuyo.",
    input_schema: {
      type: "object",
      properties: {
        area: {
          type: "string",
          description:
            "Opcional. Filtra por área: research | creative | content | media | director.",
        },
      },
    },
  },
  handler: async (input, ctx) => {
    const all = await getDeliverables(ctx.campaignId);
    const filtered = input?.area ? all.filter((d) => d.area === input.area) : all;
    if (filtered.length === 0) {
      return "El board está vacío por ahora. Ningún área ha publicado entregables todavía.";
    }
    return filtered
      .map(
        (d) =>
          `• [${d.area}/${d.type}] ${d.title}\n${JSON.stringify(d.payload).slice(0, 800)}`
      )
      .join("\n\n");
  },
};
