"use client";

import { type NodeProps } from "@xyflow/react";
import { graphSnapshot, usePipelineStore, type PipelineNode } from "@/lib/pipelineStore";
import { collectInputs, firstInputText } from "@/lib/pipelineGraph";
import { NodeShell, RunButton } from "./NodeShell";

// Nodo "Agente Prompt" (Opus 4.8): lee el contexto del nodo upstream + una
// instrucción y produce un prompt de imagen (editable antes de pasarlo abajo).
export function PromptAgentNode({ id, data, selected }: NodeProps<PipelineNode>) {
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);
  const removeNode = usePipelineStore((s) => s.removeNode);
  const instruction = (data.instruction as string) ?? "";
  const mode = (data.mode as "image" | "video") ?? "image";
  const prompt = (data.output?.text as string) ?? "";
  const status = data.status ?? "idle";

  async function run() {
    const { nodes, edges } = graphSnapshot();
    const context = firstInputText(collectInputs(id, nodes, edges)) ?? "";
    if (!instruction.trim()) {
      updateNodeData(id, { status: "error", error: "Escribe qué quieres que genere." });
      return;
    }
    updateNodeData(id, { status: "running", error: undefined });
    try {
      const res = await fetch("/api/pipeline/prompt-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, instruction, mode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "El agente falló.");
      updateNodeData(id, { status: "done", output: { text: json.prompt } });
    } catch (e: any) {
      updateNodeData(id, { status: "error", error: e?.message ?? "Error inesperado." });
    }
  }

  const MODES: { value: "image" | "video"; label: string }[] = [
    { value: "image", label: "Imagen" },
    { value: "video", label: "Video" },
  ];

  return (
    <NodeShell
      kind="promptAgent"
      name={data.label}
      placeholder="Agente Prompt"
      onRename={(v) => updateNodeData(id, { label: v })}
      onDelete={() => removeNode(id)}
      subtitle="Opus 4.8"
      accent="#8b5cf6"
      status={status}
      selected={selected}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-mute">Salida</span>
        <div className="nodrag ml-auto flex gap-1">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => updateNodeData(id, { mode: m.value })}
              className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                mode === m.value ? "bg-ink text-white" : "bg-surface-sunken text-ink-soft hover:text-ink"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <label className="block text-[10px] font-semibold uppercase tracking-wide text-ink-mute">Instrucción</label>
      <textarea
        value={instruction}
        onChange={(e) => updateNodeData(id, { instruction: e.target.value })}
        placeholder="p.ej. una foto de producto sobre madera clara con luz suave"
        rows={2}
        className="nodrag scroll-thin w-full resize-none rounded-lg border border-line bg-surface-sunken px-2.5 py-2 text-[12px] text-ink outline-none transition focus:border-area-content/50"
      />

      <RunButton onClick={run} running={status === "running"} label="Generar prompt" />

      {prompt && (
        <div className="space-y-1">
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-ink-mute">
            Prompt (editable)
          </label>
          <textarea
            value={prompt}
            onChange={(e) => updateNodeData(id, { output: { text: e.target.value } })}
            rows={4}
            className="nodrag scroll-thin w-full resize-none rounded-lg border border-line bg-white px-2.5 py-2 text-[11.5px] text-ink outline-none transition focus:border-area-content/50"
          />
        </div>
      )}

      {data.error && <p className="text-[10.5px] text-red-600">{data.error}</p>}
    </NodeShell>
  );
}
