import {
  createAgent,
  createCampaign,
  getAgents,
  getCampaign,
  setCampaignStatus,
} from "../store";
import { makeEvent, publish } from "./events";
import { runAgent } from "./agentLoop";
import {
  areaSystem,
  directorKickoff,
  directorSystem,
  subagentSystem,
} from "./definitions";
import { AREAS, AREA_KEYS, type AgentRecord } from "../types";

// Mantiene vivas las corridas en background y evita doble arranque / GC.
const g = globalThis as unknown as {
  __orbitaRuns?: Map<string, { promise: Promise<void>; controller: AbortController }>;
};
if (!g.__orbitaRuns) g.__orbitaRuns = new Map();
const runs = g.__orbitaRuns;

function nodePayload(a: AgentRecord) {
  return {
    node: {
      id: a.id,
      kind: a.kind,
      area: a.area,
      role: a.role,
      status: a.status,
      parentId: a.parentId,
    },
  };
}

/**
 * Crea la campaña, instancia el Director + las 4 áreas (idle) y arranca al Director
 * en background. Devuelve el campaignId de inmediato; la UI se conecta por SSE.
 */
export async function startCampaign(goal: string): Promise<{ campaignId: string; directorId: string }> {
  const campaign = await createCampaign(goal);
  publish(makeEvent("campaign_created", { campaignId: campaign.id, payload: { goal } }));

  const director = await createAgent({
    campaignId: campaign.id,
    kind: "director",
    area: null,
    role: "Director",
    parentId: null,
    status: "idle",
  });
  publish(
    makeEvent("agent_created", {
      campaignId: campaign.id,
      agentId: director.id,
      payload: nodePayload(director),
    })
  );

  // Crea los 4 nodos de área de entrada (idle) para que la órbita los muestre desde el inicio.
  for (const area of AREA_KEYS) {
    const node = await createAgent({
      campaignId: campaign.id,
      kind: "area",
      area,
      role: AREAS[area].label,
      parentId: director.id,
      status: "idle",
    });
    publish(
      makeEvent("agent_created", {
        campaignId: campaign.id,
        agentId: node.id,
        payload: nodePayload(node),
      })
    );
  }

  const controller = new AbortController();
  const promise = (async () => {
    try {
      await runAgent({
        campaignId: campaign.id,
        agentId: director.id,
        kind: "director",
        area: null,
        depth: 0,
        system: directorSystem(goal),
        userText: directorKickoff(goal),
        parentSignal: controller.signal,
      });
      await setCampaignStatus(campaign.id, "done");
      publish(makeEvent("done", { campaignId: campaign.id, payload: { status: "done" } }));
    } catch (err: any) {
      await setCampaignStatus(campaign.id, "error");
      publish(
        makeEvent("done", {
          campaignId: campaign.id,
          payload: { status: "error", message: err?.message ?? String(err) },
        })
      );
    } finally {
      runs.delete(campaign.id);
    }
  })();

  runs.set(campaign.id, { promise, controller });
  return { campaignId: campaign.id, directorId: director.id };
}

/**
 * Reanuda un agente con una instrucción del usuario (iterar). Corre en background;
 * los eventos fluyen por el mismo bus SSE.
 */
export async function sendUserMessage(
  campaignId: string,
  agentId: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  const agents = await getAgents(campaignId);
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) return { ok: false, error: "Agente no encontrado." };

  const campaign = await getCampaign(campaignId);
  if (!campaign) return { ok: false, error: "Campaña no encontrada." };

  const depth = agent.kind === "director" ? 0 : agent.kind === "area" ? 1 : 2;
  const system =
    agent.kind === "director"
      ? directorSystem(campaign.goal)
      : agent.kind === "area"
      ? areaSystem(agent.area!)
      : subagentSystem(agent.area!, agent.role);

  const controller = new AbortController();
  const promise = (async () => {
    try {
      await runAgent({
        campaignId,
        agentId,
        kind: agent.kind,
        area: agent.area,
        depth,
        system,
        userText: text,
        parentSignal: controller.signal,
      });
    } finally {
      runs.delete(`${campaignId}:${agentId}`);
    }
  })();

  runs.set(`${campaignId}:${agentId}`, { promise, controller });
  return { ok: true };
}
