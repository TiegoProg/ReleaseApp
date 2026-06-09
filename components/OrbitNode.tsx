"use client";

import type { AgentStatus } from "@/lib/types";
import { AREAS } from "@/lib/types";
import type { NodeData } from "@/lib/uiStore";

export const STATUS_COLOR: Record<AgentStatus, string> = {
  idle: "#64748b",
  thinking: "#a855f7",
  tool: "#22d3ee",
  waiting: "#f59e0b",
  done: "#22c55e",
  error: "#ef4444",
};

export const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: "En espera",
  thinking: "Pensando",
  tool: "Ejecutando tool",
  waiting: "Espera al usuario",
  done: "Listo",
  error: "Error",
};

export function nodeColor(n: NodeData): string {
  if (n.kind === "director") return "#fbbf24";
  if (n.area) return AREAS[n.area].color;
  return "#94a3b8";
}

export function NodeChip({
  node,
  selected,
  onClick,
}: {
  node: NodeData;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
        selected
          ? "border-sky-400/60 bg-sky-400/10"
          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
      }`}
    >
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{
          backgroundColor: STATUS_COLOR[node.status],
          boxShadow: `0 0 8px ${STATUS_COLOR[node.status]}`,
        }}
      />
      <span className="min-w-0 flex-1 truncate" style={{ color: nodeColor(node) }}>
        {node.role}
      </span>
      <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-400">
        {node.kind === "director" ? "core" : node.kind === "area" ? "área" : "sub"}
      </span>
    </button>
  );
}
