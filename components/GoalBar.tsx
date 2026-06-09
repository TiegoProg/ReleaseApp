"use client";

import { useState } from "react";
import { useUiStore } from "@/lib/uiStore";

const EXAMPLE_GOAL =
  "Lanzar campaña de adquisición para [marca], un [producto en 1 línea], dirigida a [audiencia], con presupuesto mensual de [$] y meta de [200 leads/mes a CPA < $15] en 30 días. Canales: Meta + TikTok. Tono: cercano y directo. Coordina a las áreas: Investigación define 3 ángulos, audiencia y split de presupuesto; Creativo entrega por ángulo 2 conceptos (1 video, 1 imagen) con copy y brief visual; Contenido propone 5 temas con guion corto; Medios arma el plan de pauta de 14 días con KPIs. Entrega un plan integrado y marca qué necesitas que apruebe.";

function Badge({ ok, label, off }: { ok: boolean; label: string; off?: string }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
        ok
          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
          : "border-slate-500/30 bg-slate-500/10 text-slate-400"
      }`}
      title={ok ? `${label} conectado` : off}
    >
      {label}: {ok ? "on" : off ?? "off"}
    </span>
  );
}

export default function GoalBar({
  onLaunch,
  onReset,
}: {
  onLaunch: (goal: string) => Promise<void> | void;
  onReset: () => void;
}) {
  const config = useUiStore((s) => s.config);
  const status = useUiStore((s) => s.status);
  const campaignId = useUiStore((s) => s.campaignId);
  const storedGoal = useUiStore((s) => s.goal);

  const [goal, setGoal] = useState("");
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const running = status === "running";
  const hasCampaign = !!campaignId;

  async function launch() {
    if (!goal.trim()) return;
    setError(null);
    setLaunching(true);
    try {
      await onLaunch(goal.trim());
    } catch (e: any) {
      setError(e?.message ?? "No se pudo lanzar la campaña.");
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div className="border-b border-white/10 bg-black/30 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-sky-400 to-fuchsia-500 text-sm font-black text-black">
            O
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-100">Orbita</div>
            <div className="text-[10px] text-slate-400">agencia agéntica</div>
          </div>
        </div>

        {!hasCampaign ? (
          <div className="flex flex-1 items-end gap-2">
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) launch();
              }}
              rows={1}
              placeholder="Escribe el objetivo global de la campaña (Goal)…  ej: Lanzar campaña de adquisición para [marca], audiencia [X], presupuesto [$], meta [Y] en 30 días."
              className="scroll-thin max-h-24 min-h-[40px] flex-1 resize-y rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-400/50"
            />
            <div className="flex shrink-0 flex-col gap-1">
              <button
                onClick={launch}
                disabled={launching || !goal.trim() || !config?.hasAnthropic}
                className="h-[40px] rounded-lg bg-gradient-to-r from-sky-500 to-fuchsia-500 px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {launching ? "Lanzando…" : "Lanzar 🚀"}
              </button>
              <button
                onClick={() => setGoal(EXAMPLE_GOAL)}
                className="text-[10px] text-slate-500 hover:text-slate-300"
              >
                usar ejemplo
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-slate-200" title={storedGoal}>
                {storedGoal}
              </div>
              <div className="text-[11px] text-slate-400">
                {running ? "● campaña en curso…" : status === "done" ? "✓ campaña completada" : status === "error" ? "⚠ terminó con error" : ""}
              </div>
            </div>
            <button
              onClick={onReset}
              className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
            >
              Nueva campaña
            </button>
          </div>
        )}

        <div className="hidden shrink-0 items-center gap-1.5 lg:flex">
          <Badge ok={!!config?.hasAnthropic} label="Anthropic" off="falta key" />
          <Badge ok={!!config?.hasSupabase} label="Supabase" off="memoria" />
          <Badge ok={!!config?.hasOpenAI} label="OpenAI" off="stub" />
          <Badge ok={!!config?.hasKling} label="Kling" off="stub" />
        </div>
      </div>

      {error && <div className="px-4 pb-2 text-xs text-red-400">{error}</div>}
      {!config?.hasAnthropic && (
        <div className="border-t border-amber-400/20 bg-amber-400/[0.06] px-4 py-1.5 text-[11px] text-amber-300">
          Falta <code>ANTHROPIC_API_KEY</code>. Crea <code>.env.local</code> con tu key y reinicia <code>npm run dev</code>.
        </div>
      )}
    </div>
  );
}
