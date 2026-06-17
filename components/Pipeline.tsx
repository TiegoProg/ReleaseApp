"use client";

import { useCallback, useRef, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type OnConnectEnd,
  type OnConnectStart,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { graphSnapshot, usePipelineStore } from "@/lib/pipelineStore";
import { canConnect, NODE_SPECS, type NodeKind } from "@/lib/pipelineGraph";
import { ProjectNode } from "./pipeline/ProjectNode";
import { PromptAgentNode } from "./pipeline/PromptAgentNode";
import { ImageNode } from "./pipeline/ImageNode";
import { AssetNode } from "./pipeline/AssetNode";
import { VideoNode } from "./pipeline/VideoNode";
import { PaneContextMenu } from "./pipeline/PaneContextMenu";

// ============================================================================
// Pizarra del pipeline UGC: lienzo de nodos conectables (n8n-style). Clic
// derecho en vacío para agregar nodos; cada nodo se ejecuta con su botón Run.
// ============================================================================

const nodeTypes = {
  project: ProjectNode,
  promptAgent: PromptAgentNode,
  image: ImageNode,
  asset: AssetNode,
  video: VideoNode,
};

// Tipos que pueden recibir una conexión (tienen al menos un puerto de entrada):
// válidos como destino al soltar un conector de salida en el vacío.
const KINDS_WITH_INPUT = (Object.keys(NODE_SPECS) as NodeKind[]).filter(
  (k) => NODE_SPECS[k].inputs.length > 0
);

type MenuState = {
  x: number;
  y: number;
  connect?: { fromNodeId: string; fromHandleType: "source" | "target" };
};

function Canvas() {
  const nodes = usePipelineStore((s) => s.nodes);
  const edges = usePipelineStore((s) => s.edges);
  const onNodesChange = usePipelineStore((s) => s.onNodesChange);
  const onEdgesChange = usePipelineStore((s) => s.onEdgesChange);
  const onConnect = usePipelineStore((s) => s.onConnect);
  const addNode = usePipelineStore((s) => s.addNode);
  const removeEdge = usePipelineStore((s) => s.removeEdge);

  const { screenToFlowPosition } = useReactFlow();
  const [menu, setMenu] = useState<MenuState | null>(null);
  // Nodo/handle desde el que arrancó un arrastre de conexión (para "soltar en vacío").
  const connectingRef = useRef<{ fromNodeId: string; fromHandleType: "source" | "target" } | null>(null);

  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault();
    setMenu({ x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY });
  }, []);

  // Inicio de arrastre desde un conector.
  const onConnectStart = useCallback<OnConnectStart>((_event, params) => {
    connectingRef.current =
      params.nodeId && params.handleType
        ? { fromNodeId: params.nodeId, fromHandleType: params.handleType }
        : null;
  }, []);

  // Fin de arrastre: si no cayó sobre un handle válido, abrir el menú para crear
  // y conectar un nodo nuevo en el punto soltado (estilo n8n).
  const onConnectEnd = useCallback<OnConnectEnd>((event, connectionState) => {
    const from = connectingRef.current;
    connectingRef.current = null;
    if (!from) return;
    if (connectionState?.isValid) return; // ya se conectó a un handle existente
    const pt = "changedTouches" in event ? event.changedTouches[0] : (event as MouseEvent);
    setMenu({ x: pt.clientX, y: pt.clientY, connect: from });
  }, []);

  const pick = useCallback(
    (kind: NodeKind) => {
      if (!menu) return;
      const position = screenToFlowPosition({ x: menu.x, y: menu.y });
      const newId = addNode(kind, position);
      if (menu.connect) {
        const { fromNodeId, fromHandleType } = menu.connect;
        const conn: Connection =
          fromHandleType === "source"
            ? { source: fromNodeId, target: newId, sourceHandle: null, targetHandle: null }
            : { source: newId, target: fromNodeId, sourceHandle: null, targetHandle: null };
        onConnect(conn);
      }
      setMenu(null);
    },
    [menu, addNode, onConnect, screenToFlowPosition]
  );

  // Feedback en vivo mientras se arrastra una conexión.
  const isValidConnection = useCallback((c: Connection | Edge) => {
    if (!c.source || !c.target) return false;
    const { nodes: ns, edges: es } = graphSnapshot();
    return canConnect(
      { source: c.source, target: c.target, sourceHandle: c.sourceHandle, targetHandle: c.targetHandle },
      ns,
      es
    );
  }, []);

  return (
    <div className="relative h-full w-full">
      <div className="pointer-events-none absolute left-5 top-4 z-10 flex items-center gap-2.5">
        <span className="label-mono">Pipeline UGC</span>
        <span className="hidden text-[12px] text-ink-mute sm:block">
          clic derecho para agregar · arrastra desde un conector para conectar · clic en una conexión para borrarla
        </span>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onEdgeClick={(_, edge) => removeEdge(edge.id)}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={() => setMenu(null)}
        isValidConnection={isValidConnection}
        fitView
        minZoom={0.3}
        maxZoom={1.75}
        defaultEdgeOptions={{ animated: true }}
        deleteKeyCode={["Backspace", "Delete"]}
      >
        <Background gap={20} size={1} color="#cbd5e1" />
        <MiniMap pannable zoomable className="!rounded-xl !border !border-line !bg-white/70" />
        <Controls className="!rounded-xl !shadow-soft" />
      </ReactFlow>

      {menu && (
        <PaneContextMenu
          x={menu.x}
          y={menu.y}
          title={menu.connect ? "Conectar a nodo nuevo" : "Agregar nodo"}
          allow={menu.connect?.fromHandleType === "source" ? KINDS_WITH_INPUT : undefined}
          onPick={pick}
          onClose={() => setMenu(null)}
        />
      )}

      {nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="max-w-sm text-center">
            <div className="font-display text-[18px] font-bold text-ink">Lienzo vacío</div>
            <p className="mt-1 text-[13px] text-ink-soft">
              Haz <b>clic derecho</b> para agregar tu primer nodo. Empieza por un
              <span className="font-medium"> Proyecto</span>, conéctalo a un
              <span className="font-medium"> Agente Prompt</span> y luego a una
              <span className="font-medium"> Imagen</span>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Pipeline() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}
