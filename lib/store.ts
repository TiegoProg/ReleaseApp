import { randomUUID } from "crypto";
import { getServerSupabase } from "./supabase";
import type {
  AgentRecord,
  AgentStatus,
  CampaignRecord,
  CampaignSnapshot,
  DeliverableRecord,
  MessageRecord,
  NodeKind,
  AreaKey,
  MessageContent,
} from "./types";

/**
 * Store de Orbita: abstrae la persistencia.
 * - Si Supabase esta configurado, usa las tablas (campaigns, agents, messages, deliverables).
 * - Si no, usa un store en memoria (Map) para que la app corra SOLO con ANTHROPIC_API_KEY.
 *
 * El singleton vive en globalThis para sobrevivir el HMR de `next dev`.
 */

interface MemoryDB {
  campaigns: Map<string, CampaignRecord>;
  agents: Map<string, AgentRecord>;
  messages: MessageRecord[];
  deliverables: DeliverableRecord[];
}

const g = globalThis as unknown as { __orbitaMem?: MemoryDB };
if (!g.__orbitaMem) {
  g.__orbitaMem = {
    campaigns: new Map(),
    agents: new Map(),
    messages: [],
    deliverables: [],
  };
}
const mem = g.__orbitaMem;

function nowISO() {
  return new Date().toISOString();
}

// ---------------- Campaigns ----------------

export async function createCampaign(goal: string): Promise<CampaignRecord> {
  const rec: CampaignRecord = {
    id: randomUUID(),
    goal,
    status: "running",
    createdAt: nowISO(),
  };
  const sb = getServerSupabase();
  if (sb) {
    await sb.from("campaigns").insert({
      id: rec.id,
      goal: rec.goal,
      status: rec.status,
      created_at: rec.createdAt,
    });
  } else {
    mem.campaigns.set(rec.id, rec);
  }
  return rec;
}

export async function setCampaignStatus(
  id: string,
  status: CampaignRecord["status"]
): Promise<void> {
  const sb = getServerSupabase();
  if (sb) {
    await sb.from("campaigns").update({ status }).eq("id", id);
  } else {
    const c = mem.campaigns.get(id);
    if (c) c.status = status;
  }
}

export async function listCampaigns(): Promise<CampaignRecord[]> {
  const sb = getServerSupabase();
  if (sb) {
    const { data } = await sb
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []).map((d: any) => ({
      id: d.id,
      goal: d.goal,
      status: d.status,
      createdAt: d.created_at,
    }));
  }
  return Array.from(mem.campaigns.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

export async function getCampaign(id: string): Promise<CampaignRecord | null> {
  const sb = getServerSupabase();
  if (sb) {
    const { data } = await sb.from("campaigns").select("*").eq("id", id).single();
    if (!data) return null;
    return {
      id: data.id,
      goal: data.goal,
      status: data.status,
      createdAt: data.created_at,
    };
  }
  return mem.campaigns.get(id) ?? null;
}

// ---------------- Agents ----------------

export async function createAgent(input: {
  campaignId: string;
  kind: NodeKind;
  area: AreaKey | null;
  role: string;
  parentId: string | null;
  status?: AgentStatus;
}): Promise<AgentRecord> {
  const rec: AgentRecord = {
    id: randomUUID(),
    campaignId: input.campaignId,
    kind: input.kind,
    area: input.area,
    role: input.role,
    status: input.status ?? "idle",
    parentId: input.parentId,
    createdAt: nowISO(),
  };
  const sb = getServerSupabase();
  if (sb) {
    await sb.from("agents").insert({
      id: rec.id,
      campaign_id: rec.campaignId,
      kind: rec.kind,
      area: rec.area,
      role: rec.role,
      status: rec.status,
      parent_id: rec.parentId,
      created_at: rec.createdAt,
    });
  } else {
    mem.agents.set(rec.id, rec);
  }
  return rec;
}

export async function updateAgentStatus(id: string, status: AgentStatus): Promise<void> {
  const sb = getServerSupabase();
  if (sb) {
    await sb.from("agents").update({ status }).eq("id", id);
  } else {
    const a = mem.agents.get(id);
    if (a) a.status = status;
  }
}

export async function getAgents(campaignId: string): Promise<AgentRecord[]> {
  const sb = getServerSupabase();
  if (sb) {
    const { data } = await sb
      .from("agents")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true });
    return (data ?? []).map((d: any) => ({
      id: d.id,
      campaignId: d.campaign_id,
      kind: d.kind,
      area: d.area,
      role: d.role,
      status: d.status,
      parentId: d.parent_id,
      createdAt: d.created_at,
    }));
  }
  return Array.from(mem.agents.values()).filter((a) => a.campaignId === campaignId);
}

// ---------------- Messages ----------------

export async function addMessage(input: {
  agentId: string;
  campaignId: string;
  role: MessageRecord["role"];
  content: MessageContent;
}): Promise<MessageRecord> {
  const rec: MessageRecord = {
    id: randomUUID(),
    agentId: input.agentId,
    campaignId: input.campaignId,
    role: input.role,
    content: input.content,
    createdAt: nowISO(),
  };
  const sb = getServerSupabase();
  if (sb) {
    await sb.from("messages").insert({
      id: rec.id,
      agent_id: rec.agentId,
      campaign_id: rec.campaignId,
      role: rec.role,
      content_json: rec.content,
      created_at: rec.createdAt,
    });
  } else {
    mem.messages.push(rec);
  }
  return rec;
}

export async function getMessages(campaignId: string): Promise<MessageRecord[]> {
  const sb = getServerSupabase();
  if (sb) {
    const { data } = await sb
      .from("messages")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true });
    return (data ?? []).map((d: any) => ({
      id: d.id,
      agentId: d.agent_id,
      campaignId: d.campaign_id,
      role: d.role,
      content: d.content_json,
      createdAt: d.created_at,
    }));
  }
  return mem.messages.filter((m) => m.campaignId === campaignId);
}

// ---------------- Deliverables (board) ----------------

export async function addDeliverable(input: {
  campaignId: string;
  area: AreaKey | "director";
  type: string;
  title: string;
  payload: unknown;
}): Promise<DeliverableRecord> {
  const rec: DeliverableRecord = {
    id: randomUUID(),
    campaignId: input.campaignId,
    area: input.area,
    type: input.type,
    title: input.title,
    payload: input.payload,
    createdAt: nowISO(),
  };
  const sb = getServerSupabase();
  if (sb) {
    await sb.from("deliverables").insert({
      id: rec.id,
      campaign_id: rec.campaignId,
      area: rec.area,
      type: rec.type,
      title: rec.title,
      payload_json: rec.payload,
      created_at: rec.createdAt,
    });
  } else {
    mem.deliverables.push(rec);
  }
  return rec;
}

export async function getDeliverables(campaignId: string): Promise<DeliverableRecord[]> {
  const sb = getServerSupabase();
  if (sb) {
    const { data } = await sb
      .from("deliverables")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true });
    return (data ?? []).map((d: any) => ({
      id: d.id,
      campaignId: d.campaign_id,
      area: d.area,
      type: d.type,
      title: d.title,
      payload: d.payload_json,
      createdAt: d.created_at,
    }));
  }
  return mem.deliverables.filter((d) => d.campaignId === campaignId);
}

// ---------------- Snapshot (rehidratacion) ----------------

export async function getSnapshot(campaignId: string): Promise<CampaignSnapshot | null> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) return null;
  const [agents, messages, deliverables] = await Promise.all([
    getAgents(campaignId),
    getMessages(campaignId),
    getDeliverables(campaignId),
  ]);
  return { campaign, agents, messages, deliverables };
}
