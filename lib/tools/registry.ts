import type Anthropic from "@anthropic-ai/sdk";
import type { ToolDef } from "./context";
import type { AreaKey, NodeKind } from "../types";
import { readBoard } from "./board";
import { writeBrief, writeCopy, writeScript, contentCalendar } from "./content";
import { allocateBudget, channelPlan } from "./media";
import { generateImage } from "./image";
import { generateVideo } from "./video";
import { webSearch } from "./search";
import { delegateToArea, requestUserInput, spawnSubagent } from "./subagent";
import { getMcpTools } from "../mcp";

export const MAX_DEPTH = 2;

// Registro central: nombre de tool -> definición (schema + handler).
function allTools(): Record<string, ToolDef> {
  return {
    read_board: readBoard,
    write_brief: writeBrief,
    write_copy: writeCopy,
    write_script: writeScript,
    content_calendar: contentCalendar,
    allocate_budget: allocateBudget,
    channel_plan: channelPlan,
    generate_image: generateImage,
    generate_video: generateVideo,
    web_search: webSearch,
    delegate_to_area: delegateToArea,
    request_user_input: requestUserInput,
    spawn_subagent: spawnSubagent,
    ...getMcpTools(), // tools registradas vía MCP
  };
}

// Tools por área.
const AREA_TOOLS: Record<AreaKey, string[]> = {
  research: ["web_search", "write_brief", "read_board", "spawn_subagent"],
  creative: ["generate_image", "generate_video", "write_copy", "read_board", "spawn_subagent"],
  content: ["write_script", "content_calendar", "read_board", "spawn_subagent"],
  media: ["allocate_budget", "channel_plan", "read_board", "spawn_subagent"],
};

export function lookupTool(name: string): ToolDef | undefined {
  return allTools()[name];
}

// Qué tools recibe un agente según su tipo, área y profundidad.
export function getToolNamesForAgent(
  kind: NodeKind,
  area: AreaKey | null,
  depth: number
): string[] {
  if (kind === "director") {
    return ["delegate_to_area", "read_board", "request_user_input"];
  }
  if (!area) return [];
  let names = AREA_TOOLS[area].slice();
  // Límite de profundidad: subagentes (o al alcanzar MAX_DEPTH) no abren más subagentes.
  if (kind === "subagent" || depth >= MAX_DEPTH) {
    names = names.filter((n) => n !== "spawn_subagent");
  }
  return names;
}

// Convierte nombres de tools a los schemas que entiende la API de Anthropic.
export function anthropicToolsFor(names: string[]): Anthropic.Tool[] {
  const all = allTools();
  return names.map((n) => all[n]?.schema).filter(Boolean) as Anthropic.Tool[];
}
