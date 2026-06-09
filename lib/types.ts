// Tipos compartidos de Orbita (cliente + servidor)

export type AreaKey = "research" | "creative" | "content" | "media";
export type NodeKind = "director" | "area" | "subagent";

export type AgentStatus =
  | "idle"
  | "thinking"
  | "tool"
  | "waiting"
  | "done"
  | "error";

// Metadatos de cada area para la UI
export const AREAS: Record<AreaKey, { label: string; short: string; color: string }> = {
  research: { label: "Investigacion / Estrategia", short: "Investigacion", color: "#38bdf8" },
  creative: { label: "Creativo", short: "Creativo", color: "#f472b6" },
  content: { label: "Contenido", short: "Contenido", color: "#a78bfa" },
  media: { label: "Medios / Performance", short: "Medios", color: "#34d399" },
};

export const AREA_KEYS = Object.keys(AREAS) as AreaKey[];

export interface AgentRecord {
  id: string;
  campaignId: string;
  kind: NodeKind;
  area: AreaKey | null; // null para el director
  role: string; // nombre legible
  status: AgentStatus;
  parentId: string | null;
  createdAt: string;
}

export interface MessageRecord {
  id: string;
  agentId: string;
  campaignId: string;
  role: "system" | "user" | "assistant" | "tool";
  // content_json: bloque flexible (texto, tool_call, tool_result)
  content: MessageContent;
  createdAt: string;
}

export type MessageContent =
  | { type: "text"; text: string }
  | { type: "tool_call"; tool: string; input: unknown }
  | { type: "tool_result"; tool: string; summary: string }
  | { type: "user_instruction"; text: string };

export interface DeliverableRecord {
  id: string;
  campaignId: string;
  area: AreaKey | "director";
  type: string; // "brief" | "copy" | "script" | "calendar" | "image" | "video" | "budget" | "channel_plan"
  title: string;
  payload: unknown;
  createdAt: string;
}

export interface CampaignRecord {
  id: string;
  goal: string;
  status: "running" | "done" | "error";
  createdAt: string;
}

// ---- Eventos que viajan por SSE hacia la UI ----

export type AgentEventType =
  | "campaign_created"
  | "agent_created"
  | "agent_status"
  | "text"
  | "tool_call"
  | "tool_result"
  | "deliverable"
  | "link_active"
  | "user_input_request"
  | "done"
  | "error";

export interface AgentEvent {
  id: string;
  type: AgentEventType;
  campaignId: string;
  agentId?: string;
  // para link_active: from/to son ids de nodos
  from?: string;
  to?: string;
  payload?: any;
  ts: string;
}

export interface CampaignSnapshot {
  campaign: CampaignRecord;
  agents: AgentRecord[];
  messages: MessageRecord[];
  deliverables: DeliverableRecord[];
}

export interface ConfigStatus {
  hasAnthropic: boolean;
  hasSupabase: boolean;
  hasOpenAI: boolean;
  hasKling: boolean;
}
