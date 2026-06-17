"use client";

import { useEffect, useRef } from "react";
import { type NodeProps } from "@xyflow/react";
import { usePipelineStore, type PipelineNode } from "@/lib/pipelineStore";
import { NodeShell, RunButton } from "./NodeShell";

// Nodo "Video (Seedance)": recibe varias imágenes ordenadas (handle 'images',
// @Image1..N) + un prompt-timeline (handle 'prompt') y lanza reference-to-video
// en fal. Hace polling de /api/ugc/status hasta tener el clip.
export function VideoNode({ id, data, selected }: NodeProps<PipelineNode>) {
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);
  const removeNode = usePipelineStore((s) => s.removeNode);
  const nodes = usePipelineStore((s) => s.nodes);
  const edges = usePipelineStore((s) => s.edges);

  const status = data.status ?? "idle";
  const videoUrl = (data.output?.url as string) ?? "";
  const cost = typeof data.cost === "number" ? (data.cost as number) : undefined;
  const order = (data.imageOrder as string[]) ?? [];

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const refs = order.map((rid) => ({ id: rid, url: (byId.get(rid)?.data?.output?.url as string) || "" }));
  const promptEdge = edges.find((e) => e.target === id && e.targetHandle === "prompt");
  const promptText = (promptEdge ? (byId.get(promptEdge.source)?.data?.output?.text as string) : "") || "";

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };
  useEffect(() => () => stopPolling(), []);

  function move(idx: number, dir: -1 | 1) {
    const next = [...order];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    updateNodeData(id, { imageOrder: next });
  }

  function startPolling(requestId: string) {
    stopPolling();
    const started = Date.now();
    pollRef.current = setInterval(async () => {
      if (Date.now() - started > 6 * 60 * 1000) {
        stopPolling();
        updateNodeData(id, { status: "error", error: "Timeout del render." });
        return;
      }
      try {
        const res = await fetch(`/api/ugc/status?requestId=${encodeURIComponent(requestId)}`);
        const { job } = await res.json();
        if (job?.status === "ready" && job.videoUrl) {
          stopPolling();
          updateNodeData(id, { status: "done", output: { url: job.videoUrl } });
        } else if (job?.status === "failed") {
          stopPolling();
          updateNodeData(id, { status: "error", error: job.error ?? "El render falló." });
        }
      } catch {
        /* reintenta en el próximo tick */
      }
    }, 5000);
  }

  async function run() {
    const state = usePipelineStore.getState();
    const self = state.nodes.find((n) => n.id === id);
    const ord = (self?.data?.imageOrder as string[]) ?? [];
    const map = new Map(state.nodes.map((n) => [n.id, n]));
    const imageUrls = ord
      .map((rid) => map.get(rid)?.data?.output?.url as string | undefined)
      .filter(Boolean) as string[];
    const pe = state.edges.find((e) => e.target === id && e.targetHandle === "prompt");
    const prompt = ((pe ? (map.get(pe.source)?.data?.output?.text as string) : "") || "").trim();

    if (!imageUrls.length) {
      updateNodeData(id, { status: "error", error: "Conecta y genera al menos una imagen." });
      return;
    }
    if (!prompt) {
      updateNodeData(id, { status: "error", error: "Conecta un prompt (Agente en modo Video)." });
      return;
    }
    updateNodeData(id, { status: "running", error: undefined, output: undefined });
    try {
      const res = await fetch("/api/pipeline/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrls, prompt }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Falló el render.");
      const job = json.job;
      if (job.videoUrl && (job.status === "stub" || job.status === "ready")) {
        updateNodeData(id, { status: "done", output: { url: job.videoUrl }, cost: job.costUsd });
      } else if (job.status === "rendering" && job.requestId) {
        updateNodeData(id, { cost: job.costUsd });
        startPolling(job.requestId);
      } else {
        throw new Error(job.error ?? "Estado de render inesperado.");
      }
    } catch (e: any) {
      updateNodeData(id, { status: "error", error: e?.message ?? "Error inesperado." });
    }
  }

  return (
    <NodeShell
      kind="video"
      name={data.label}
      placeholder="Video"
      onRename={(v) => updateNodeData(id, { label: v })}
      onDelete={() => removeNode(id)}
      subtitle="Seedance 2.0"
      accent="#ec4899"
      status={status}
      selected={selected}
    >
      {/* referencias ordenadas (@Image1..N) */}
      <div className="space-y-1">
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink-mute">
          Imágenes ← (orden = @Image1..N)
        </span>
        {refs.length ? (
          <div className="space-y-1">
            {refs.map((r, idx) => (
              <div key={r.id} className="flex items-center gap-2 rounded-lg border border-line bg-surface-sunken p-1">
                <span className="rounded bg-ink px-1.5 py-0.5 text-[9px] font-bold text-white">@Image{idx + 1}</span>
                {r.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.url} alt={`img ${idx + 1}`} className="h-9 w-9 rounded object-cover" />
                ) : (
                  <span className="text-[10px] text-amber-600">sin output (ejecútala)</span>
                )}
                <div className="nodrag ml-auto flex gap-0.5">
                  <button
                    type="button"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    className="grid h-5 w-5 place-items-center rounded bg-white text-ink-soft disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, 1)}
                    disabled={idx === refs.length - 1}
                    className="grid h-5 w-5 place-items-center rounded bg-white text-ink-soft disabled:opacity-30"
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-line p-2 text-[10.5px] text-ink-mute">
            conecta imágenes (Asset/Imagen) al punto izquierdo ←
          </div>
        )}
      </div>

      {/* prompt-timeline conectado */}
      <div className="space-y-1">
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink-mute">↑ Prompt</span>
        {promptText ? (
          <p className="scroll-thin max-h-16 overflow-y-auto rounded-lg border border-line bg-surface-sunken px-2 py-1.5 text-[10.5px] text-ink-soft">
            {promptText}
          </p>
        ) : (
          <div className="rounded-lg border border-dashed border-line p-2 text-[10.5px] text-ink-mute">
            conecta el Agente Prompt (modo Video) al punto superior ↑
          </div>
        )}
      </div>

      <RunButton onClick={run} running={status === "running"} label="Generar video" />
      {typeof cost === "number" && cost > 0 && (
        <p className="text-center text-[10px] text-ink-mute">costo estimado ≈ ${cost.toFixed(2)}</p>
      )}

      {videoUrl ? (
        <video src={videoUrl} controls className="min-h-0 w-full flex-1 rounded-lg border border-line object-contain" />
      ) : status === "running" ? (
        <div className="grid min-h-[5rem] flex-1 place-items-center rounded-lg border border-dashed border-line text-[11px] text-ink-mute">
          renderizando…
        </div>
      ) : null}

      {data.error && <p className="text-[10.5px] text-red-600">{data.error}</p>}
    </NodeShell>
  );
}
