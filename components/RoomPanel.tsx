"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "./Icon";
import ActivityStream from "./ActivityStream";
import { useUiStore, type NodeData } from "@/lib/uiStore";
import { ROOMS, STATUS_META, deliverableLabel } from "@/lib/areaMeta";

export default function RoomPanel() {
  const room = useUiStore((s) => s.selectedRoom);
  const nodes = useUiStore((s) => s.nodes);
  const nodeOrder = useUiStore((s) => s.nodeOrder);
  const deliverables = useUiStore((s) => s.deliverables);
  const campaignId = useUiStore((s) => s.campaignId);
  const selectRoom = useUiStore((s) => s.selectRoom);
  const setOpenDeliverable = useUiStore((s) => s.setOpenDeliverable);

  const meta = room ? ROOMS[room] : null;

  // Agentes de la sala, dirección/área primero y subagentes después.
  const roomAgents = useMemo(() => {
    if (!room) return [] as NodeData[];
    const list = nodeOrder
      .map((id) => nodes[id])
      .filter(Boolean)
      .filter((n) => (room === "director" ? n.kind === "director" : n.area === room));
    return list.sort((a, b) => rank(a) - rank(b));
  }, [room, nodes, nodeOrder]);

  const primary = roomAgents.find((n) => n.kind === "director" || n.kind === "area") ?? roomAgents[0];
  const roomDeliverables = deliverables.filter((d) =>
    room === "director" ? d.area === "director" : d.area === room
  );

  async function sendTo(agentId: string, text: string) {
    if (!campaignId || !text.trim()) return;
    await fetch("/api/agent/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, agentId, text: text.trim() }),
    });
  }

  return (
    <AnimatePresence>
      {room && meta && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => selectRoom(null)}
            className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[2px]"
          />
          <motion.aside
            initial={{ x: 520, opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 520, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 34 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[500px] flex-col border-l border-line bg-canvas shadow-lift"
          >
            {/* header */}
            <div
              className="relative overflow-hidden border-b border-line px-5 py-4"
              style={{ background: `linear-gradient(180deg, ${meta.color}14, transparent)` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-12 w-12 place-items-center rounded-2xl text-white shadow-soft"
                    style={{ background: `linear-gradient(140deg, ${meta.from}, ${meta.to})` }}
                  >
                    <Icon name={meta.icon} size={24} strokeWidth={1.8} />
                  </span>
                  <div>
                    <div className="label-mono">{room === "director" ? "Recepción" : "Sala"}</div>
                    <h2 className="font-display text-[19px] font-bold leading-tight tracking-tighter-2 text-ink">
                      {meta.label}
                    </h2>
                    <p className="mt-0.5 text-[12px] text-ink-soft">{meta.tagline}</p>
                  </div>
                </div>
                <button
                  onClick={() => selectRoom(null)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-white text-ink-soft shadow-soft transition hover:text-ink"
                  aria-label="Cerrar"
                >
                  <Icon name="close" size={17} />
                </button>
              </div>
            </div>

            {/* cuerpo */}
            <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4">
              {roomAgents.length === 0 ? (
                <EmptyRoom hasCampaign={!!campaignId} color={meta.color} />
              ) : (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="label-mono">Agentes ({roomAgents.length})</span>
                  </div>
                  <div className="space-y-2.5">
                    {roomAgents.map((n, i) => (
                      <AgentBlock
                        key={n.id}
                        node={n}
                        defaultOpen={n.id === primary?.id || n.status === "waiting"}
                        index={i}
                        onReply={campaignId ? (t) => sendTo(n.id, t) : undefined}
                      />
                    ))}
                  </div>

                  {roomDeliverables.length > 0 && (
                    <div className="mt-6">
                      <span className="label-mono">Entregables en el board ({roomDeliverables.length})</span>
                      <div className="mt-2 grid gap-2">
                        {roomDeliverables.map((d) => (
                          <button
                            key={d.id}
                            onClick={() => setOpenDeliverable(d)}
                            className="lift group block w-full rounded-xl border border-line bg-white p-3 text-left shadow-soft"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="rounded-md px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wide text-white"
                                style={{ background: meta.color }}
                              >
                                {deliverableLabel(d.type)}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{d.title}</span>
                              <Icon
                                name="arrow-right"
                                size={14}
                                className="shrink-0 text-ink-mute transition-transform group-hover:translate-x-0.5"
                              />
                            </div>
                            {d.payload?.url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={d.payload.url}
                                alt={d.title}
                                className="mt-2 max-h-44 w-full rounded-lg border border-line object-cover"
                              />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* chat / instrucciones */}
            {primary && campaignId && (
              <ChatBox campaignId={campaignId} agentId={primary.id} color={meta.color} agentName={primary.role} />
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function rank(n: NodeData): number {
  if (n.kind === "director") return 0;
  if (n.kind === "area") return 1;
  return 2;
}

function AgentBlock({
  node,
  defaultOpen,
  index,
  onReply,
}: {
  node: NodeData;
  defaultOpen: boolean;
  index: number;
  onReply?: (text: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const sm = STATUS_META[node.status];
  const tag = node.kind === "director" ? "Director" : node.kind === "area" ? "Agente de área" : "Subagente";

  return (
    <div
      className="animate-rise overflow-hidden rounded-2xl border border-line bg-white shadow-soft"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left transition hover:bg-surface-sunken"
      >
        <span
          className={`dot ${sm.live ? "dot-live" : ""}`}
          style={{ background: sm.color, color: sm.color }}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold text-ink">{node.role}</div>
          <div className="text-[11px] text-ink-mute">
            {tag} · <span style={{ color: sm.color }}>{sm.label}</span>
          </div>
        </div>
        <Icon
          name="chevron"
          size={16}
          className={`text-ink-mute transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-line px-3.5 py-3">
              <ActivityStream agentId={node.id} onReply={onReply} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChatBox({
  campaignId,
  agentId,
  color,
  agentName,
}: {
  campaignId: string;
  agentId: string;
  color: string;
  agentName: string;
}) {
  const [text, setText] = useState("");
  const [resourceMode, setResourceMode] = useState(false);
  const [sending, setSending] = useState(false);

  async function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    const payload = resourceMode ? `[RECURSO] ${text.trim()}` : text.trim();
    try {
      await fetch("/api/agent/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, agentId, text: payload }),
      });
      setText("");
      setResourceMode(false);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t border-line bg-white/70 p-3.5 backdrop-blur">
      <div className="mb-2 flex items-center gap-2">
        <button
          onClick={() => setResourceMode((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
            resourceMode
              ? "border-area-creative/40 bg-area-creative/10 text-area-creative"
              : "border-line text-ink-mute hover:text-ink-soft"
          }`}
        >
          <Icon name="paperclip" size={13} />
          {resourceMode ? "Recurso" : "Adjuntar"}
        </button>
        <span className="truncate text-[11px] text-ink-mute">
          {resourceMode ? "Se enviará como recurso." : `Instruye a ${agentName} para iterar.`}
        </span>
      </div>
      <div className="flex items-end gap-2 rounded-2xl border border-line bg-white p-2 shadow-soft focus-within:ring-2 focus-within:ring-area-research/20">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
          }}
          rows={2}
          placeholder={
            resourceMode
              ? "Pega un dato, link, referencia o contexto…"
              : "Ej: hazlo más agresivo y enfócate en el ángulo de urgencia…"
          }
          className="scroll-thin max-h-32 flex-1 resize-none bg-transparent px-1.5 py-1 text-[13.5px] text-ink outline-none placeholder:text-ink-mute"
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white shadow-soft transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: color }}
          aria-label="Enviar"
        >
          <Icon name="send" size={17} />
        </button>
      </div>
    </div>
  );
}

function EmptyRoom({ hasCampaign, color }: { hasCampaign: boolean; color: string }) {
  return (
    <div className="grid place-items-center px-6 py-16 text-center">
      <span
        className="mb-4 grid h-14 w-14 place-items-center rounded-2xl"
        style={{ background: `${color}1a`, color }}
      >
        <Icon name="sparkle" size={26} />
      </span>
      <p className="text-[14px] font-semibold text-ink">
        {hasCampaign ? "Esta sala aún no tiene agentes" : "Sin campaña activa"}
      </p>
      <p className="mt-1 max-w-[28ch] text-[12.5px] text-ink-mute">
        {hasCampaign
          ? "El Director la activará cuando delegue trabajo a esta área."
          : "Lanza un briefing desde la planta para montar la agencia."}
      </p>
    </div>
  );
}
