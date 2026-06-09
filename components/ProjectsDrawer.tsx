"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { CampaignRecord } from "@/lib/types";

const STATUS_STYLE: Record<string, string> = {
  running: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  done: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  error: "border-red-400/40 bg-red-400/10 text-red-300",
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
            className="absolute inset-0 z-30 bg-black/50"
          />
          <motion.aside
            initial={{ x: -440, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -440, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 32 }}
            className="absolute left-0 top-0 z-40 flex h-full w-full max-w-[440px] flex-col border-r border-white/10 bg-[#0a0f1c]/95 backdrop-blur"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <div className="text-lg font-semibold text-slate-100">Proyectos</div>
                <div className="text-[11px] text-slate-400">
                  Campañas guardadas ({campaigns.length})
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-400 hover:bg-white/5"
              >
                cerrar ✕
              </button>
            </div>

            <div className="scroll-thin flex-1 overflow-y-auto p-3">
              {loading ? (
                <div className="py-8 text-center text-sm text-slate-500">Cargando…</div>
              ) : campaigns.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  Aún no hay proyectos guardados. Lanza tu primera campaña.
                </div>
              ) : (
                <div className="space-y-2">
                  {campaigns.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        onOpen(c.id);
                        onClose();
                      }}
                      className={`block w-full rounded-lg border p-3 text-left transition ${
                        c.id === currentId
                          ? "border-sky-400/60 bg-sky-400/10"
                          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                            STATUS_STYLE[c.status] ?? "border-slate-500/30 text-slate-400"
                          }`}
                        >
                          {c.status}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(c.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="line-clamp-2 text-sm text-slate-200">{c.goal}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
