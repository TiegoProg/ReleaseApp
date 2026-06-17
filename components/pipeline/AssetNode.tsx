"use client";

import { useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { usePipelineStore, type PipelineNode } from "@/lib/pipelineStore";
import { NodeShell } from "./NodeShell";

// Nodo "Asset": sube una imagen de referencia (foto real del producto, textura…)
// vía /api/upload y expone su URL como output {url} para alimentar al nodo Video.
export function AssetNode({ id, data, selected }: NodeProps<PipelineNode>) {
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);
  const removeNode = usePipelineStore((s) => s.removeNode);
  const url = (data.output?.url as string) ?? "";
  const status = data.status ?? "idle";
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onFile(file: File) {
    setUploading(true);
    updateNodeData(id, { status: "running", error: undefined });
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json?.error ?? "No se pudo subir.");
      updateNodeData(id, { status: "done", output: { url: json.url } });
    } catch (e: any) {
      updateNodeData(id, { status: "error", error: e?.message ?? "Error al subir." });
    } finally {
      setUploading(false);
    }
  }

  return (
    <NodeShell
      name={data.label}
      placeholder="Asset"
      onRename={(v) => updateNodeData(id, { label: v })}
      onDelete={() => removeNode(id)}
      subtitle="imagen subida"
      accent="#f59e0b"
      status={status}
      selected={selected}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="nodrag w-full rounded-lg bg-ink px-3 py-2 text-[12px] font-semibold text-white shadow-soft transition hover:opacity-90 disabled:opacity-50"
      >
        {uploading ? "Subiendo…" : url ? "Reemplazar imagen" : "Subir imagen"}
      </button>

      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="nodrag block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="asset" className="w-full rounded-lg border border-line object-cover" />
        </a>
      ) : (
        <div className="grid h-24 place-items-center rounded-lg border border-dashed border-line text-[11px] text-ink-mute">
          arrastra o sube una imagen
        </div>
      )}

      {data.error && <p className="text-[10.5px] text-red-600">{data.error}</p>}

      <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !border-2 !border-white !bg-amber-500" />
    </NodeShell>
  );
}
