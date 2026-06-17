"use client";

import { useEffect } from "react";
import type { NodeKind } from "@/lib/pipelineGraph";

// Menú contextual del lienzo (clic derecho en vacío → agregar nodo).
// Estilo Agency Floor light, coherente con el resto de la app.

const ITEMS: { kind: NodeKind; label: string; hint: string; accent: string }[] = [
  { kind: "project", label: "Proyecto", hint: "contexto / brief", accent: "#0ea5e9" },
  { kind: "promptAgent", label: "Agente Prompt", hint: "Opus 4.8 · imagen/video", accent: "#8b5cf6" },
  { kind: "image", label: "Imagen", hint: "GPT Image", accent: "#10b981" },
  { kind: "asset", label: "Asset", hint: "subir imagen", accent: "#f59e0b" },
  { kind: "video", label: "Video", hint: "Seedance 2.0", accent: "#ec4899" },
];

export function PaneContextMenu({
  x,
  y,
  onPick,
  onClose,
  title = "Agregar nodo",
  allow,
}: {
  x: number;
  y: number;
  onPick: (kind: NodeKind) => void;
  onClose: () => void;
  title?: string;
  allow?: NodeKind[];
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const items = allow ? ITEMS.filter((it) => allow.includes(it.kind)) : ITEMS;

  return (
    <div
      className="fixed z-50 w-52 overflow-hidden rounded-xl border border-line bg-white/95 p-1.5 shadow-lift backdrop-blur-xl"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-mute">
        {title}
      </div>
      {items.map((it) => (
        <button
          key={it.kind}
          type="button"
          onClick={() => onPick(it.kind)}
          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-ink/[0.04]"
        >
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: it.accent }} />
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-medium text-ink">{it.label}</span>
            <span className="block text-[10px] text-ink-mute">{it.hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
