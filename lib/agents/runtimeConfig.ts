import type { AreaKey } from "../types";

// Configuración por campaña que el usuario fija ANTES de ejecutar (pop-up de lanzamiento):
// qué áreas se activan y un intake opcional para afinar la estrategia.
// Vive en memoria (como las conversaciones/runs); sobrevive al HMR vía globalThis.

export interface CampaignIntake {
  product?: string; // marca / producto en 1 línea
  audience?: string; // audiencia objetivo
  budget?: string; // presupuesto disponible
  channels?: string; // canales (Meta, TikTok, etc.)
  productImageUrl?: string; // foto de referencia del producto (URL)
  notes?: string; // cualquier otra cosa
}

export interface CampaignConfig {
  areas: AreaKey[]; // áreas habilitadas
  intake?: CampaignIntake;
}

const g = globalThis as unknown as { __orbitaCfg?: Map<string, CampaignConfig> };
if (!g.__orbitaCfg) g.__orbitaCfg = new Map();
const cfgs = g.__orbitaCfg;

export function setCampaignConfig(id: string, cfg: CampaignConfig): void {
  cfgs.set(id, cfg);
}

export function getCampaignConfig(id: string): CampaignConfig | undefined {
  return cfgs.get(id);
}

export function getEnabledAreas(id: string): AreaKey[] | undefined {
  return cfgs.get(id)?.areas;
}

/** Bloque de intake en texto plano para inyectar en el prompt del Director. */
export function intakeToText(intake?: CampaignIntake): string {
  if (!intake) return "";
  const lines: string[] = [];
  if (intake.product) lines.push(`- Producto/marca: ${intake.product}`);
  if (intake.audience) lines.push(`- Audiencia: ${intake.audience}`);
  if (intake.budget) lines.push(`- Presupuesto disponible: ${intake.budget}`);
  if (intake.channels) lines.push(`- Canales: ${intake.channels}`);
  if (intake.productImageUrl)
    lines.push(`- Foto de referencia del producto (URL): ${intake.productImageUrl}`);
  if (intake.notes) lines.push(`- Notas: ${intake.notes}`);
  return lines.join("\n");
}
