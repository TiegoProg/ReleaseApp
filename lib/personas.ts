import { randomUUID } from "crypto";

// ============================================================================
// Roster de personas (avatares reutilizables) — modelo HÍBRIDO:
// se generan por concepto, pero se pueden guardar y reutilizar entre campañas.
// Cada persona guarda sus ANCLAS de coherencia: avatar héroe, sheet, voz fija y
// seed de movimiento. Vive en memoria (sobrevive HMR vía globalThis).
// ============================================================================

export interface PersonaVideo {
  url: string;
  script: string;
  preset?: string;
  createdAt: string;
}

export interface Persona {
  id: string;
  name: string;
  avatarUrl: string; // retrato héroe (ancla de identidad visual)
  sheetUrl: string; // character sheet
  sourceUrl?: string; // foto de referencia entregada
  identity: string; // descriptor textual
  voiceName: string; // voz pineada (Gemini TTS) — ancla de voz
  language: string; // idioma de la voz
  seed: number; // seed de movimiento (Seedance) — reproducibilidad
  product?: string; // producto asociado
  mode: string; // motor / stub
  videos: PersonaVideo[]; // clips UGC generados (persistidos)
  createdAt: string;
}

// Voces de Gemini TTS rotadas por defecto (determinista por persona).
const VOICES = ["Kore", "Puck", "Charon", "Aoede", "Leda", "Zephyr", "Enceladus", "Sulafat"];

const g = globalThis as unknown as { __orbitaPersonas?: Map<string, Persona> };
if (!g.__orbitaPersonas) g.__orbitaPersonas = new Map();
const store = g.__orbitaPersonas;

export function createPersona(input: {
  name?: string;
  avatarUrl: string;
  sheetUrl: string;
  sourceUrl?: string;
  identity: string;
  product?: string;
  mode: string;
  voiceName?: string;
  language?: string;
}): Persona {
  const id = randomUUID();
  const persona: Persona = {
    id,
    name: input.name?.trim() || personaName(input.identity),
    avatarUrl: input.avatarUrl,
    sheetUrl: input.sheetUrl,
    sourceUrl: input.sourceUrl,
    identity: input.identity,
    voiceName: input.voiceName || VOICES[store.size % VOICES.length],
    language: input.language || "es-ES",
    seed: Math.floor(Math.random() * 1_000_000),
    product: input.product,
    mode: input.mode,
    videos: [],
    createdAt: new Date().toISOString(),
  };
  store.set(id, persona);
  return persona;
}

// Adjunta un clip generado a la persona (galería persistente).
export function addPersonaVideo(id: string, video: PersonaVideo): Persona | undefined {
  const p = store.get(id);
  if (!p) return undefined;
  p.videos = [video, ...(p.videos ?? [])];
  store.set(id, p);
  return p;
}

export function listPersonas(): Persona[] {
  return Array.from(store.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getPersona(id: string): Persona | undefined {
  return store.get(id);
}

function personaName(identity: string): string {
  const first = identity.split(/[,.·]/)[0]?.trim() || "Avatar";
  return first.length > 28 ? first.slice(0, 28) + "…" : first;
}
