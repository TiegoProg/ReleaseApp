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
  seen: Set<string>;

  setConfig: (c: ConfigStatus) => void;
  reset: () => void;
  setCampaign: (id: string, goal: string) => void;
  selectNode: (id: string | null) => void;
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
      seen: new Set<string>(),
    }),

  setCampaign: (id, goal) =>
    set({ campaignId: id, goal, status: "running" }),

  selectNode: (id) => set({ selectedNodeId: id }),

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
      seen: new Set<string>(),
    });
  },
}));
