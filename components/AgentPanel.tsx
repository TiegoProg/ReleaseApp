"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useUiStore } from "@/lib/uiStore";
import ActivityStream from "./ActivityStream";
import { STATUS_COLOR, STATUS_LABEL, nodeColor } from "./OrbitNode";

export default function AgentPanel() {
  const selectedId = useUiStore((s) => s.selectedNodeId);
  const node = useUiStore((s) => (selectedId ? s.nodes[selectedId] : null));
  const campaignId = useUiStore((s) => s.campaignId);
  const deliverables = useUiStore((s) => s.deliverables);
  const selectNode = useUiStore((s) => s.selectNode);

  const [text, setText] = useState("");
  const [resourceMode, setResourceMode] = useState(false);
  const [sending, setSending] = useState(false);

  const open = !!(selectedId && node);

  const areaFilter = node?.kind === "director" ? null : node?.area;
  const panelDeliverables = deliverables.filter((d) =>
    areaFilter ? d.area === areaFilter : true
  );

  async function send() {
    if (!text.trim() || !campaignId || !selectedId) return;
    setSending(true);
    const payload = resourceMode ? `[RECURSO] ${text.trim()}` : text.trim();
    try {
      await fetch("/api/agent/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, agentId: selectedId, text: payload }),
      });
      setText("");
      setResourceMode(false);
    } finally {
      setSending(false);
    }
  }

  return (
    <AnimatePresence>
      {open && node && (
        <motion.aside
          initial={{ x: 460, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 460, opacity: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 32 }}
          className="absolute right-0 top-0 z-20 flex h-full w-full max-w-[460px] flex-col border-l border-white/10 bg-[#0a0f1c]/95 backdrop-blur"
        >
          {/* header */}
          <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">
                {node.kind === "director" ? "Núcleo" : node.kind === "area" ? "Área" : "Subagente"}
              </div>
              <div className="truncate text-lg font-semibold" style={{ color: nodeColor(node) }}>
                {node.role}
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: STATUS_COLOR[node.status],
                    boxShadow: `0 0 8px ${STATUS_COLOR[node.status]}`,
                  }}
                />
                <span className="text-slate-300">{STATUS_LABEL[node.status]}</span>
              </div>
            </div>
            <button
              onClick={() => selectNode(null)}
              className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-400 hover:bg-white/5"
            >
              cerrar ✕
            </button>
          </div>

          {/* actividad */}
          <div className="scroll-thin flex-1 overflow-y-auto px-4 py-3">
            <ActivityStream agentId={node.id} />

            {panelDeliverables.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-400">
                  Entregables en el board
                </div>
                <div className="space-y-2">
                  {panelDeliverables.map((d) => (
                    <div
                      key={d.id}
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs"
                    >
                      <div className="font-medium text-slate-200">
                        {d.type} · {d.title}
                      </div>
                      {d.payload?.url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={d.payload.url}
                          alt={d.title}
                          className="mt-2 max-h-40 rounded-md border border-white/10"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* chat / instrucciones */}
          <div className="border-t border-white/10 p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <button
                onClick={() => setResourceMode((v) => !v)}
                className={`rounded-md border px-2 py-0.5 text-[11px] ${
                  resourceMode
                    ? "border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-200"
                    : "border-white/10 text-slate-400 hover:bg-white/5"
                }`}
              >
                {resourceMode ? "📎 recurso" : "📎 adjuntar recurso"}
              </button>
              <span className="text-[11px] text-slate-500">
                {resourceMode
                  ? "Se enviará como recurso para el agente."
                  : "Dale una instrucción para iterar su trabajo."}
              </span>
            </div>
            <div className="flex items-end gap-2">
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
                className="scroll-thin flex-1 resize-none rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-400/50"
              />
              <button
                onClick={send}
                disabled={sending || !text.trim()}
                className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending ? "…" : "Enviar"}
              </button>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
