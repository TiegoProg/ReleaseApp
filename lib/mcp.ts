import type { ToolDef } from "./tools/context";

/**
 * Slot de integración MCP.
 *
 * En la v1 está vacío, pero la interfaz queda lista: registra aquí tools provenientes
 * de servidores MCP (Model Context Protocol) y quedarán disponibles para los agentes
 * a través del mismo registry (lib/tools/registry.ts), igual que las tools nativas.
 *
 * Para conectar un servidor MCP real:
 *   1) Descubre sus tools (lista de {name, description, input_schema}).
 *   2) Por cada una, crea un ToolDef cuyo handler invoque la llamada MCP correspondiente.
 *   3) Llama registerMcpTool(name, def) al iniciar el server.
 */
const mcpTools: Record<string, ToolDef> = {};

export function registerMcpTool(name: string, def: ToolDef): void {
  mcpTools[name] = def;
}

export function getMcpTools(): Record<string, ToolDef> {
  return mcpTools;
}
