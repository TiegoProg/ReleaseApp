"use client";

import { Icon } from "./Icon";
import { Logo } from "./SideNav";
import { useUiStore, pendingRequest } from "@/lib/uiStore";
import { BRAND } from "@/lib/areaMeta";
import type { NavView } from "./SideNav";

const VIEW_META: Record<NavView, { title: string; subtitle: string }> = {
  floor: { title: "Planta de la agencia", subtitle: "Entra a una sala para ver y dirigir a sus agentes" },
  studio: { title: "UGC Studio", subtitle: "Crea avatares consistentes y anímalos a video" },
  pipeline: { title: "Pipeline", subtitle: "Encadena nodos para producir creatividades" },
  board: { title: "Entregables", subtitle: "Todo lo que las salas han publicado en el board" },
  network: { title: "Red de agentes", subtitle: "Topología viva de la orquestación" },
};

export default function TopBar({
  view,
  query,
  onQuery,
  onNewCampaign,
}: {
  view: NavView;
  query: string;
  onQuery: (q: string) => void;
  onNewCampaign: () => void;
}) {
  const meta = VIEW_META[view];
  const campaignId = useUiStore((s) => s.campaignId);
  const waiting = useUiStore((s) =>
    Object.values(s.nodes).reduce(
      (c, n) => c + (pendingRequest(s.transcripts[n.id]) ? 1 : 0),
      0
    )
  );

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/65 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-4 py-3 md:px-6">
        {/* marca compacta en móvil */}
        <div className="flex items-center gap-2.5 lg:hidden">
          <Logo size={30} />
        </div>

        {/* título de vista */}
        <div className="hidden min-w-0 md:block">
          <h1 className="font-display text-[18px] font-bold leading-none tracking-tighter-2 text-ink">
            {meta.title}
          </h1>
          <p className="mt-1 truncate text-[12px] text-ink-mute">{meta.subtitle}</p>
        </div>

        {/* buscador */}
        <div className="ml-auto flex max-w-md flex-1 items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 shadow-soft transition focus-within:border-area-research/50 focus-within:ring-2 focus-within:ring-area-research/15">
          <Icon name="search" size={17} className="text-ink-mute" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Buscar salas, agentes o entregables…"
            className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-mute"
          />
          <kbd className="hidden rounded-md border border-line bg-surface-sunken px-1.5 py-0.5 font-mono text-[10px] text-ink-mute sm:block">
            /
          </kbd>
        </div>

        {/* notificaciones */}
        <button
          className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-white text-ink-soft shadow-soft transition hover:text-ink"
          title={waiting > 0 ? `${waiting} agente(s) esperan tu aprobación` : "Sin novedades"}
        >
          <Icon name="bell" size={18} />
          {waiting > 0 && (
            <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
              {waiting}
            </span>
          )}
        </button>

        {/* CTA nueva campaña (cuando hay una activa) */}
        {campaignId && (
          <button
            onClick={onNewCampaign}
            className="hidden shrink-0 items-center gap-2 rounded-xl bg-ink px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-soft transition hover:opacity-90 sm:flex"
          >
            <Icon name="plus" size={16} strokeWidth={2.2} />
            Nuevo briefing
          </button>
        )}

        {/* operador */}
        <div className="flex shrink-0 items-center gap-2.5 rounded-xl border border-line bg-white px-2 py-1.5 pr-3 shadow-soft">
          <span
            className="grid h-8 w-8 place-items-center rounded-lg font-display text-[13px] font-bold text-white"
            style={{ background: "linear-gradient(135deg,#0b1020,#475569)" }}
          >
            OB
          </span>
          <div className="hidden leading-tight md:block">
            <div className="text-[12.5px] font-semibold text-ink">Operador</div>
            <div className="text-[10px] text-ink-mute">{BRAND}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
