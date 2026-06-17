"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { graphSnapshot, usePipelineStore, type PipelineNode } from "@/lib/pipelineStore";
import { collectInputs, firstInputText } from "@/lib/pipelineGraph";
import { NodeShell, RunButton } from "./NodeShell";

const ASPECTS: { value: "9:16" | "16:9" | "1:1"; label: string }[] = [
  { value: "9:16", label: "9:16" },
  { value: "16:9", label: "16:9" },
  { value: "1:1", label: "1:1" },
];

// Nodo "Imagen" (GPT Image): toma el prompt del nodo upstream y genera una
// imagen vía /api/scene (que ya persiste en Storage y tiene fallback stub).
export function ImageNode({ id, data, selected }: NodeProps<PipelineNode>) {
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);
  const removeNode = usePipelineStore((s) => s.removeNode);
  const aspect = (data.aspect as "9:16" | "16:9" | "1:1") ?? "9:16";
  const url = (data.output?.url as string) ?? "";
  const status = data.status ?? "idle";

  async function run() {
    const { nodes, edges } = graphSnapshot();
    const prompt = firstInputText(collectInputs(id, nodes, edges));
    if (!prompt) {
      updateNodeData(id, { status: "error", error: "Conecta un nodo con prompt y ejecútalo arriba." });
      return;
    }
    updateNodeData(id, { status: "running", error: undefined });
    try {
      const res = await fetch("/api/scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, aspect }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "No se pudo generar la imagen.");
      updateNodeData(id, { status: "done", output: { url: json.url } });
    } catch (e: any) {
      updateNodeData(id, { status: "error", error: e?.message ?? "Error inesperado." });
    }
  }

  return (
    <NodeShell
      name={data.label}
      placeholder="Imagen"
      onRename={(v) => updateNodeData(id, { label: v })}
      onDelete={() => removeNode(id)}
      subtitle="GPT Image"
      accent="#10b981"
      status={status}
      selected={selected}
    >
      <Handle type="target" position={Position.Top} className="!h-3 !w-3 !border-2 !border-white !bg-area-media" />

      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-mute">Formato</span>
        <div className="nodrag ml-auto flex gap-1">
          {ASPECTS.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => updateNodeData(id, { aspect: a.value })}
              className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                aspect === a.value ? "bg-ink text-white" : "bg-surface-sunken text-ink-soft hover:text-ink"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <RunButton onClick={run} running={status === "running"} label="Generar imagen" />

      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="nodrag block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="resultado" className="w-full rounded-lg border border-line object-cover" />
        </a>
      ) : (
        <div className="grid h-24 place-items-center rounded-lg border border-dashed border-line text-[11px] text-ink-mute">
          sin imagen aún
        </div>
      )}

      {data.error && <p className="text-[10.5px] text-red-600">{data.error}</p>}

      <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !border-2 !border-white !bg-area-media" />
    </NodeShell>
  );
}
