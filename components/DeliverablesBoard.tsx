"use client";

import { Icon } from "./Icon";
import { useUiStore, type DeliverableLite } from "@/lib/uiStore";
import { ROOMS, deliverableLabel, type RoomKey } from "@/lib/areaMeta";

const COLUMNS: RoomKey[] = ["director", "research", "creative", "content", "media"];

export default function DeliverablesBoard({ query }: { query: string }) {
  const deliverables = useUiStore((s) => s.deliverables);
  const campaignId = useUiStore((s) => s.campaignId);
  const setOpenDeliverable = useUiStore((s) => s.setOpenDeliverable);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? deliverables.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.type.toLowerCase().includes(q) ||
          deliverableLabel(d.type).toLowerCase().includes(q)
      )
    : deliverables;

  if (!campaignId) {
    return (
      <Empty
        title="Aún no hay entregables"
        body="Lanza un briefing desde la planta. Cada sala publicará aquí sus piezas a medida que trabaja."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {COLUMNS.map((k) => {
        const room = ROOMS[k];
        const items = filtered.filter((d) =>
          k === "director" ? d.area === "director" : d.area === k
        );
        return (
          <div key={k} className="flex flex-col rounded-2xl border border-line bg-white/60 p-2.5 shadow-soft">
            <div className="mb-2 flex items-center gap-2 px-1.5 pt-1">
              <span
                className="grid h-7 w-7 place-items-center rounded-lg text-white"
                style={{ background: `linear-gradient(140deg, ${room.from}, ${room.to})` }}
              >
                <Icon name={room.icon} size={15} strokeWidth={1.9} />
              </span>
              <span className="flex-1 truncate text-[13px] font-semibold text-ink">{room.short}</span>
              <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                {items.length}
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-2">
              {items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-[11.5px] text-ink-mute">
                  Sin piezas
                </div>
              ) : (
                items.map((d, i) => (
                  <DeliverableCard key={d.id} d={d} color={room.color} index={i} onOpen={() => setOpenDeliverable(d)} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DeliverableCard({
  d,
  color,
  index,
  onOpen,
}: {
  d: DeliverableLite;
  color: string;
  index: number;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      style={{ animationDelay: `${index * 40}ms` }}
      className="animate-rise lift group overflow-hidden rounded-xl border border-line bg-white p-3 text-left shadow-soft"
    >
      <div className="flex items-center gap-2">
        <span
          className="rounded-md px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-white"
          style={{ background: color }}
        >
          {deliverableLabel(d.type)}
        </span>
      </div>
      <div className="mt-1.5 line-clamp-2 text-[13px] font-medium leading-snug text-ink">{d.title}</div>
      {d.payload?.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={d.payload.url}
          alt={d.title}
          className="mt-2 max-h-32 w-full rounded-lg border border-line object-cover"
        />
      )}
      <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-ink-mute transition group-hover:text-ink">
        Abrir informe
        <Icon name="arrow-right" size={13} className="transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="surface grid place-items-center rounded-3xl px-6 py-20 text-center">
      <span className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-surface-sunken text-ink-mute">
        <Icon name="board" size={30} />
      </span>
      <p className="font-display text-[18px] font-bold text-ink">{title}</p>
      <p className="mt-1.5 max-w-sm text-[13.5px] text-ink-soft">{body}</p>
    </div>
  );
}
