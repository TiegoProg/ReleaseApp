// ============================================================================
// Lógica PURA del grafo del pipeline UGC (sin React, sin red). Define los tipos
// de nodo, qué outputs produce/consume cada uno (puertos tipados por handle),
// cómo se reúnen los inputs, qué conexiones son válidas, y cómo se mantiene el
// orden de las imágenes de referencia del nodo Video.
//
// Mantener este módulo libre de dependencias del navegador lo hace testeable y
// reutilizable tanto por el store (cliente) como por los handlers de "Run".
// ============================================================================

export type NodeKind = "project" | "promptAgent" | "image" | "asset" | "video";

export type IOType = "text" | "url";

export interface NodeOutput {
  text?: string;
  url?: string;
}

export interface GraphNode {
  id: string;
  type: NodeKind;
  data: { output?: NodeOutput };
}

export interface GraphEdge {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface Connection {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

/** Un puerto de entrada de un nodo: su id (handle), qué tipo acepta y cuántas aristas admite. */
export interface InputPort {
  id: string;
  accepts: IOType;
  max: number;
}

export interface NodeSpec {
  inputs: InputPort[];
  output: IOType;
}

/** Puertos de entrada y tipo de salida de cada tipo de nodo. */
export const NODE_SPECS: Record<NodeKind, NodeSpec> = {
  project: { inputs: [], output: "text" },
  promptAgent: { inputs: [{ id: "in", accepts: "text", max: 1 }], output: "text" },
  image: { inputs: [{ id: "in", accepts: "text", max: 1 }], output: "url" },
  asset: { inputs: [], output: "url" },
  video: {
    inputs: [
      { id: "images", accepts: "url", max: Infinity },
      { id: "prompt", accepts: "text", max: 1 },
    ],
    output: "url",
  },
};

/** Un output está "listo" si tiene texto no vacío o una url. */
export function hasOutput(output?: NodeOutput): boolean {
  return !!(output?.text?.trim() || output?.url);
}

export interface CollectedInput {
  fromId: string;
  fromType: NodeKind;
  output: NodeOutput;
}

export interface CollectedInputs {
  inputs: CollectedInput[];
  missing: string[];
}

/**
 * Reúne los outputs de los nodos upstream conectados a `nodeId`. Si se pasa
 * `handleId`, solo considera las aristas que entran por ese handle. Los upstream
 * sin output listo se reportan en `missing`.
 */
export function collectInputs(
  nodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  handleId?: string
): CollectedInputs {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const inputs: CollectedInput[] = [];
  const missing: string[] = [];

  for (const edge of edges) {
    if (edge.target !== nodeId) continue;
    if (handleId && edge.targetHandle !== handleId) continue;
    const from = byId.get(edge.source);
    if (!from) continue;
    if (hasOutput(from.data.output)) {
      inputs.push({ fromId: from.id, fromType: from.type, output: from.data.output! });
    } else {
      missing.push(from.id);
    }
  }

  return { inputs, missing };
}

/** Texto del primer input listo (contexto para el agente, prompt para la imagen). */
export function firstInputText(collected: CollectedInputs): string | undefined {
  for (const input of collected.inputs) {
    const text = input.output.text ?? input.output.url;
    if (text && text.trim()) return text;
  }
  return undefined;
}

/**
 * Quita un nodo y todas las aristas que lo tocan (como source o target).
 * Genérico para servir tanto al grafo puro como a los nodos/edges de React Flow.
 */
export function removeNode<N extends { id: string }, E extends { source: string; target: string }>(
  id: string,
  nodes: N[],
  edges: E[]
): { nodes: N[]; edges: E[] } {
  return {
    nodes: nodes.filter((n) => n.id !== id),
    edges: edges.filter((e) => e.source !== id && e.target !== id),
  };
}

/**
 * Reconcilia el orden de imágenes de un nodo Video contra los ids realmente
 * conectados: conserva el orden previo (incluido el manual con ↑/↓), agrega los
 * nuevos al final y descarta los que ya no están conectados.
 */
export function reconcileImageOrder(prev: string[], connected: string[]): string[] {
  const connectedSet = new Set(connected);
  const kept = prev.filter((id) => connectedSet.has(id));
  const keptSet = new Set(kept);
  const added = connected.filter((id) => !keptSet.has(id));
  return [...kept, ...added];
}

/** El handle al que apunta una arista: su targetHandle, o el primer puerto si no tiene. */
function edgePortId(edge: GraphEdge, targetSpec: NodeSpec): string | undefined {
  return edge.targetHandle ?? targetSpec.inputs[0]?.id;
}

/** ¿`target` es alcanzable desde `start` siguiendo las aristas source->target? */
function reachable(start: string, target: string, edges: GraphEdge[]): boolean {
  const stack = [start];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === target) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const e of edges) if (e.source === cur) stack.push(e.target);
  }
  return false;
}

/**
 * ¿Es válida una conexión source->target (en el handle indicado)? Reglas:
 * - no auto-conexión; ambos nodos existen
 * - el handle destino existe (si no se indica, se usa el primer puerto de entrada)
 * - el tipo de salida del origen coincide con lo que acepta el puerto
 * - el puerto no supera su capacidad (cuenta aristas existentes a ese handle)
 * - no debe crear un ciclo
 */
export function canConnect(conn: Connection, nodes: GraphNode[], edges: GraphEdge[]): boolean {
  if (conn.source === conn.target) return false;

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const source = byId.get(conn.source);
  const target = byId.get(conn.target);
  if (!source || !target) return false;

  const spec = NODE_SPECS[target.type];
  const port = conn.targetHandle
    ? spec.inputs.find((p) => p.id === conn.targetHandle)
    : spec.inputs[0];
  if (!port) return false;

  // Compatibilidad de tipo (url↔url, text↔text).
  if (NODE_SPECS[source.type].output !== port.accepts) return false;

  // Capacidad del puerto.
  const incoming = edges.filter(
    (e) => e.target === conn.target && edgePortId(e, spec) === port.id
  ).length;
  if (incoming >= port.max) return false;

  // Un ciclo se cerraría si target ya puede alcanzar a source.
  if (reachable(conn.target, conn.source, edges)) return false;

  return true;
}
