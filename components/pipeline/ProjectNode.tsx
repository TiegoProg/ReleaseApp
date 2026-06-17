"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { usePipelineStore, type PipelineNode } from "@/lib/pipelineStore";
import { NodeShell } from "./NodeShell";

// Nodo raíz "Proyecto": texto libre con el contexto (marca, producto, objetivo,
// tono, audiencia). Su output ES su texto, así que lo mantenemos sincronizado
// para que collectInputs lo lea de forma uniforme.
export function ProjectNode({ id, data, selected }: NodeProps<PipelineNode>) {
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);
  const removeNode = usePipelineStore((s) => s.removeNode);
  const text = (data.text as string) ?? "";

  return (
    <NodeShell
      name={data.label}
      placeholder="Proyecto"
      onRename={(v) => updateNodeData(id, { label: v })}
      onDelete={() => removeNode(id)}
      subtitle="contexto del flujo"
      accent="#0ea5e9"
      status="idle"
      selected={selected}
    >
      <textarea
        value={text}
        onChange={(e) => updateNodeData(id, { text: e.target.value, output: { text: e.target.value } })}
        placeholder="Marca, producto, objetivo, tono, audiencia…"
        rows={5}
        className="nodrag scroll-thin w-full resize-none rounded-lg border border-line bg-surface-sunken px-2.5 py-2 text-[12px] text-ink outline-none transition focus:border-area-research/50"
      />
      <p className="text-[10px] text-ink-mute">Esto alimenta a los agentes conectados.</p>

      <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !border-2 !border-white !bg-area-research" />
    </NodeShell>
  );
}
