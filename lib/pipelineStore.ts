import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type XYPosition,
} from "@xyflow/react";
import {
  canConnect,
  NODE_SPECS,
  reconcileImageOrder,
  removeNode as removeNodeFromGraph,
  type GraphEdge,
  type GraphNode,
  type NodeKind,
  type NodeOutput,
} from "./pipelineGraph";

// ============================================================================
// Estado del lienzo del pipeline (Zustand + persist en localStorage). La lógica
// de validación de conexiones vive en lib/pipelineGraph (pura y testeada); aquí
// solo orquestamos los cambios de React Flow y el estado de ejecución por nodo.
// ============================================================================

export type NodeStatus = "idle" | "running" | "done" | "error";

export interface PipelineNodeData {
  // configuración editable por el usuario
  label?: string; // nombre personalizado del nodo (opcional)
  text?: string; // contenido del nodo Proyecto
  instruction?: string; // instrucción del nodo Agente Prompt
  mode?: "image" | "video"; // modo del Agente Prompt (imagen suelta vs timeline de video)
  aspect?: "9:16" | "16:9" | "1:1"; // formato del nodo Imagen
  imageOrder?: string[]; // nodo Video: ids de imágenes en orden (@Image1..N)
  // estado de ejecución
  status?: NodeStatus;
  output?: NodeOutput;
  error?: string;
  [key: string]: unknown;
}

export type PipelineNode = Node<PipelineNodeData>;

interface PipelineState {
  nodes: PipelineNode[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (type: NodeKind, position: XYPosition) => string;
  updateNodeData: (id: string, patch: Partial<PipelineNodeData>) => void;
  removeNode: (id: string) => void;
  reset: () => void;
}

// Mapea los nodos de React Flow a la forma pura del grafo para validar/leer.
function toGraph(nodes: PipelineNode[]): GraphNode[] {
  return nodes.map((n) => ({
    id: n.id,
    type: (n.type as NodeKind) ?? "project",
    data: { output: n.data?.output },
  }));
}
function toGraphEdges(edges: Edge[]): GraphEdge[] {
  return edges.map((e) => ({
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
  }));
}

// Ids de las imágenes conectadas al handle 'images' de un nodo Video.
function connectedImageSources(videoId: string, edges: Edge[]): string[] {
  return edges
    .filter((e) => e.target === videoId && e.targetHandle === "images")
    .map((e) => e.source);
}

// Reconcilia imageOrder de cada nodo Video contra sus imágenes realmente conectadas.
function reconcileVideos(nodes: PipelineNode[], edges: Edge[]): PipelineNode[] {
  return nodes.map((n) => {
    if (n.type !== "video") return n;
    const connected = connectedImageSources(n.id, edges);
    const order = reconcileImageOrder((n.data.imageOrder as string[]) ?? [], connected);
    return { ...n, data: { ...n.data, imageOrder: order } };
  });
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULTS: Record<NodeKind, PipelineNodeData> = {
  project: { text: "", status: "idle" },
  promptAgent: { instruction: "", mode: "image", status: "idle" },
  image: { aspect: "9:16", status: "idle" },
  asset: { status: "idle" },
  video: { imageOrder: [], status: "idle" },
};

// localStorage solo existe en el cliente; en SSR usamos un storage no-op.
const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const usePipelineStore = create<PipelineState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],

      onNodesChange: (changes) =>
        set({ nodes: applyNodeChanges(changes, get().nodes) as PipelineNode[] }),

      onEdgesChange: (changes) => {
        const edges = applyEdgeChanges(changes, get().edges);
        set({ edges, nodes: reconcileVideos(get().nodes, edges) });
      },

      onConnect: (connection) => {
        const { nodes, edges } = get();
        if (!connection.source || !connection.target) return;
        if (
          !canConnect(
            {
              source: connection.source,
              target: connection.target,
              sourceHandle: connection.sourceHandle,
              targetHandle: connection.targetHandle,
            },
            toGraph(nodes),
            toGraphEdges(edges)
          )
        )
          return;
        const next = addEdge(connection, edges);
        set({ edges: next, nodes: reconcileVideos(get().nodes, next) });
      },

      addNode: (type, position) => {
        const id = newId();
        const node: PipelineNode = {
          id,
          type,
          position,
          data: { ...DEFAULTS[type] },
        };
        set({ nodes: [...get().nodes, node] });
        return id;
      },

      updateNodeData: (id, patch) =>
        set({
          nodes: get().nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, ...patch } } : n
          ),
        }),

      removeNode: (id) => {
        const { nodes, edges } = removeNodeFromGraph(id, get().nodes, get().edges);
        set({ nodes: reconcileVideos(nodes, edges), edges });
      },

      reset: () => set({ nodes: [], edges: [] }),
    }),
    {
      name: "orbita_pipeline",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : noopStorage
      ),
      partialize: (s) => ({ nodes: s.nodes, edges: s.edges }),
      // Al rehidratar, ningún nodo debe quedar "corriendo" de una sesión previa.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.nodes = state.nodes.map((n) =>
          n.data?.status === "running" ? { ...n, data: { ...n.data, status: "idle" } } : n
        );
      },
    }
  )
);

// Snapshot del grafo en la forma PURA (GraphNode/GraphEdge) para los handlers de
// "Run" y la validación de conexiones. Centraliza el mapeo en un solo lugar.
export function graphSnapshot(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const { nodes, edges } = usePipelineStore.getState();
  return { nodes: toGraph(nodes), edges: toGraphEdges(edges) };
}

// Reexport útil para los componentes de nodo.
export { NODE_SPECS };
