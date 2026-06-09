"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { CampaignRecord } from "@/lib/types";
import { Icon } from "./Icon";

const STATUS_STYLE: Record<string, string> = {
  running: "bg-cyan-50 text-cyan-700",
  done: "bg-emerald-50 text-emerald-700",
  error: "bg-red-50 text-red-700",
};

const STATUS_LABEL: Record<string, string> = {
  running: "En curso",
  done: "Completada",
  error: "Error",
};

export default function ProjectsDrawer({
  open,
  onClose,
  onOpen,
  currentId,
}: {
  open: boolean;
  onClose: () => void;
  onOpen: (id: string) => void;
  currentId: string | null;
}) {
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((d) => setCampaigns(d.campaigns ?? []))
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[2px]"
          />
          <motion.aside
            initial={{ x: -460, opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -460, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 34 }}
            className="fixed left-0 top-0 z-50 flex h-full w-full max-w-[440px] flex-col border-r border-line bg-canvas shadow-lift"
          >
            <div className="flex items-center justify-between border-b border-line bg-white/60 px-5 py-4 backdrop-blur">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-white shadow-soft">
                  <Icon name="projects" size={20} />
                </span>
                <div>
                  <div className="font-display text-[17px] font-bold tracking-tighter-2 text-ink">
                    Proyectos
                  </div>
                  <div className="text-[11.5px] text-ink-mute">
                    {campaigns.length} campaña{campaigns.length === 1 ? "" : "s"} guardada
                    {campaigns.length === 1 ? "" : "s"}
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-white text-ink-soft shadow-soft transition hover:text-ink"
                aria-label="Cerrar"
              >
                <Icon name="close" size={17} />
              </button>
            </div>

            <div className="scroll-thin flex-1 overflow-y-auto p-3.5">
              {loading ? (
                <div className="py-12 text-center text-[13px] text-ink-mute">Cargando…</div>
              ) : campaigns.length === 0 ? (
                <div className="grid place-items-center px-6 py-16 text-center">
                  <span className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-surface-sunken text-ink-mute">
                    <Icon name="briefing" size={26} />
                  </span>
                  <p className="text-[14px] font-semibold text-ink">Aún no hay proyectos</p>
                  <p className="mt-1 max-w-[26ch] text-[12.5px] text-ink-mute">
                    Lanza tu primera campaña desde la planta para verla aquí.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {campaigns.map((c, i) => {
                    const active = c.id === currentId;
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          onOpen(c.id);
                          onClose();
                        }}
                        style={{ animationDelay: `${i * 40}ms` }}
                        className={`animate-rise block w-full rounded-2xl border p-3.5 text-left shadow-soft transition lift ${
                          active ? "border-area-research/50 bg-area-research/[0.06]" : "border-line bg-white"
                        }`}
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                              STATUS_STYLE[c.status] ?? "bg-surface-sunken text-ink-soft"
                            }`}
                          >
                            {STATUS_LABEL[c.status] ?? c.status}
                          </span>
                          <span className="font-mono text-[10px] text-ink-mute">
                            {new Date(c.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="line-clamp-2 text-[13.5px] leading-snug text-ink">{c.goal}</div>
                        {active && (
                          <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-area-research">
                            <span className="dot dot-live" style={{ background: "#0ea5e9", color: "#0ea5e9" }} />
                            Abierta ahora
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
