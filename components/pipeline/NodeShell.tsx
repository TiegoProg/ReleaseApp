"use client";

import type { ReactNode } from "react";
import type { NodeStatus } from "@/lib/pipelineStore";

// Carcasa visual compartida por los nodos de la pizarra. Mantiene la dirección
// "Agency Floor" (light minimal-tech): tarjeta blanca, borde fino, sombra suave
// y una franja de acento por categoría.

const STATUS_META: Record<NodeStatus, { label: string; color: string }> = {
  idle: { label: "listo", color: "#94a3b8" },
  running: { label: "generando…", color: "#d97706" },
  done: { label: "ok", color: "#16a34a" },
  error: { label: "error", color: "#dc2626" },
};

export function NodeShell({
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
  return (
    <div
      className={`group w-[268px] overflow-hidden rounded-2xl border bg-white shadow-soft transition ${
        selected ? "border-ink/40 ring-2 ring-ink/10" : "border-line"
      }`}
    >
      {/* franja de acento + header */}
      <div className="flex items-center gap-2.5 px-3.5 pb-2 pt-3" style={{ borderTop: `3px solid ${accent}` }}>
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

      <div className="space-y-2 px-3.5 pb-3.5 pt-1">{children}</div>
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
