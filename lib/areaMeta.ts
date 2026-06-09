// Metadatos de presentación para la "planta de la agencia".
// La lógica/arquitectura (AREAS en types.ts) no cambia; esto solo enriquece la UI.

import type { AgentStatus, AreaKey } from "./types";

// Identidad de marca (centralizada para renombrar en un solo sitio).
export const BRAND = "Agencia";
export const BRAND_TAGLINE = "marketing agéntico";

export type RoomKey = AreaKey | "director";
export type IconName =
  | "research"
  | "creative"
  | "content"
  | "media"
  | "director";

export interface AreaMeta {
  key: RoomKey;
  label: string;
  short: string;
  tagline: string;
  color: string; // acento sólido
  from: string; // gradiente
  to: string;
  icon: IconName;
}

export const ROOMS: Record<RoomKey, AreaMeta> = {
  director: {
    key: "director",
    label: "Dirección",
    short: "Núcleo",
    tagline: "Descompone el objetivo y delega a cada sala.",
    color: "#f59e0b",
    from: "#fbbf24",
    to: "#f97316",
    icon: "director",
  },
  research: {
    key: "research",
    label: "Investigación / Estrategia",
    short: "Investigación",
    tagline: "Audiencia, ángulos de campaña y split de presupuesto.",
    color: "#0ea5e9",
    from: "#38bdf8",
    to: "#0284c7",
    icon: "research",
  },
  creative: {
    key: "creative",
    label: "Creativo",
    short: "Creativo",
    tagline: "Conceptos, copys, imágenes y video por ángulo.",
    color: "#ec4899",
    from: "#f472b6",
    to: "#db2777",
    icon: "creative",
  },
  content: {
    key: "content",
    label: "Contenido",
    short: "Contenido",
    tagline: "Guiones, temas y calendario editorial.",
    color: "#8b5cf6",
    from: "#a78bfa",
    to: "#7c3aed",
    icon: "content",
  },
  media: {
    key: "media",
    label: "Medios / Performance",
    short: "Medios",
    tagline: "Plan de pauta, ad sets, presupuesto y KPIs.",
    color: "#10b981",
    from: "#34d399",
    to: "#059669",
    icon: "media",
  },
};

export const AREA_ROOM_KEYS: AreaKey[] = ["research", "creative", "content", "media"];

export interface StatusMeta {
  label: string;
  color: string;
  tint: string; // fondo suave
  live: boolean; // muestra animación "viva"
}

export const STATUS_META: Record<AgentStatus, StatusMeta> = {
  idle: { label: "En espera", color: "#64748b", tint: "rgba(100,116,139,0.12)", live: false },
  thinking: { label: "Pensando", color: "#7c3aed", tint: "rgba(124,58,237,0.12)", live: true },
  tool: { label: "Ejecutando", color: "#0891b2", tint: "rgba(8,145,178,0.12)", live: true },
  waiting: { label: "Espera al humano", color: "#d97706", tint: "rgba(217,119,6,0.14)", live: true },
  done: { label: "Listo", color: "#16a34a", tint: "rgba(22,163,74,0.12)", live: false },
  error: { label: "Error", color: "#dc2626", tint: "rgba(220,38,38,0.12)", live: false },
};

// Etiquetas legibles para tipos de entregable
export const DELIVERABLE_LABEL: Record<string, string> = {
  brief: "Brief estratégico",
  copy: "Copy",
  script: "Guion",
  calendar: "Calendario",
  image: "Imagen",
  video: "Video",
  budget: "Presupuesto",
  channel_plan: "Plan de pauta",
};

export function deliverableLabel(type: string): string {
  return DELIVERABLE_LABEL[type] ?? type;
}

export function roomOf(area: string | null, kind: string): RoomKey {
  if (kind === "director") return "director";
  return (area as AreaKey) ?? "research";
}
