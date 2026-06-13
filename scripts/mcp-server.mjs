// ============================================================================
// Orbita Studio MCP Server — expone el estudio UGC como tools MCP (stdio) para
// que Claude (Fable) opere la producción de ads igual que con Higgsfield MCP:
// personas, render plans, producciones con gate y presupuesto, QA y escenas.
//
// Protocolo: MCP sobre stdio (JSON-RPC 2.0, un mensaje por línea). Sin SDK —
// implementación mínima y sin dependencias.
//
// Backend: la API HTTP de Orbita (dev server). Config por env:
//   ORBITA_BASE (default http://localhost:3000)
//
// Registro para Claude Code: .mcp.json en la raíz del repo (ya incluido).
// Regla de gasto: start_ugc_production exige approve:true explícito; todo lo
// demás es gratis (planes, estados, QA, listados).
// ============================================================================

import { createInterface } from "node:readline";

const BASE = process.env.ORBITA_BASE || "http://localhost:3000";
const SERVER_INFO = { name: "orbita-studio", version: "1.0.0" };

// --- helpers -----------------------------------------------------------------

async function api(path, init) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new Error(
      `No pude conectar con Orbita en ${BASE}. ¿Está corriendo el dev server? (npm run dev)`
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status} en ${path}`);
  return data;
}

const SHOT_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "Nombre del shot (p.ej. 'Shot 1 · hook')." },
    prompt: {
      type: "string",
      description:
        "Prompt visual del shot (acción, emoción, micro-expresiones, gestos). NO incluyas locks ni negative instructions: el motor los estampa server-side.",
    },
    script: {
      type: "string",
      description: "Guion hablado del shot (→ voz TTS @Audio1, lip-sync). 18-25 palabras para 8s.",
    },
  },
  required: ["prompt"],
};

const LOCK_SCHEMA = {
  type: "object",
  description:
    "Consistency lock de la secuencia (se estampa en TODOS los shots). camera acepta una key de list_studio_presets (p.ej. 'selfie-handheld') o texto libre.",
  properties: {
    outfit: { type: "string" },
    background: { type: "string" },
    lighting: { type: "string" },
    camera: { type: "string" },
    emotionArc: { type: "string" },
    gestures: { type: "string" },
    product: { type: "string" },
    extra: { type: "string" },
  },
};

const PRODUCTION_INPUT = {
  type: "object",
  properties: {
    personaId: { type: "string", description: "Id de la persona (ver list_personas)." },
    title: { type: "string", description: "Nombre de la campaña/concepto." },
    shots: { type: "array", items: SHOT_SCHEMA, description: "Secuencia de shots (1-8)." },
    scenePrompt: {
      type: "string",
      description:
        "Prompt del set compartido (@Image2, sin personas) — se genera UNA vez para continuidad de fondo.",
    },
    sceneUrl: { type: "string", description: "URL de una escena ya generada (reutilización)." },
    extraImageUrls: {
      type: "array",
      items: { type: "string" },
      description: "Refs extra (@Image3…), p.ej. packshot real del producto.",
    },
    lock: LOCK_SCHEMA,
    model: { type: "string", description: "Override del modelo Seedance (default: standard)." },
    seed: { type: "number", description: "Seed de movimiento (reproducibilidad)." },
    gate: {
      type: "boolean",
      description: "true (default): shot 1 renderiza primero como gate de gasto.",
    },
    budgetUsd: { type: "number", description: "Cap duro de gasto de la producción (default $10)." },
  },
  required: ["personaId", "title", "shots"],
};

// --- tools -------------------------------------------------------------------

const TOOLS = [
  {
    name: "list_personas",
    description:
      "Lista las personas (avatares consistentes) del estudio: id, nombre, voz pineada, idioma y clips producidos. Úsalo para obtener el personaId antes de producir.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const { personas } = await api("/api/avatar");
      return personas.map((p) => ({
        id: p.id,
        name: p.name,
        identity: p.identity,
        voiceName: p.voiceName,
        language: p.language,
        product: p.product,
        videos: (p.videos ?? []).length,
        avatarUrl: p.avatarUrl,
      }));
    },
  },
  {
    name: "list_studio_presets",
    description:
      "Catálogo del estudio: presets de cámara UGC (keys usables en lock.camera) y templates de formato (testimonial / demo / hook-broll) con sus campos.",
    inputSchema: { type: "object", properties: {} },
    handler: () => api("/api/ugc/presets"),
  },
  {
    name: "plan_ugc_production",
    description:
      "DRY-RUN de una producción multi-shot: devuelve el render plan (modelo, shots, costo por clip, estimado total, presupuesto, gate) SIN gastar nada. Úsalo SIEMPRE antes de start_ugc_production y muestra el plan al usuario.",
    inputSchema: PRODUCTION_INPUT,
    handler: async (args) => {
      const data = await api("/api/ugc/produce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...args, approve: false }),
      });
      return data.plan;
    },
  },
  {
    name: "start_ugc_production",
    description:
      "Lanza una producción REAL (gasta dinero): genera escena compartida + voz de todos los shots (la voz primero — si falla, aborta sin gastar) y encola el shot gate en Seedance. Requiere approve:true EXPLÍCITO — solo después de que el usuario aprobó el render plan. Avanza el estado con get_production_status.",
    inputSchema: {
      ...PRODUCTION_INPUT,
      properties: {
        ...PRODUCTION_INPUT.properties,
        approve: {
          type: "boolean",
          description: "DEBE ser true y solo tras aprobación explícita del usuario.",
        },
      },
      required: [...PRODUCTION_INPUT.required, "approve"],
    },
    handler: async (args) => {
      if (args.approve !== true) {
        throw new Error(
          "Producción NO lanzada: falta approve:true. Muestra el plan (plan_ugc_production) y pide aprobación al usuario primero."
        );
      }
      const data = await api("/api/ugc/produce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      return data.production;
    },
  },
  {
    name: "get_production_status",
    description:
      "Estado de una producción Y avance del pipeline: pollea los renders, aplica la lógica de gate (OK → encola el resto; falla → protege presupuesto). Llamar en loop cada ~15s hasta status ready/partial/failed.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Id de la producción." } },
      required: ["id"],
    },
    handler: async ({ id }) => {
      const { production } = await api(`/api/ugc/produce/status?id=${encodeURIComponent(id)}`);
      return production;
    },
  },
  {
    name: "list_productions",
    description: "Lista las producciones del estudio (recientes primero) con estado y gasto.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const { productions } = await api("/api/ugc/produce");
      return productions.map((p) => ({
        id: p.id,
        title: p.title,
        persona: p.personaName,
        status: p.status,
        shots: p.shots.map((s) => ({ name: s.name, status: s.status, videoUrl: s.videoUrl })),
        spentUsd: p.spentUsd,
        budgetUsd: p.budgetUsd,
        createdAt: p.createdAt,
      }));
    },
  },
  {
    name: "record_shot_qa",
    description:
      "Registra el QA scorecard de un shot (AI_UGC_SYSTEM.md §QA): scores 1-10 (hook, realismo, lip-sync, manos, etc.), decisión (keep / edit-in-post / regenerate / change-concept), el issue exacto y el prompt patch si aplica.",
    inputSchema: {
      type: "object",
      properties: {
        productionId: { type: "string" },
        shotIndex: { type: "number", description: "0-based." },
        scores: {
          type: "object",
          description: "Ejes del scorecard → score 1-10 (p.ej. {\"lipSync\": 8, \"handRealism\": 6}).",
          additionalProperties: { type: "number" },
        },
        decision: { type: "string", enum: ["keep", "edit-in-post", "regenerate", "change-concept"] },
        exactIssue: { type: "string" },
        promptPatch: { type: "string", description: "Parche SOLO de la sección que falló." },
        notes: { type: "string" },
      },
      required: ["productionId", "shotIndex"],
    },
    handler: (args) =>
      api("/api/ugc/produce/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      }).then((d) => d.production.shots[args.shotIndex]),
  },
  {
    name: "preview_voice",
    description:
      "Genera SOLO la voz de una persona (sin video, sin gastar en Seedance) y devuelve la URL del audio. Úsala para validar pronunciación, pausas y tags de emoción de eleven v3 ([laughs], [sighs], [excited]) ANTES de aprobar una producción paga.",
    inputSchema: {
      type: "object",
      properties: {
        personaId: { type: "string", description: "Id de la persona (list_personas)." },
        text: {
          type: "string",
          description: "Guion a vocalizar (≤600 chars). Con eleven v3 acepta tags como [laughs].",
        },
      },
      required: ["personaId", "text"],
    },
    handler: (args) =>
      api("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      }),
  },
  {
    name: "generate_scene",
    description:
      "Genera un frame de escenario/set SIN personas (GPT Image) y devuelve su URL permanente. Úsalo para crear el @Image2 compartido de una secuencia, o pásalo como sceneUrl a la producción.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Descripción fotorrealista del set, vacío de gente." },
        aspect: { type: "string", enum: ["9:16", "16:9", "1:1"], description: "Default 9:16." },
      },
      required: ["prompt"],
    },
    handler: (args) =>
      api("/api/scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      }),
  },
];

// --- MCP wire protocol (JSON-RPC 2.0 por línea sobre stdio) -------------------

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function result(id, res) {
  send({ jsonrpc: "2.0", id, result: res });
}

function rpcError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

async function handle(msg) {
  const { id, method, params } = msg;
  if (method === "initialize") {
    return result(id, {
      protocolVersion: params?.protocolVersion ?? "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    });
  }
  if (method === "notifications/initialized" || method === "notifications/cancelled") return;
  if (method === "ping") return result(id, {});
  if (method === "tools/list") {
    return result(id, {
      tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
    });
  }
  if (method === "tools/call") {
    const tool = TOOLS.find((t) => t.name === params?.name);
    if (!tool) return rpcError(id, -32602, `Tool desconocida: ${params?.name}`);
    try {
      const res = await tool.handler(params?.arguments ?? {});
      return result(id, {
        content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
      });
    } catch (e) {
      return result(id, {
        content: [{ type: "text", text: String(e?.message ?? e) }],
        isError: true,
      });
    }
  }
  if (id !== undefined) rpcError(id, -32601, `Método no soportado: ${method}`);
}

const rl = createInterface({ input: process.stdin, terminal: false });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return; // línea no-JSON: la ignoramos (robustez ante ruido en stdio)
  }
  handle(msg).catch((e) => {
    if (msg?.id !== undefined) rpcError(msg.id, -32603, String(e?.message ?? e));
  });
});
