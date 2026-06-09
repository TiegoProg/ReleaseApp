"use client";

import { useEffect, useRef } from "react";
import { useUiStore, type Entry } from "@/lib/uiStore";

function EntryView({ e }: { e: Entry }) {
  switch (e.kind) {
    case "text":
      if (e.role === "user")
        return (
          <div className="ml-6 rounded-lg border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-sm text-sky-100">
            <span className="mr-2 text-[10px] uppercase tracking-wide text-sky-300">tú</span>
            {e.text}
          </div>
        );
      return (
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
          {e.text}
          {e.open && <span className="ml-0.5 inline-block animate-pulse">▋</span>}
        </div>
      );
    case "tool_call":
      return (
        <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/[0.06] px-3 py-2 text-xs">
          <div className="mb-1 font-mono text-cyan-300">⚙ {e.tool}</div>
          <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[11px] text-slate-400">
            {safeJson(e.input)}
          </pre>
        </div>
      );
    case "tool_result":
      return (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
          <span className="mr-2 font-mono text-emerald-300">↳ {e.tool}</span>
          <span className="whitespace-pre-wrap">{e.summary}</span>
        </div>
      );
    case "deliverable":
      return (
        <div className="rounded-lg border border-fuchsia-400/30 bg-fuchsia-400/[0.07] px-3 py-2 text-xs">
          <div className="font-medium text-fuchsia-200">
            📦 Entregable · {e.dtype} — {e.title}
          </div>
          {e.payload?.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={e.payload.url}
              alt={e.title}
              className="mt-2 max-h-44 rounded-md border border-white/10"
            />
          )}
        </div>
      );
    case "request":
      return (
        <div className="rounded-lg border border-amber-400/40 bg-amber-400/[0.08] px-3 py-2 text-sm text-amber-100">
          <div className="text-[10px] uppercase tracking-wide text-amber-300">pide aprobación</div>
          {e.question}
          {e.options?.length > 0 && (
            <div className="mt-1 text-xs text-amber-200/80">Opciones: {e.options.join(" · ")}</div>
          )}
        </div>
      );
    case "error":
      return (
        <div className="rounded-lg border border-red-400/40 bg-red-400/[0.08] px-3 py-2 text-sm text-red-200">
          ⚠ {e.message}
        </div>
      );
  }
}

export default function ActivityStream({ agentId }: { agentId: string }) {
  const entries = useUiStore((s) => s.transcripts[agentId]) ?? [];
  const endRef = useRef<HTMLDivElement>(null);
  const last = entries[entries.length - 1];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries.length, last]);

  if (entries.length === 0) {
    return (
      <div className="px-1 py-6 text-center text-sm text-slate-500">
        Sin actividad todavía. Este agente aún no ha actuado.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {entries.map((e, i) => (
        <EntryView key={i} e={e} />
      ))}
      <div ref={endRef} />
    </div>
  );
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
