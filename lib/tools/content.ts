import type { ToolDef } from "./context";
import { saveDeliverable } from "./board";

export const writeBrief: ToolDef = {
  schema: {
    name: "write_brief",
    description:
      "Publica un brief estratégico en el board: audiencia objetivo, ángulos de campaña, presupuesto sugerido y resumen del plan. Úsalo cuando termines de definir la estrategia.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Título corto del brief." },
        audience: { type: "string", description: "Descripción de la audiencia objetivo." },
        angles: {
          type: "array",
          items: { type: "string" },
          description: "Lista de ángulos / hipótesis creativas de la campaña.",
        },
        budget: { type: "string", description: "Presupuesto sugerido y su distribución por fase." },
        summary: { type: "string", description: "Resumen del plan estratégico." },
      },
      required: ["title", "audience", "angles", "summary"],
    },
  },
  handler: async (input, ctx) => {
    await saveDeliverable(ctx, { type: "brief", title: input.title, payload: input });
    return `Brief "${input.title}" publicado en el board con ${input.angles?.length ?? 0} ángulos.`;
  },
};

export const writeCopy: ToolDef = {
  schema: {
    name: "write_copy",
    description:
      "Publica un copy de anuncio en el board: hook, cuerpo y CTA para un formato concreto (imagen o video). Úsalo por cada concepto creativo.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        format: { type: "string", enum: ["image", "video"], description: "Formato del anuncio." },
        angle: { type: "string", description: "Ángulo de campaña al que responde." },
        hook: { type: "string", description: "Gancho inicial." },
        body: { type: "string", description: "Cuerpo del mensaje." },
        cta: { type: "string", description: "Llamado a la acción." },
      },
      required: ["title", "format", "hook", "body", "cta"],
    },
  },
  handler: async (input, ctx) => {
    await saveDeliverable(ctx, { type: "copy", title: input.title, payload: input });
    return `Copy "${input.title}" (${input.format}) publicado en el board.`;
  },
};

export const writeScript: ToolDef = {
  schema: {
    name: "write_script",
    description:
      "Publica un guion de video en el board: tema, gancho, desarrollo, cierre/CTA y duración estimada.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        topic: { type: "string", description: "Tema del video." },
        hook: { type: "string" },
        body: { type: "string", description: "Desarrollo del guion." },
        cta: { type: "string" },
        duration_seconds: { type: "number", description: "Duración estimada en segundos." },
      },
      required: ["title", "topic", "hook", "body", "cta"],
    },
  },
  handler: async (input, ctx) => {
    await saveDeliverable(ctx, { type: "script", title: input.title, payload: input });
    return `Guion "${input.title}" publicado en el board.`;
  },
};

export const contentCalendar: ToolDef = {
  schema: {
    name: "content_calendar",
    description:
      "Publica un calendario de contenido en el board: lista de piezas con día, tema, formato y notas.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        items: {
          type: "array",
          description: "Piezas del calendario.",
          items: {
            type: "object",
            properties: {
              day: { type: "string" },
              topic: { type: "string" },
              format: { type: "string" },
              notes: { type: "string" },
            },
            required: ["day", "topic", "format"],
          },
        },
      },
      required: ["title", "items"],
    },
  },
  handler: async (input, ctx) => {
    await saveDeliverable(ctx, { type: "calendar", title: input.title, payload: input });
    return `Calendario "${input.title}" publicado con ${input.items?.length ?? 0} piezas.`;
  },
};
