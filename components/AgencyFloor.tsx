"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import ModuleCard from "./ModuleCard";
import { ROOMS, AREA_ROOM_KEYS, STATUS_META, BRAND } from "@/lib/areaMeta";
import { useUiStore, roomStats, roomSignal } from "@/lib/uiStore";
import type { AreaKey } from "@/lib/types";

const EXAMPLE_GOAL =
  "Lanzar campaña de adquisición para [marca], un [producto en 1 línea], dirigida a [audiencia], con presupuesto mensual de [$] y meta de [200 leads/mes a CPA < $15] en 30 días. Canales: Meta + TikTok. Tono: cercano y directo. Coordina a las áreas: Investigación define 3 ángulos, audiencia y split de presupuesto; Creativo entrega por ángulo 2 conceptos (1 video, 1 imagen) con copy y brief visual; Contenido propone 5 temas con guion corto; Medios arma el plan de pauta de 14 días con KPIs. Entrega un plan integrado y marca qué necesitas que apruebe.";

// Anclas (en %) de cada sala sobre la planta, para dibujar los corredores en lg.
const ANCHORS: Record<AreaKey, { x: number; y: number }> = {
  research: { x: 18, y: 30 },
  content: { x: 18, y: 72 },
  creative: { x: 82, y: 30 },
  media: { x: 82, y: 72 },
};

export default function AgencyFloor({
  query,
  onRequestLaunch,
  onReset,
}: {
  query: string;
  onRequestLaunch: (goal: string) => void;
  onReset: () => void;
}) {
  const nodes = useUiStore((s) => s.nodes);
  const deliverables = useUiStore((s) => s.deliverables);
  const transcripts = useUiStore((s) => s.transcripts);
  const campaignId = useUiStore((s) => s.campaignId);
  const selectRoom = useUiStore((s) => s.selectRoom);

  const lite = { nodes, deliverables, transcripts } as any;
  const locked = !campaignId;

  const q = query.trim().toLowerCase();
  const matches = (k: string) => {
    if (!q) return true;
    const r = ROOMS[k as keyof typeof ROOMS];
    return (
      r.label.toLowerCase().includes(q) ||
      r.short.toLowerCase().includes(q) ||
      r.tagline.toLowerCase().includes(q)
    );
  };

  const placement: Record<AreaKey, string> = {
    research: "lg:col-start-1 lg:row-start-1",
    content: "lg:col-start-1 lg:row-start-2",
    creative: "lg:col-start-3 lg:row-start-1",
    media: "lg:col-start-3 lg:row-start-2",
  };

  return (
    <div className="floor-plate flex min-h-full flex-col p-3 md:p-5 lg:p-6">
      {/* cabecera de planta */}
      <div className="relative mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="label-mono">Planta · {BRAND}</span>
          <span className="hidden h-3 w-px bg-line sm:block" />
          <span className="hidden text-[12px] text-ink-mute sm:block">
            {locked ? "Esperando briefing" : "Operación en vivo"}
          </span>
        </div>
        <FloorLegend />
      </div>

      {/* corredores + grilla de salas (ocupa el alto restante) */}
      <div className="relative min-h-0 flex-1">
        <svg
          className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {AREA_ROOM_KEYS.map((k) => {
            const a = ANCHORS[k];
            const st = roomStats(lite, k);
            const active = st.active;
            const r = ROOMS[k];
            return (
              <g key={k}>
                <path
                  d={`M50 50 L ${a.x} ${a.y}`}
                  fill="none"
                  stroke={active ? r.color : "rgba(11,16,32,0.10)"}
                  strokeWidth={active ? 0.5 : 0.35}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  className={active ? "corridor" : ""}
                  style={{ opacity: active ? 0.9 : 0.6 }}
                />
                <circle cx={a.x} cy={a.y} r={active ? 0.9 : 0.6} fill={active ? r.color : "rgba(11,16,32,0.18)"} />
              </g>
            );
          })}
          <circle cx="50" cy="50" r="1.1" fill="#f59e0b" opacity="0.8" />
        </svg>

        <div className="relative z-10 grid auto-rows-fr grid-cols-1 gap-3.5 md:grid-cols-2 lg:h-full lg:grid-cols-3 lg:grid-rows-2">
          {(["research", "content"] as AreaKey[]).map((k, i) => (
            <div
              key={k}
              className={`${placement[k]} min-h-0 transition-opacity duration-300 ${matches(k) ? "" : "opacity-35"}`}
            >
              <ModuleCard
                room={ROOMS[k]}
                stats={roomStats(lite, k)}
                signal={roomSignal(lite, k)}
                locked={locked}
                index={i}
                onEnter={() => selectRoom(k)}
              />
            </div>
          ))}

          {/* Recepción / Dirección (centro) — aloja "escribe el objetivo" */}
          <div className="order-first min-h-0 md:col-span-2 lg:order-none lg:col-span-1 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <DirectorCore onRequestLaunch={onRequestLaunch} onReset={onReset} onEnter={() => selectRoom("director")} />
          </div>

          {(["creative", "media"] as AreaKey[]).map((k, i) => (
            <div
              key={k}
              className={`${placement[k]} min-h-0 transition-opacity duration-300 ${matches(k) ? "" : "opacity-35"}`}
            >
              <ModuleCard
                room={ROOMS[k]}
                stats={roomStats(lite, k)}
                signal={roomSignal(lite, k)}
                locked={locked}
                index={i + 2}
                onEnter={() => selectRoom(k)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DirectorCore({
  onRequestLaunch,
  onReset,
  onEnter,
}: {
  onRequestLaunch: (goal: string) => void;
  onReset: () => void;
  onEnter: () => void;
}) {
  const config = useUiStore((s) => s.config);
  const campaignId = useUiStore((s) => s.campaignId);
  const goal = useUiStore((s) => s.goal);
  const status = useUiStore((s) => s.status);
  const nodes = useUiStore((s) => s.nodes);
  const deliverables = useUiStore((s) => s.deliverables);
  const transcripts = useUiStore((s) => s.transcripts);
  const totalAgents = useUiStore((s) => s.nodeOrder.length);
  // Calculado FUERA del selector para no devolver un objeto nuevo en cada lectura.
  const dirStats = roomStats({ nodes, deliverables } as any, "director");
  const dirSignal = roomSignal({ nodes, deliverables, transcripts } as any, "director");
  const totalDeliverables = deliverables.length;

  const [draft, setDraft] = useState("");

  function openLaunch() {
    if (!draft.trim() || !config?.hasAnthropic) return;
    onRequestLaunch(draft.trim());
  }

  const locked = !campaignId;

  return (
    <div className="animate-rise relative flex h-full min-h-[260px] flex-col overflow-hidden rounded-3xl border border-line bg-white p-5 shadow-soft md:p-6">
      <div
        className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-56 w-72 rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(circle,#fbbf2455,transparent 70%)" }}
      />

      <div className="relative flex items-center justify-between">
        <span className="label-mono">Recepción · Dirección</span>
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-50 text-area-director">
          <Icon name="director" size={18} strokeWidth={1.9} />
        </span>
      </div>

      {locked ? (
        // ---- Sin campaña: compositor del objetivo ----
        <div className="relative mt-3 flex flex-1 flex-col">
          <div className="mb-3 flex items-center gap-3">
            <DirectorMark small />
            <div>
              <h3 className="font-display text-[20px] font-bold leading-none tracking-tighter-2 text-ink">
                El Director
              </h3>
              <p className="mt-1 text-[12.5px] text-ink-soft">Escribe el objetivo y monta la agencia.</p>
            </div>
          </div>

          <div className="flex flex-1 flex-col rounded-2xl border border-line bg-surface-sunken p-2 focus-within:ring-2 focus-within:ring-area-director/25">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) openLaunch();
              }}
              placeholder="Ej: Lanzar campaña de adquisición para [marca], audiencia [X], presupuesto [$], meta [Y] en 30 días…"
              className="scroll-thin min-h-[72px] w-full flex-1 resize-none rounded-xl bg-transparent px-2.5 py-2 text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-ink-mute"
            />
            <div className="flex items-center justify-between gap-2 px-1.5 pb-0.5">
              <button
                onClick={() => setDraft(EXAMPLE_GOAL)}
                className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink-mute transition hover:text-ink-soft"
              >
                <Icon name="briefing" size={13} />
                Ejemplo
              </button>
              <button
                onClick={openLaunch}
                disabled={!draft.trim() || !config?.hasAnthropic}
                className="group flex items-center gap-2 rounded-xl px-4 py-2 text-[13.5px] font-semibold text-white shadow-soft transition disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#fbbf24,#f97316)" }}
              >
                Continuar
                <Icon name="arrow-right" size={15} strokeWidth={2.1} className="transition group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>

          {!config?.hasAnthropic && (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11.5px] text-amber-800">
              Falta <code className="font-mono">ANTHROPIC_API_KEY</code> en{" "}
              <code className="font-mono">.env.local</code>.
            </p>
          )}
        </div>
      ) : (
        // ---- Campaña activa: resumen + entrada ----
        <button
          onClick={onEnter}
          className="lift group relative mt-2 flex flex-1 flex-col items-center rounded-2xl text-center"
        >
          <div className="my-3">
            <DirectorMark />
          </div>
          <h3 className="font-display text-[20px] font-bold tracking-tighter-2 text-ink">El Director</h3>
          <p
            className="mt-1 line-clamp-3 max-w-[30ch] text-[12.5px] leading-snug text-ink-soft"
            title={goal}
          >
            {goal || "Coordinando la operación."}
          </p>

          <div className="mt-3">
            <StatusPill status={status} stats={dirStats} />
          </div>

          {dirSignal.needsInput && dirSignal.question && (
            <div className="mt-3 w-full rounded-xl border border-amber-200 bg-amber-50/80 p-2.5 text-left">
              <div className="mb-1 flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-600">
                <span className="dot dot-live" style={{ background: "#d97706", color: "#d97706" }} />
                El Director te consulta
              </div>
              <p className="line-clamp-2 text-[12px] font-medium leading-snug text-amber-900">
                {dirSignal.question}
              </p>
            </div>
          )}

          <div className="mt-auto flex w-full items-center justify-between border-t border-line pt-4 text-[11.5px] text-ink-mute">
            <span className="inline-flex items-center gap-1">
              <span className="font-display text-[14px] font-bold text-ink">{totalAgents}</span>agentes
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="font-display text-[14px] font-bold text-ink">{totalDeliverables}</span>piezas
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-area-director">
              Entrar
              <Icon name="arrow-right" size={15} strokeWidth={2} className="transition-transform duration-300 group-hover:translate-x-1" />
            </span>
          </div>
        </button>
      )}

      {!locked && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onReset();
          }}
          className="relative mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-[12.5px] font-semibold text-ink-soft shadow-soft transition hover:text-ink"
        >
          <Icon name="plus" size={15} strokeWidth={2.1} />
          Nuevo briefing
        </button>
      )}
    </div>
  );
}

function DirectorMark({ small }: { small?: boolean }) {
  const s = small ? 56 : 92;
  return (
    <div className="relative grid place-items-center" style={{ height: s, width: s }}>
      <svg className="absolute inset-0 animate-spin-slow" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="46" fill="none" stroke="#f59e0b" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="3 8" />
      </svg>
      <svg
        className="absolute inset-0 animate-spin-slow"
        style={{ animationDirection: "reverse", animationDuration: "26s" }}
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        <circle cx="50" cy="50" r="34" fill="none" stroke="#fbbf24" strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="1 10" />
      </svg>
      <span
        className="animate-breathe absolute rounded-full opacity-70 blur-md"
        style={{ height: s * 0.55, width: s * 0.55, background: "radial-gradient(circle,#fbbf24,transparent 70%)" }}
      />
      <span
        className="relative grid place-items-center rounded-full text-white shadow-soft"
        style={{ height: s * 0.5, width: s * 0.5, background: "linear-gradient(140deg,#fbbf24,#f97316)" }}
      >
        <Icon name="director" size={small ? 18 : 26} strokeWidth={1.8} />
      </span>
    </div>
  );
}

function StatusPill({ status, stats }: { status: string; stats: { status: any } }) {
  const sm = STATUS_META[stats.status as keyof typeof STATUS_META];
  const phase =
    status === "running"
      ? "Coordinando salas"
      : status === "done"
      ? "Campaña completada"
      : status === "error"
      ? "Detenida por error"
      : "Lista para arrancar";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold"
      style={{ background: sm.tint, color: sm.color }}
    >
      <span className={`dot ${sm.live ? "dot-live" : ""}`} style={{ background: sm.color, color: sm.color }} />
      {phase}
    </span>
  );
}

function FloorLegend() {
  const items = (["thinking", "tool", "waiting", "done"] as const).map((s) => STATUS_META[s]);
  return (
    <div className="hidden items-center gap-3 md:flex">
      {items.map((m) => (
        <span key={m.label} className="inline-flex items-center gap-1.5 text-[11px] text-ink-mute">
          <span className="dot" style={{ background: m.color }} />
          {m.label}
        </span>
      ))}
    </div>
  );
}
