"use client";

import { Icon } from "./Icon";
import type { AreaMeta } from "@/lib/areaMeta";
import { STATUS_META } from "@/lib/areaMeta";
import type { RoomStats, RoomSignal } from "@/lib/uiStore";

export default function ModuleCard({
  room,
  stats,
  signal,
  locked,
  index,
  onEnter,
}: {
  room: AreaMeta;
  stats: RoomStats;
  signal: RoomSignal;
  locked: boolean;
  index: number;
  onEnter: () => void;
}) {
  const sm = STATUS_META[stats.status];
  const dim = locked || stats.agents === 0;
  const needsInput = signal.needsInput && !!signal.question;
  const speaking = !needsInput && stats.active && !!signal.lastText;

  return (
    <button
      onClick={onEnter}
      style={{ animationDelay: `${80 + index * 70}ms` }}
      className={`tilt sheen lift group animate-rise relative flex h-full min-h-[200px] flex-col overflow-hidden rounded-2xl border bg-white p-5 text-left shadow-soft transition hover:border-transparent ${
        needsInput ? "border-amber-300 ring-2 ring-amber-300/60" : "border-line"
      }`}
    >
      {/* halo de color del área */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-60"
        style={{ background: `radial-gradient(circle, ${room.color}66, transparent 70%)` }}
      />
      {/* acento superior */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100"
        style={{ background: `linear-gradient(90deg, ${room.from}, ${room.to})` }}
      />

      <div className="relative flex items-start justify-between">
        <span
          className="grid h-12 w-12 place-items-center rounded-2xl text-white shadow-soft transition-transform duration-500 group-hover:-translate-y-0.5"
          style={{ background: `linear-gradient(140deg, ${room.from}, ${room.to})` }}
        >
          <Icon name={room.icon} size={24} strokeWidth={1.8} />
        </span>

        {dim ? (
          <span className="rounded-full bg-surface-sunken px-2.5 py-1 text-[10.5px] font-semibold text-ink-mute">
            {locked ? "En espera" : "Sin actividad"}
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold"
            style={{ background: sm.tint, color: sm.color }}
          >
            <span
              className={`dot ${sm.live ? "dot-live" : ""}`}
              style={{ background: sm.color, color: sm.color }}
            />
            {sm.label}
          </span>
        )}
      </div>

      <div className="relative mt-4">
        <h3 className="font-display text-[17px] font-bold tracking-tighter-2 text-ink">{room.label}</h3>

        {/* Zona de comunicación en vivo del agente */}
        {needsInput ? (
          <div className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-2.5">
            <div className="mb-1 flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-600">
              <span className="dot dot-live" style={{ background: "#d97706", color: "#d97706" }} />
              Te necesita
            </div>
            <p className="line-clamp-2 text-[12.5px] font-medium leading-snug text-amber-900">
              {signal.question}
            </p>
            {signal.options && signal.options.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {signal.options.slice(0, 3).map((opt, i) => (
                  <span
                    key={i}
                    className="max-w-[140px] truncate rounded-md border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-800"
                  >
                    {opt}
                  </span>
                ))}
                {signal.options.length > 3 && (
                  <span className="px-1 py-0.5 text-[11px] text-amber-600">+{signal.options.length - 3}</span>
                )}
              </div>
            )}
          </div>
        ) : speaking ? (
          <div className="mt-2.5 rounded-xl border border-line bg-surface-sunken p-2.5">
            <div className="mb-1 flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-mute">
              <span className="dot dot-live" style={{ background: sm.color, color: sm.color }} />
              En vivo
            </div>
            <p className="line-clamp-2 text-[12.5px] leading-snug text-ink-soft">{signal.lastText}</p>
          </div>
        ) : (
          <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-ink-soft">{room.tagline}</p>
        )}
      </div>

      <div className="relative mt-auto flex items-center justify-between pt-4">
        <div className="flex items-center gap-3 text-[11.5px] text-ink-mute">
          <span className="inline-flex items-center gap-1">
            <span className="font-display text-[14px] font-bold text-ink">{stats.agents}</span>
            agentes
          </span>
          <span className="h-3 w-px bg-line" />
          <span className="inline-flex items-center gap-1">
            <span className="font-display text-[14px] font-bold text-ink">{stats.deliverables}</span>
            piezas
          </span>
        </div>

        <span
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold transition"
          style={{ color: needsInput ? "#d97706" : room.color }}
        >
          {needsInput ? "Responder" : "Entrar"}
          <Icon
            name="arrow-right"
            size={15}
            strokeWidth={2}
            className="transition-transform duration-300 group-hover:translate-x-1"
          />
        </span>
      </div>
    </button>
  );
}
