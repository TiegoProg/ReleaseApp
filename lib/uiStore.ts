"use client";

import { create } from "zustand";
import type {
  AgentEvent,
  AgentStatus,
  AreaKey,
  CampaignSnapshot,
  ConfigStatus,
  NodeKind,
} from "./types";
import type { RoomKey } from "./areaMeta";

export interface NodeData {
  id: string;
  kind: NodeKind;
  area: AreaKey | null;
  role: string;
  status: AgentStatus;
  parentId: string | null;
}

export type Entry =
  | { kind: "text"; role: "assistant" | "user"; text: string; open?: boolean }
  | { kind: "tool_call"; tool: string; input: any }
  | { kind: "tool_result"; tool: string; summary: string }
  | { kind: "deliverable"; dtype: string; title: string; area: string; payload: any }
  | { kind: "request"; question: string; options: string[] }
  | { kind: "error"; message: string };

export interface DeliverableLite {
  id: string;
  area: string;
  type: string;
  title: string;
  payload: any;
}

interface UiState {
  config: ConfigStatus | null;
  campaignId: string | null;
  goal: string;
  status: "idle" | "running" | "done" | "error";
  nodes: Record<string, NodeData>;
  nodeOrder: string[];
  transcripts: Record<string, Entry[]>;
  deliverables: DeliverableLite[];
  linkPulses: Record<string, number>; // "from->to" -> expiry ms
  selectedNodeId: string | null;
  selectedRoom: RoomKey | null; // sala (área o dirección) abierta en el panel
  openDeliverable: DeliverableLite | null; // entregable abierto en el lector
  seen: Set<string>;

  setConfig: (c: ConfigStatus) => void;
  reset: () => void;
  setCampaign: (id: string, goal: string) => void;
  selectNode: (id: string | null) => void;
  selectRoom: (room: RoomKey | null) => void;
  setOpenDeliverable: (d: DeliverableLite | null) => void;
  applyEvent: (ev: AgentEvent) => void;
  buildFromSnapshot: (snap: CampaignSnapshot) => void;
}

const PULSE_MS = 1500;

function upsertNode(state: UiState, n: NodeData) {
  if (!state.nodes[n.id]) state.nodeOrder = [...state.nodeOrder, n.id];
  state.nodes = { ...state.nodes, [n.id]: { ...state.nodes[n.id], ...n } };
}

function pushEntry(state: UiState, agentId: string, entry: Entry) {
  const arr = state.transcripts[agentId] ? [...state.transcripts[agentId]] : [];
  arr.push(entry);
  state.transcripts = { ...state.transcripts, [agentId]: arr };
}

function closeOpenText(state: UiState, agentId: string) {
  const arr = state.transcripts[agentId];
  if (!arr || arr.length === 0) return;
  const last = arr[arr.length - 1];
  if (last.kind === "text" && last.open) {
    const copy = [...arr];
    copy[copy.length - 1] = { ...last, open: false };
    state.transcripts = { ...state.transcripts, [agentId]: copy };
  }
}

function appendText(
  state: UiState,
  agentId: string,
  role: "assistant" | "user",
  delta: string
) {
  const arr = state.transcripts[agentId] ? [...state.transcripts[agentId]] : [];
  const last = arr[arr.length - 1];
  if (role === "assistant" && last && last.kind === "text" && last.role === "assistant" && last.open) {
    arr[arr.length - 1] = { ...last, text: last.text + delta };
  } else {
    arr.push({ kind: "text", role, text: delta, open: role === "assistant" });
  }
  state.transcripts = { ...state.transcripts, [agentId]: arr };
}

export const useUiStore = create<UiState>((set, get) => ({
  config: null,
  campaignId: null,
  goal: "",
  status: "idle",
  nodes: {},
  nodeOrder: [],
  transcripts: {},
  deliverables: [],
  linkPulses: {},
  selectedNodeId: null,
  selectedRoom: null,
  openDeliverable: null,
  seen: new Set<string>(),

  setConfig: (c) => set({ config: c }),

  reset: () =>
    set({
      campaignId: null,
      goal: "",
      status: "idle",
      nodes: {},
      nodeOrder: [],
      transcripts: {},
      deliverables: [],
      linkPulses: {},
      selectedNodeId: null,
      selectedRoom: null,
      openDeliverable: null,
      seen: new Set<string>(),
    }),

  setCampaign: (id, goal) =>
    set({ campaignId: id, goal, status: "running" }),

  selectNode: (id) => set({ selectedNodeId: id }),

  selectRoom: (room) => set({ selectedRoom: room }),

  setOpenDeliverable: (d) => set({ openDeliverable: d }),

  applyEvent: (ev) => {
    const state = { ...get() } as UiState;
    if (state.seen.has(ev.id)) return;
    state.seen.add(ev.id);

    switch (ev.type) {
      case "campaign_created":
        state.goal = ev.payload?.goal ?? state.goal;
        state.status = "running";
        break;
      case "agent_created":
        if (ev.payload?.node) upsertNode(state, ev.payload.node as NodeData);
        break;
      case "agent_status":
        if (ev.agentId && state.nodes[ev.agentId]) {
          state.nodes = {
            ...state.nodes,
            [ev.agentId]: { ...state.nodes[ev.agentId], status: ev.payload.status as AgentStatus },
          };
        }
        break;
      case "text":
        if (ev.agentId) appendText(state, ev.agentId, ev.payload?.role ?? "assistant", ev.payload?.delta ?? "");
        break;
      case "tool_call":
        if (ev.agentId) {
          closeOpenText(state, ev.agentId);
          pushEntry(state, ev.agentId, { kind: "tool_call", tool: ev.payload?.tool, input: ev.payload?.input });
        }
        break;
      case "tool_result":
        if (ev.agentId)
          pushEntry(state, ev.agentId, { kind: "tool_result", tool: ev.payload?.tool, summary: ev.payload?.summary ?? "" });
        break;
      case "deliverable": {
        const p = ev.payload ?? {};
        const d: DeliverableLite = {
          id: p.deliverableId,
          area: p.area,
          type: p.type,
          title: p.title,
          payload: p.payload,
        };
        if (!state.deliverables.find((x) => x.id === d.id)) {
          state.deliverables = [...state.deliverables, d];
        }
        if (ev.agentId)
          pushEntry(state, ev.agentId, {
            kind: "deliverable",
            dtype: d.type,
            title: d.title,
            area: d.area,
            payload: d.payload,
          });
        break;
      }
      case "link_active":
        if (ev.from && ev.to) {
          state.linkPulses = { ...state.linkPulses, [`${ev.from}->${ev.to}`]: Date.now() + PULSE_MS };
        }
        break;
      case "user_input_request":
        if (ev.agentId)
          pushEntry(state, ev.agentId, {
            kind: "request",
            question: ev.payload?.question ?? "",
            options: ev.payload?.options ?? [],
          });
        break;
      case "error":
        if (ev.agentId) pushEntry(state, ev.agentId, { kind: "error", message: ev.payload?.message ?? "Error" });
        break;
      case "done":
        state.status = ev.payload?.status === "error" ? "error" : "done";
        break;
    }

    set(state);
  },

  buildFromSnapshot: (snap) => {
    const nodes: Record<string, NodeData> = {};
    const nodeOrder: string[] = [];
    for (const a of snap.agents) {
      nodes[a.id] = {
        id: a.id,
        kind: a.kind,
        area: a.area,
        role: a.role,
        status: a.status,
        parentId: a.parentId,
      };
      nodeOrder.push(a.id);
    }

    const transcripts: Record<string, Entry[]> = {};
    for (const m of snap.messages) {
      const arr = transcripts[m.agentId] ?? (transcripts[m.agentId] = []);
      const c = m.content as any;
      if (c.type === "text") arr.push({ kind: "text", role: "assistant", text: c.text, open: false });
      else if (c.type === "user_instruction") arr.push({ kind: "text", role: "user", text: c.text });
      else if (c.type === "tool_call") arr.push({ kind: "tool_call", tool: c.tool, input: c.input });
      else if (c.type === "tool_result") arr.push({ kind: "tool_result", tool: c.tool, summary: c.summary });
      else if (c.type === "user_request")
        arr.push({ kind: "request", question: c.question, options: c.options ?? [] });
    }

    const deliverables: DeliverableLite[] = snap.deliverables.map((d) => ({
      id: d.id,
      area: d.area,
      type: d.type,
      title: d.title,
      payload: d.payload,
    }));

    set({
      campaignId: snap.campaign.id,
      goal: snap.campaign.goal,
      status: snap.campaign.status,
      nodes,
      nodeOrder,
      transcripts,
      deliverables,
      linkPulses: {},
      selectedNodeId: null,
      selectedRoom: null,
      openDeliverable: null,
      seen: new Set<string>(),
    });
  },
}));

// ---- Selectores derivados para la planta de la agencia ----

export interface RoomStats {
  agents: number;
  deliverables: number;
  status: AgentStatus; // estado representativo de la sala
  active: boolean; // hay un agente pensando/ejecutando
}

const STATUS_PRIORITY: AgentStatus[] = [
  "error",
  "waiting",
  "tool",
  "thinking",
  "done",
  "idle",
];

/** Resume el estado de una sala (área o dirección) a partir de sus agentes. */
export function roomStats(state: UiState, room: RoomKey): RoomStats {
  const nodes = Object.values(state.nodes).filter((n) =>
    room === "director" ? n.kind === "director" : n.area === room
  );
  const dels = state.deliverables.filter((d) =>
    room === "director" ? d.area === "director" : d.area === room
  );

  let status: AgentStatus = "idle";
  if (nodes.length > 0) {
    for (const s of STATUS_PRIORITY) {
      if (nodes.some((n) => n.status === s)) {
        status = s;
        break;
      }
    }
  }

  return {
    agents: nodes.length,
    deliverables: dels.length,
    status,
    active: nodes.some((n) => n.status === "thinking" || n.status === "tool"),
  };
}

export interface RoomSignal {
  needsInput: boolean; // un agente espera tu decisión
  question?: string; // la pregunta pendiente
  options?: string[]; // opciones sugeridas
  lastText?: string; // lo último que dijo (qué está haciendo)
  agentId?: string; // agente relevante (para entrar / responder)
}

/** ¿El agente tiene una pregunta sin responder? (request_user_input es no bloqueante,
 *  así que detectamos un 'request' que no haya sido seguido por una respuesta del usuario). */
export function pendingRequest(
  entries: Entry[] | undefined
): { question: string; options: string[] } | null {
  if (!entries) return null;
  let idx = -1;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].kind === "request") {
      idx = i;
      break;
    }
  }
  if (idx < 0) return null;
  const answered = entries
    .slice(idx + 1)
    .some((e) => e.kind === "text" && e.role === "user");
  if (answered) return null;
  const e = entries[idx];
  return e.kind === "request" ? { question: e.question, options: e.options ?? [] } : null;
}

/** Qué comunica una sala hacia la vista general: actividad y/o petición de ayuda. */
export function roomSignal(state: UiState, room: RoomKey): RoomSignal {
  const agents = Object.values(state.nodes).filter((n) =>
    room === "director" ? n.kind === "director" : n.area === room
  );

  const waiting = agents.find((n) => n.status === "waiting");
  let question: string | undefined;
  let options: string[] | undefined;
  let needAgent: string | undefined;

  // Prioriza el agente en estado waiting; luego cualquier agente con pregunta pendiente.
  const order = waiting ? [waiting, ...agents.filter((a) => a.id !== waiting.id)] : agents;
  for (const a of order) {
    const pr = pendingRequest(state.transcripts[a.id]);
    if (pr) {
      question = pr.question;
      options = pr.options;
      needAgent = a.id;
      break;
    }
  }

  const primary = agents.find((n) => n.kind === "area" || n.kind === "director") ?? agents[0];
  let lastText: string | undefined;
  // Texto más reciente entre los agentes de la sala (prioriza primario, luego subagentes).
  const ordered = primary ? [primary, ...agents.filter((a) => a.id !== primary.id)] : agents;
  for (const a of ordered) {
    const tr = state.transcripts[a.id] ?? [];
    for (let i = tr.length - 1; i >= 0; i--) {
      const e = tr[i];
      if (e.kind === "text" && e.role === "assistant" && e.text.trim()) {
        lastText = e.text.trim();
        break;
      }
    }
    if (lastText) break;
  }

  return {
    needsInput: !!question || !!waiting,
    question,
    options,
    lastText,
    agentId: needAgent ?? primary?.id,
  };
}
