"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import GoalBar from "@/components/GoalBar";
import AgentPanel from "@/components/AgentPanel";
import ProjectsDrawer from "@/components/ProjectsDrawer";
import { NodeChip, STATUS_COLOR, STATUS_LABEL } from "@/components/OrbitNode";
import { useUiStore } from "@/lib/uiStore";
import type { AgentStatus, ConfigStatus } from "@/lib/types";

// El grafo usa canvas + window; cárgalo solo en cliente.
const OrbitGraph = dynamic(() => import("@/components/OrbitGraph"), { ssr: false });

const LS_KEY = "orbita_campaign";

export default function Home() {
  const esRef = useRef<EventSource | null>(null);

  const setConfig = useUiStore((s) => s.setConfig);
  const reset = useUiStore((s) => s.reset);
  const setCampaign = useUiStore((s) => s.setCampaign);
  const applyEvent = useUiStore((s) => s.applyEvent);
  const buildFromSnapshot = useUiStore((s) => s.buildFromSnapshot);
  const selectNode = useUiStore((s) => s.selectNode);

  const nodeOrder = useUiStore((s) => s.nodeOrder);
  const nodes = useUiStore((s) => s.nodes);
  const selectedNodeId = useUiStore((s) => s.selectedNodeId);
  const campaignId = useUiStore((s) => s.campaignId);

  const [showProjects, setShowProjects] = useState(false);

  const connectSSE = useCallback(
    (campaignId: string, since: string | null) => {
      esRef.current?.close();
      const url = `/api/agent/run?campaignId=${encodeURIComponent(campaignId)}${
        since ? `&since=${encodeURIComponent(since)}` : ""
      }`;
      const es = new EventSource(url);
      es.onmessage = (e) => {
        try {
          applyEvent(JSON.parse(e.data));
        } catch {
          /* ignore */
        }
      };
      esRef.current = es;
    },
    [applyEvent]
  );

  // Abre (rehidrata) una campaña guardada y se suscribe a su feed en vivo.
  const openCampaign = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/campaign?id=${encodeURIComponent(id)}`);
        if (!res.ok) return false;
        const { snapshot, maxTs } = await res.json();
        buildFromSnapshot(snapshot);
        localStorage.setItem(LS_KEY, id);
        connectSSE(id, maxTs);
        return true;
      } catch {
        return false;
      }
    },
    [buildFromSnapshot, connectSSE]
  );

  // carga config + rehidratación del último proyecto abierto
  useEffect(() => {
    (async () => {
      try {
        const cfg: ConfigStatus = await (await fetch("/api/health")).json();
        setConfig(cfg);
      } catch {
        /* noop */
      }
      const saved = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
      if (saved) {
        const ok = await openCampaign(saved);
        if (!ok) localStorage.removeItem(LS_KEY);
      }
    })();

    return () => esRef.current?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLaunch = useCallback(
    async (goal: string) => {
      const res = await fetch("/api/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Error al lanzar.");
      reset();
      setCampaign(data.campaignId, goal);
      localStorage.setItem(LS_KEY, data.campaignId);
      connectSSE(data.campaignId, null);
    },
    [reset, setCampaign, connectSSE]
  );

  const onReset = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    localStorage.removeItem(LS_KEY);
    reset();
  }, [reset]);

  const orderedNodes = nodeOrder.map((id) => nodes[id]).filter(Boolean);

  return (
    <main className="flex h-screen flex-col overflow-hidden">
      <GoalBar onLaunch={onLaunch} onReset={onReset} />

      <div className="relative flex flex-1 overflow-hidden">
        {/* lista lateral de nodos */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-white/10 bg-black/20 p-3 md:flex">
          <button
            onClick={() => setShowProjects(true)}
            className="mb-3 flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 transition hover:bg-white/[0.08]"
          >
            📁 Proyectos guardados
          </button>
          <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-400">
            Agentes ({orderedNodes.length})
          </div>
          <div className="scroll-thin flex-1 space-y-1.5 overflow-y-auto">
            {orderedNodes.length === 0 ? (
              <div className="text-xs text-slate-500">
                Aún no hay agentes. Lanza un Goal para instanciar la agencia.
              </div>
            ) : (
              orderedNodes.map((n) => (
                <NodeChip
                  key={n.id}
                  node={n}
                  selected={n.id === selectedNodeId}
                  onClick={() => selectNode(n.id)}
                />
              ))
            )}
          </div>
          <StatusLegend />
        </aside>

        {/* grafo orbital */}
        <div className="starfield relative flex-1 overflow-hidden">
          <OrbitGraph />

          {orderedNodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="max-w-md text-center">
                <div className="text-2xl font-semibold text-slate-200">
                  Red orbital de agentes
                </div>
                <p className="mt-2 text-sm text-slate-400">
                  Escribe el <span className="text-sky-300">objetivo global</span> en la barra de
                  arriba y lanza la agencia. El Director descompondrá el goal y delegará a cada área;
                  haz click en un nodo para entrar y ver/iterar a su agente.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* panel de drill-in */}
        <AgentPanel />

        {/* historial de proyectos */}
        <ProjectsDrawer
          open={showProjects}
          onClose={() => setShowProjects(false)}
          onOpen={openCampaign}
          currentId={campaignId}
        />
      </div>
    </main>
  );
}

function StatusLegend() {
  const items: AgentStatus[] = ["thinking", "tool", "waiting", "done", "idle", "error"];
  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <div className="mb-1.5 text-[10px] uppercase tracking-wide text-slate-500">Estados</div>
      <div className="grid grid-cols-2 gap-1">
        {items.map((s) => (
          <div key={s} className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: STATUS_COLOR[s], boxShadow: `0 0 6px ${STATUS_COLOR[s]}` }}
            />
            {STATUS_LABEL[s]}
          </div>
        ))}
      </div>
    </div>
  );
}
