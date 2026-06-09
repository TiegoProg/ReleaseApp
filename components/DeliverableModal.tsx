"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "./Icon";
import { DeliverableView, deliverableToMarkdown } from "./DeliverableView";
import { useUiStore } from "@/lib/uiStore";
import { ROOMS, deliverableLabel, type RoomKey } from "@/lib/areaMeta";

export default function DeliverableModal() {
  const d = useUiStore((s) => s.openDeliverable);
  const close = useUiStore((s) => s.setOpenDeliverable);
  const [copied, setCopied] = useState(false);

  const roomKey = (d?.area === "director" ? "director" : d?.area) as RoomKey | undefined;
  const room = roomKey ? ROOMS[roomKey] : undefined;

  function download() {
    if (!d) return;
    const md = deliverableToMarkdown(d.type, d.title, d.payload);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug(d.title)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    if (!d) return;
    try {
      await navigator.clipboard.writeText(deliverableToMarkdown(d.type, d.title, d.payload));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  }

  return (
    <AnimatePresence>
      {d && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => close(null)}
            className="absolute inset-0 bg-ink/30 backdrop-blur-[3px]"
          />
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="relative flex max-h-[86vh] w-full max-w-[660px] flex-col overflow-hidden rounded-3xl border border-line bg-canvas shadow-lift"
          >
            {/* header */}
            <div
              className="flex items-start justify-between gap-3 border-b border-line px-5 py-4"
              style={room ? { background: `linear-gradient(180deg, ${room.color}12, transparent)` } : undefined}
            >
              <div className="flex items-center gap-3">
                {room && (
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white shadow-soft"
                    style={{ background: `linear-gradient(140deg, ${room.from}, ${room.to})` }}
                  >
                    <Icon name={room.icon} size={22} strokeWidth={1.8} />
                  </span>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-md px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wide text-white"
                      style={{ background: room?.color ?? "#64748b" }}
                    >
                      {deliverableLabel(d.type)}
                    </span>
                    {room && <span className="text-[11.5px] text-ink-mute">{room.short}</span>}
                  </div>
                  <h2 className="mt-0.5 font-display text-[19px] font-bold leading-tight tracking-tighter-2 text-ink">
                    {d.title}
                  </h2>
                </div>
              </div>
              <button
                onClick={() => close(null)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-white text-ink-soft shadow-soft transition hover:text-ink"
                aria-label="Cerrar"
              >
                <Icon name="close" size={17} />
              </button>
            </div>

            {/* cuerpo */}
            <div className="scroll-thin flex-1 overflow-y-auto px-5 py-5">
              <DeliverableView type={d.type} title={d.title} payload={d.payload} />
            </div>

            {/* acciones */}
            <div className="flex items-center justify-end gap-2 border-t border-line bg-white/60 px-5 py-3 backdrop-blur">
              <button
                onClick={copy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-[13px] font-semibold text-ink-soft shadow-soft transition hover:text-ink"
              >
                <Icon name={copied ? "check" : "board"} size={15} />
                {copied ? "Copiado" : "Copiar"}
              </button>
              <button
                onClick={download}
                className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-[13px] font-semibold text-white shadow-soft transition hover:opacity-90"
              >
                <Icon name="arrow-right" size={15} strokeWidth={2.1} className="rotate-90" />
                Descargar .md
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "entregable"
  );
}
