"use client";

import { Icon, type GlyphName } from "./Icon";
import { useUiStore } from "@/lib/uiStore";
import { BRAND, BRAND_TAGLINE } from "@/lib/areaMeta";

export type NavView = "floor" | "board" | "network";

const ITEMS: { key: NavView; label: string; icon: GlyphName }[] = [
  { key: "floor", label: "Planta", icon: "home" },
  { key: "board", label: "Entregables", icon: "board" },
  { key: "network", label: "Red de agentes", icon: "network" },
];

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <span
      className="relative grid place-items-center rounded-2xl text-white shadow-soft"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg,#0ea5e9 0%,#8b5cf6 52%,#ec4899 100%)",
      }}
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <ellipse cx="12" cy="12" rx="10" ry="4.4" stroke="white" strokeWidth="1.6" opacity="0.85" transform="rotate(-22 12 12)" />
        <circle cx="12" cy="12" r="3.1" fill="white" />
      </svg>
    </span>
  );
}

export default function SideNav({
  view,
  onView,
  onOpenProjects,
  collapsed,
  onToggle,
}: {
  view: NavView;
  onView: (v: NavView) => void;
  onOpenProjects: () => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const config = useUiStore((s) => s.config);
  const campaignId = useUiStore((s) => s.campaignId);
  const nodeCount = useUiStore((s) => s.nodeOrder.length);
  const systemOk = !!config?.hasAnthropic;

  return (
    <aside
      className={`relative hidden shrink-0 flex-col border-r border-line bg-white/55 backdrop-blur-xl transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:flex ${
        collapsed ? "w-[76px]" : "w-[248px]"
      }`}
    >
      {/* marca + toggle */}
      <div className={`flex items-center gap-3 pb-4 pt-5 ${collapsed ? "justify-center px-2" : "px-5"}`}>
        <Logo />
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <div className="font-display text-[17px] font-bold tracking-tighter-2 text-ink">{BRAND}</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">{BRAND_TAGLINE}</div>
          </div>
        )}
      </div>

      {/* botón colapsar/expandir */}
      <button
        onClick={onToggle}
        title={collapsed ? "Expandir menú" : "Colapsar menú"}
        className="absolute -right-3 top-7 z-10 grid h-6 w-6 place-items-center rounded-full border border-line bg-white text-ink-soft shadow-soft transition hover:text-ink"
      >
        <Icon name="chevron" size={13} strokeWidth={2.2} className={collapsed ? "" : "rotate-180"} />
      </button>

      {/* navegación principal */}
      <nav className={`flex flex-1 flex-col gap-1 ${collapsed ? "px-2" : "px-3"}`}>
        {!collapsed && (
          <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-mute">
            Operación
          </div>
        )}
        {ITEMS.map((it) => {
          const active = view === it.key;
          return (
            <button
              key={it.key}
              onClick={() => onView(it.key)}
              title={collapsed ? it.label : undefined}
              className={`group relative flex items-center rounded-xl text-[14px] font-medium transition ${
                collapsed ? "justify-center px-0 py-3" : "gap-3 px-3 py-2.5"
              } ${active ? "bg-ink text-white shadow-soft" : "text-ink-soft hover:bg-ink/[0.04] hover:text-ink"}`}
            >
              <Icon name={it.icon} size={19} strokeWidth={active ? 1.9 : 1.7} />
              {!collapsed && <span>{it.label}</span>}
              {!collapsed && active && <span className="absolute right-3 h-1.5 w-1.5 rounded-full bg-white/80" />}
            </button>
          );
        })}

        <button
          onClick={onOpenProjects}
          title={collapsed ? "Proyectos" : undefined}
          className={`group flex items-center rounded-xl text-[14px] font-medium text-ink-soft transition hover:bg-ink/[0.04] hover:text-ink ${
            collapsed ? "justify-center px-0 py-3" : "gap-3 px-3 py-2.5"
          }`}
        >
          <Icon name="projects" size={19} />
          {!collapsed && <span>Proyectos</span>}
        </button>

        <div className="mt-auto" />
      </nav>

      {/* estado del sistema */}
      {collapsed ? (
        <div className="mb-4 grid place-items-center">
          <span
            className="dot dot-live h-2.5 w-2.5"
            title={systemOk ? "Sistema operativo" : "Configuración pendiente"}
            style={{ color: systemOk ? "#16a34a" : "#d97706", background: systemOk ? "#16a34a" : "#d97706" }}
          />
        </div>
      ) : (
        <div className="m-3 rounded-2xl border border-line bg-white/70 p-3.5 shadow-soft">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-ink-soft">Estado del sistema</span>
            <span className="dot dot-live" style={{ color: systemOk ? "#16a34a" : "#d97706" }}>
              <span className="dot" style={{ background: systemOk ? "#16a34a" : "#d97706" }} />
            </span>
          </div>
          <div className="space-y-1.5">
            <SysRow label="Claude" ok={!!config?.hasAnthropic} off="falta key" />
            <SysRow label="Memoria" ok={!!config?.hasSupabase} off="efímera" />
            <SysRow label="Imagen" ok={!!config?.hasOpenAI} off="stub" />
            <SysRow label="Video" ok={!!config?.hasKling} off="stub" />
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-[11px] text-ink-mute">
            <span>{campaignId ? `${nodeCount} agentes` : "sin campaña"}</span>
            <span className="font-mono">v0.3</span>
          </div>
        </div>
      )}
    </aside>
  );
}

function SysRow({ label, ok, off }: { label: string; ok: boolean; off: string }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="text-ink-soft">{label}</span>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
        }`}
      >
        <span className="dot" style={{ background: ok ? "#16a34a" : "#d97706" }} />
        {ok ? "on" : off}
      </span>
    </div>
  );
}
