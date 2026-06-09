"use client";

import { useEffect, useRef } from "react";
import { useUiStore, type Entry } from "@/lib/uiStore";
import { Icon, type GlyphName } from "./Icon";
import { deliverableLabel } from "@/lib/areaMeta";

// Traduce cada tool a una frase en lenguaje claro (nada de JSON crudo).
const TOOL_VERB: Record<string, (i: any) => { label: string; icon: GlyphName; detail?: string }> = {
  write_brief: (i) => ({ label: "Redacta el brief estratégico", icon: "research", detail: i?.title }),
  write_copy: (i) => ({ label: `Escribe el copy${i?.format ? ` (${i.format})` : ""}`, icon: "creative", detail: i?.title }),
  write_script: (i) => ({ label: "Escribe un guion", icon: "content", detail: i?.title }),
  content_calendar: (i) => ({ label: "Arma el calendario de contenido", icon: "content", detail: i?.title }),
  allocate_budget: (i) => ({ label: "Distribuye el presupuesto", icon: "media", detail: i?.title }),
  channel_plan: (i) => ({ label: "Planifica la pauta", icon: "media", detail: i?.title }),
  generate_image: (i) => ({ label: "Genera una imagen de anuncio", icon: "image", detail: i?.headline || i?.title }),
  generate_video: (i) => ({ label: "Genera un video", icon: "image", detail: i?.title }),
  web_search: (i) => ({ label: "Investiga en la web", icon: "search", detail: i?.query }),
  delegate_to_area: (i) => ({ label: `Delega al área ${i?.area ?? ""}`.trim(), icon: "director", detail: i?.objective }),
  request_user_input: (i) => ({ label: "Te hace una consulta", icon: "help", detail: i?.question }),
  spawn_subagent: (i) => ({ label: "Abre un subagente", icon: "sparkle", detail: i?.role || i?.task }),
  read_board: () => ({ label: "Revisa el board del equipo", icon: "board" }),
};

function EntryView({
  e,
  onReply,
  onOpenDeliverable,
}: {
  e: Entry;
  onReply?: (text: string) => void;
  onOpenDeliverable?: (d: { area: string; type: string; title: string; payload: any }) => void;
}) {
  switch (e.kind) {
    case "text":
      if (e.role === "user")
        return (
          <div className="ml-6 rounded-2xl rounded-tr-sm border border-area-research/25 bg-area-research/[0.07] px-3.5 py-2.5 text-[13.5px] text-ink">
            <span className="mb-0.5 block font-mono text-[9.5px] uppercase tracking-[0.12em] text-area-research">
              tú
            </span>
            {e.text}
          </div>
        );
      return (
        <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-soft">
          {e.text}
          {e.open && <span className="ml-0.5 inline-block animate-pulse text-area-research">▋</span>}
        </div>
      );

    case "tool_call": {
      const v = TOOL_VERB[e.tool]?.(e.input) ?? { label: e.tool, icon: "sparkle" as GlyphName };
      return (
        <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-sunken px-3 py-2">
          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white text-ink-soft shadow-soft">
            <Icon name={v.icon} size={14} />
          </span>
          <div className="min-w-0">
            <div className="text-[12.5px] font-medium text-ink">{v.label}</div>
            {v.detail && <div className="line-clamp-1 text-[12px] text-ink-mute">{v.detail}</div>}
          </div>
        </div>
      );
    }

    case "tool_result":
      return (
        <div className="flex items-center gap-2 pl-1 text-[12px] text-ink-mute">
          <Icon name="check" size={13} className="shrink-0 text-emerald-500" />
          <span className="line-clamp-1">{e.summary}</span>
        </div>
      );

    case "deliverable":
      return (
        <button
          onClick={() => onOpenDeliverable?.({ area: e.area, type: e.dtype, title: e.title, payload: e.payload })}
          className="lift group block w-full overflow-hidden rounded-xl border border-area-content/25 bg-area-content/[0.05] px-3.5 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-area-content px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-white">
              {deliverableLabel(e.dtype)}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{e.title}</span>
            <span className="inline-flex items-center gap-0.5 text-[11.5px] font-semibold text-area-content">
              Abrir informe
              <Icon name="arrow-right" size={13} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
          {e.payload?.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={e.payload.url} alt={e.title} className="mt-2 max-h-40 w-full rounded-lg border border-line object-cover" />
          )}
        </button>
      );

    case "request":
      return (
        <div className="rounded-xl border border-amber-300/80 bg-amber-50 px-3.5 py-3 text-[13px] text-amber-900 shadow-soft">
          <div className="mb-1 flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-amber-600">
            <span className="dot dot-live" style={{ background: "#d97706", color: "#d97706" }} />
            Necesita tu decisión
          </div>
          <div className="font-medium leading-snug">{e.question}</div>
          {e.options?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {e.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => onReply?.(opt)}
                  disabled={!onReply}
                  className="rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-amber-800 shadow-soft transition hover:bg-amber-100 disabled:opacity-60"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      );

    case "error":
      return (
        <div className="rounded-xl border border-red-300/70 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-800">
          ⚠ {e.message}
        </div>
      );
  }
}

export default function ActivityStream({
  agentId,
  onReply,
}: {
  agentId: string;
  onReply?: (text: string) => void;
}) {
  const entries = useUiStore((s) => s.transcripts[agentId]) ?? [];
  const setOpenDeliverable = useUiStore((s) => s.setOpenDeliverable);
  const endRef = useRef<HTMLDivElement>(null);
  const last = entries[entries.length - 1];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries.length, last]);

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-[13px] text-ink-mute">
        Sin actividad todavía. Este agente aún no ha actuado.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {entries.map((e, i) => (
        <EntryView
          key={i}
          e={e}
          onReply={onReply}
          onOpenDeliverable={(d) =>
            setOpenDeliverable({ id: `${agentId}-${i}`, area: d.area, type: d.type, title: d.title, payload: d.payload })
          }
        />
      ))}
      <div ref={endRef} />
    </div>
  );
}
