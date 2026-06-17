"use client";

import type { ReactNode } from "react";
import { Handle, NodeResizer, Position } from "@xyflow/react";
import type { NodeStatus } from "@/lib/pipelineStore";
import type { NodeKind } from "@/lib/pipelineGraph";

// Carcasa visual compartida por los nodos de la pizarra. Mantiene la dirección
// "Agency Floor" (light minimal-tech) y centraliza: redimensionado (NodeResizer)
// y los conectores en los 4 lados (entradas arriba/izquierda, salidas derecha/abajo).

const STATUS_META: Record<NodeStatus, { label: string; color: string }> = {
  idle: { label: "listo", color: "#94a3b8" },
  running: { label: "generando…", color: "#d97706" },
  done: { label: "ok", color: "#16a34a" },
  error: { label: "error", color: "#dc2626" },
};

// Dónde sale cada conector por tipo de nodo. Entradas en Top/Left, salidas en
// Right/Bottom: así cada nodo expone conectores en los cuatro lados. Los ids
// "<puerto>__<lado>" mapean al mismo puerto lógico (ver basePortId).
type HandleDef = { id: string; position: Position };
const HANDLE_LAYOUT: Record<NodeKind, { targets: HandleDef[]; sources: HandleDef[] }> = {
  project: {
    targets: [],
    sources: [
      { id: "out__right", position: Position.Right },
      { id: "out__bottom", position: Position.Bottom },
    ],
  },
  asset: {
    targets: [],
    sources: [
      { id: "out__right", position: Position.Right },
      { id: "out__bottom", position: Position.Bottom },
    ],
  },
  image: {
    targets: [
      { id: "in__top", position: Position.Top },
      { id: "in__left", position: Position.Left },
    ],
    sources: [
      { id: "out__right", position: Position.Right },
      { id: "out__bottom", position: Position.Bottom },
    ],
  },
  promptAgent: {
    targets: [
      { id: "in__top", position: Position.Top },
      { id: "in__left", position: Position.Left },
    ],
    sources: [
      { id: "out__right", position: Position.Right },
      { id: "out__bottom", position: Position.Bottom },
    ],
  },
  video: {
    targets: [
      { id: "prompt", position: Position.Top },
      { id: "images", position: Position.Left },
    ],
    sources: [
      { id: "out__right", position: Position.Right },
      { id: "out__bottom", position: Position.Bottom },
    ],
  },
};

export function NodeShell({
  kind,
  name,
  placeholder,
  onRename,
  onDelete,
  subtitle,
  accent,
  status = "idle",
  selected,
  children,
}: {
  kind: NodeKind;
  name?: string;
  placeholder: string;
  onRename?: (value: string) => void;
  onDelete?: () => void;
  subtitle?: string;
  accent: string;
  status?: NodeStatus;
  selected?: boolean;
  children: ReactNode;
}) {
  const st = STATUS_META[status];
  const layout = HANDLE_LAYOUT[kind];
  // Sin overflow recortado: el dot del handle sobresale medio del borde y debe verse completo.
  const handleClass = "!h-3 !w-3 !border-2 !border-white !shadow";

  return (
    // Contenedor exterior SIN recorte: aquí viven los handles y el resizer para
    // que no se corten en los bordes. La card interior sí redondea/recorta.
    <div className="group relative h-full w-full">
      <NodeResizer
        isVisible={!!selected}
        minWidth={220}
        minHeight={140}
        lineClassName="!border-ink/30"
        handleClassName="!h-2.5 !w-2.5 !rounded-sm !border !border-ink/40 !bg-white"
      />

      {/* conectores: entradas (Top/Left), salidas (Right/Bottom) */}
      {layout.targets.map((h) => (
        <Handle key={h.id} id={h.id} type="target" position={h.position} className={handleClass} style={{ background: accent }} />
      ))}
      {layout.sources.map((h) => (
        <Handle key={h.id} id={h.id} type="source" position={h.position} className={handleClass} style={{ background: accent }} />
      ))}

      <div
        className={`flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-white shadow-soft transition ${
          selected ? "border-ink/40 ring-2 ring-ink/10" : "border-line"
        }`}
      >
        {/* franja de acento + header */}
        <div className="flex shrink-0 items-center gap-2.5 px-3.5 pb-2 pt-3" style={{ borderTop: `3px solid ${accent}` }}>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white" style={{ background: accent }}>
            <Dot />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <input
              value={name ?? ""}
              onChange={(e) => onRename?.(e.target.value)}
              placeholder={placeholder}
              title="Renombrar nodo"
              className="nodrag w-full truncate rounded-md border border-transparent bg-transparent font-display text-[13.5px] font-bold text-ink outline-none transition placeholder:text-ink placeholder:opacity-100 hover:border-line focus:border-line focus:bg-surface-sunken"
            />
            {subtitle && <div className="truncate px-0.5 text-[10.5px] text-ink-mute">{subtitle}</div>}
          </div>
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide"
            style={{ background: `${st.color}1a`, color: st.color }}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${status === "running" ? "animate-pulse" : ""}`}
              style={{ background: st.color }}
            />
            {st.label}
          </span>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              title="Eliminar nodo"
              aria-label="Eliminar nodo"
              className="nodrag grid h-6 w-6 shrink-0 place-items-center rounded-lg text-ink-mute opacity-0 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-2 overflow-auto px-3.5 pb-3.5 pt-1">
          {children}
        </div>
      </div>
    </div>
  );
}

function Dot() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="white" />
      <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.6" opacity="0.6" />
    </svg>
  );
}

// Botón "Run" reutilizable.
export function RunButton({
  onClick,
  running,
  label = "Run",
}: {
  onClick: () => void;
  running?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={running}
      className="nodrag flex w-full items-center justify-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-[12px] font-semibold text-white shadow-soft transition hover:opacity-90 disabled:opacity-50"
    >
      {running ? "Generando…" : `▶ ${label}`}
    </button>
  );
}
