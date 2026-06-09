import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic } from "../anthropic";
import {
  addMessage,
  createAgent,
  getAgents,
  updateAgentStatus,
} from "../store";
import { makeEvent, publish } from "./events";
import {
  anthropicToolsFor,
  getToolNamesForAgent,
  lookupTool,
} from "../tools/registry";
import type { RunContext, RunChildOptions } from "../tools/context";
import {
  areaKickoff,
  areaSystem,
  maxTokensFor,
  modelFor,
  subagentKickoff,
  subagentSystem,
} from "./definitions";
import type {
  AgentEventType,
  AgentStatus,
  AreaKey,
  NodeKind,
} from "../types";

// Timeout POR TURNO de modelo (no por agente completo): el Director ejecuta a las áreas
// anidadas dentro de su tool call, así que un tope al wall-clock del agente mataría a toda
// la campaña. En cambio limitamos cada llamada al modelo; el total del agente queda acotado
// por maxIter y por la cancelación del orquestador (parentSignal).
const TURN_TIMEOUT_MS = 90_000;

function maxIterFor(kind: NodeKind): number {
  return kind === "director" ? 10 : kind === "area" ? 4 : 3;
}

// Conversaciones crudas (Anthropic) por agente, en memoria, para poder reanudar el loop.
const g = globalThis as unknown as {
  __orbitaConv?: Map<string, Anthropic.MessageParam[]>;
};
if (!g.__orbitaConv) g.__orbitaConv = new Map();
const conversations = g.__orbitaConv;

// Signal por-turno: aborta si el agente se cancela (base) o si el turno excede TURN_TIMEOUT_MS.
function turnSignal(base: AbortSignal): { signal: AbortSignal; done: () => void } {
  const ctrl = new AbortController();
  if (base.aborted) ctrl.abort();
  const onAbort = () => ctrl.abort();
  base.addEventListener("abort", onAbort);
  const t = setTimeout(() => ctrl.abort(), TURN_TIMEOUT_MS);
  return {
    signal: ctrl.signal,
    done: () => {
      clearTimeout(t);
      base.removeEventListener("abort", onAbort);
    },
  };
}

async function setStatus(
  campaignId: string,
  agentId: string,
  status: AgentStatus
): Promise<void> {
  await updateAgentStatus(agentId, status);
  publish(makeEvent("agent_status", { campaignId, agentId, payload: { status } }));
}

export interface RunAgentOpts {
  campaignId: string;
  agentId: string;
  kind: NodeKind;
  area: AreaKey | null;
  depth: number;
  system: string;
  userText?: string;
  parentSignal: AbortSignal;
}

/**
 * Loop genérico tool-use de un agente:
 *  - stream de Claude con sus tools
 *  - ejecuta los tool_use, reinyecta tool_result, repite hasta no haya tool calls
 *  - emite eventos (texto/tool_call/tool_result/status) y persiste en el store
 * Devuelve el último texto del agente (su resumen).
 */
export async function runAgent(opts: RunAgentOpts): Promise<string> {
  const { campaignId, agentId, kind, area, depth, system, userText } = opts;
  const signal = opts.parentSignal; // signal base (cancelación); el timeout es por-turno
  const maxIter = maxIterFor(kind);

  const client = getAnthropic();
  const model = modelFor(kind);
  const maxTokens = maxTokensFor(kind);
  const toolNames = getToolNamesForAgent(kind, area, depth);
  const tools = anthropicToolsFor(toolNames);

  const conversation = conversations.get(agentId) ?? [];
  if (userText) {
    conversation.push({ role: "user", content: userText });
    await addMessage({
      agentId,
      campaignId,
      role: "user",
      content: { type: "user_instruction", text: userText },
    });
    publish(
      makeEvent("text", { campaignId, agentId, payload: { role: "user", delta: userText } })
    );
  }
  conversations.set(agentId, conversation);

  // emit helper para el contexto de las tools
  const emit = (
    type: AgentEventType,
    fields?: { from?: string; to?: string; payload?: any; agentId?: string }
  ) => {
    publish(makeEvent(type, { campaignId, agentId, ...fields }));
  };

  // runChild: crea/activa un nodo hijo y corre su loop (recursivo)
  const runChild = async (childOpts: RunChildOptions): Promise<string> => {
    let childId: string;
    if (childOpts.kind === "area") {
      const agents = await getAgents(campaignId);
      const existing = agents.find(
        (a) => a.kind === "area" && a.area === childOpts.area
      );
      if (existing) {
        childId = existing.id;
      } else {
        const created = await createAgent({
          campaignId,
          kind: "area",
          area: childOpts.area,
          role: childOpts.role,
          parentId: childOpts.parentNodeId,
          status: "idle",
        });
        childId = created.id;
        publish(
          makeEvent("agent_created", {
            campaignId,
            agentId: childId,
            payload: {
              node: {
                id: childId,
                kind: "area",
                area: childOpts.area,
                role: childOpts.role,
                status: "idle",
                parentId: childOpts.parentNodeId,
              },
            },
          })
        );
      }
    } else {
      const created = await createAgent({
        campaignId,
        kind: "subagent",
        area: childOpts.area,
        role: childOpts.role,
        parentId: childOpts.parentNodeId,
        status: "idle",
      });
      childId = created.id;
      publish(
        makeEvent("agent_created", {
          campaignId,
          agentId: childId,
          payload: {
            node: {
              id: childId,
              kind: "subagent",
              area: childOpts.area,
              role: childOpts.role,
              status: "idle",
              parentId: childOpts.parentNodeId,
            },
          },
        })
      );
    }

    // pulso del link padre -> hijo
    publish(
      makeEvent("link_active", {
        campaignId,
        from: childOpts.parentNodeId,
        to: childId,
      })
    );

    const childKind: NodeKind = childOpts.kind;
    const childSystem =
      childKind === "area"
        ? areaSystem(childOpts.area)
        : subagentSystem(childOpts.area, childOpts.role);
    const childUserText =
      childKind === "area"
        ? areaKickoff(childOpts.objective, childOpts.context)
        : subagentKickoff(childOpts.objective);
    const childDepth = childKind === "area" ? 1 : depth + 1;

    return runAgent({
      campaignId,
      agentId: childId,
      kind: childKind,
      area: childOpts.area,
      depth: childDepth,
      system: childSystem,
      userText: childUserText,
      parentSignal: signal,
    });
  };

  const ctx: RunContext = {
    campaignId,
    agentId,
    area: area ?? "director",
    depth,
    signal,
    emit,
    runChild,
  };

  let lastText = "";
  try {
    await setStatus(campaignId, agentId, "thinking");

    for (let iter = 0; iter < maxIter; iter++) {
      if (signal.aborted) throw new Error("cancelado");

      let turnText = "";
      const turn = turnSignal(signal);
      let finalMsg: Anthropic.Message | null = null;
      try {
        const stream = client.messages.stream(
          {
            model,
            max_tokens: maxTokens,
            system,
            messages: conversation,
            ...(tools.length ? { tools } : {}),
          },
          { signal: turn.signal }
        );
        stream.on("text", (delta: string) => {
          turnText += delta;
          publish(
            makeEvent("text", { campaignId, agentId, payload: { role: "assistant", delta } })
          );
        });
        finalMsg = await stream.finalMessage();
      } finally {
        turn.done();
      }
      if (!finalMsg) break;

      // guarda el turno del asistente en la conversación cruda
      conversation.push({ role: "assistant", content: finalMsg.content as any });
      conversations.set(agentId, conversation);

      if (turnText.trim()) {
        lastText = turnText.trim();
        await addMessage({
          agentId,
          campaignId,
          role: "assistant",
          content: { type: "text", text: turnText.trim() },
        });
      }

      const toolUses = finalMsg.content.filter(
        (b: any) => b.type === "tool_use"
      ) as Array<{ id: string; name: string; input: any }>;

      if (toolUses.length === 0) break;

      await setStatus(campaignId, agentId, "tool");
      const toolResultBlocks: any[] = [];

      for (const tu of toolUses) {
        emit("tool_call", { payload: { tool: tu.name, input: tu.input } });
        await addMessage({
          agentId,
          campaignId,
          role: "assistant",
          content: { type: "tool_call", tool: tu.name, input: tu.input },
        });

        let resultText: string;
        const def = lookupTool(tu.name);
        if (!def) {
          resultText = `Tool desconocida: ${tu.name}`;
        } else {
          try {
            resultText = await def.handler(tu.input, ctx);
          } catch (err: any) {
            resultText = `Error ejecutando ${tu.name}: ${err?.message ?? String(err)}`;
          }
        }

        emit("tool_result", {
          payload: { tool: tu.name, summary: resultText.slice(0, 600) },
        });
        await addMessage({
          agentId,
          campaignId,
          role: "tool",
          content: { type: "tool_result", tool: tu.name, summary: resultText.slice(0, 600) },
        });

        toolResultBlocks.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: resultText,
        });
      }

      conversation.push({ role: "user", content: toolResultBlocks });
      conversations.set(agentId, conversation);
      await setStatus(campaignId, agentId, "thinking");
    }

    await setStatus(campaignId, agentId, "done");
    return lastText;
  } catch (err: any) {
    const message = err?.message ?? String(err);
    emit("error", { payload: { message } });
    await setStatus(campaignId, agentId, "error");
    return `El agente terminó con error: ${message}`;
  }
}
