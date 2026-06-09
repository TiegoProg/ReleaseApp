import type Anthropic from "@anthropic-ai/sdk";
import type { AgentEventType, AreaKey, NodeKind } from "../types";

// Opciones para lanzar un agente hijo (area o subagente) desde una tool.
export interface RunChildOptions {
  kind: NodeKind;
  area: AreaKey;
  role: string;
  objective: string;
  context?: string;
  parentNodeId: string;
}

// Contexto que recibe cada handler de tool durante el loop de un agente.
export interface RunContext {
  campaignId: string;
  agentId: string; // id del nodo del agente actual
  area: AreaKey | "director";
  depth: number;
  signal: AbortSignal;

  // Emite un evento al bus (transporte en vivo hacia la UI). Auto-rellena campaignId/agentId.
  emit: (
    type: AgentEventType,
    fields?: { from?: string; to?: string; payload?: any; agentId?: string }
  ) => void;

  // Ejecuta un agente hijo hasta completarlo y devuelve su resumen final (texto).
  runChild: (opts: RunChildOptions) => Promise<string>;
}

export type ToolHandler = (input: any, ctx: RunContext) => Promise<string>;

export interface ToolDef {
  schema: Anthropic.Tool;
  handler: ToolHandler;
}
