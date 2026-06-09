"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import SideNav, { type NavView } from "@/components/SideNav";
import TopBar from "@/components/TopBar";
import AgencyFloor from "@/components/AgencyFloor";
import DeliverablesBoard from "@/components/DeliverablesBoard";
import RoomPanel from "@/components/RoomPanel";
import ProjectsDrawer from "@/components/ProjectsDrawer";
import MobileNav from "@/components/MobileNav";
import LaunchModal, { type LaunchIntake } from "@/components/LaunchModal";
import DeliverableModal from "@/components/DeliverableModal";
import { Icon } from "@/components/Icon";
import { useUiStore } from "@/lib/uiStore";
import type { AreaKey, ConfigStatus } from "@/lib/types";

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

  const campaignId = useUiStore((s) => s.campaignId);
  const nodeCount = useUiStore((s) => s.nodeOrder.length);

  const [view, setView] = useState<NavView>("floor");
  const [showProjects, setShowProjects] = useState(false);
  const [query, setQuery] = useState("");
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [launchGoal, setLaunchGoal] = useState<string | null>(null);

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
    async (goal: string, opts?: { areas: AreaKey[]; intake: LaunchIntake }) => {
      const res = await fetch("/api/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, areas: opts?.areas, intake: opts?.intake }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Error al lanzar.");
      reset();
      setCampaign(data.campaignId, goal);
      localStorage.setItem(LS_KEY, data.campaignId);
      connectSSE(data.campaignId, null);
      setView("floor");
    },
    [reset, setCampaign, connectSSE]
  );

  const onReset = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    localStorage.removeItem(LS_KEY);
    reset();
    setView("floor");
  }, [reset]);

  return (
    <div className="flex h-screen overflow-hidden">
      <SideNav
        view={view}
        onView={setView}
        onOpenProjects={() => setShowProjects(true)}
        collapsed={navCollapsed}
        onToggle={() => setNavCollapsed((v) => !v)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar view={view} query={query} onQuery={setQuery} onNewCampaign={onReset} />

        <main className="relative min-h-0 flex-1">
          {view === "floor" && (
            <div className="scroll-thin h-full overflow-y-auto p-3 pb-24 md:p-4 lg:pb-4">
              <AgencyFloor query={query} onRequestLaunch={setLaunchGoal} onReset={onReset} />
            </div>
          )}

          {view === "board" && (
            <div className="scroll-thin h-full overflow-y-auto p-4 pb-24 md:p-6 lg:pb-6">
              <DeliverablesBoard query={query} />
            </div>
          )}

          {view === "network" && (
            <div className="h-full p-3 pb-24 md:p-4 lg:pb-4">
              <div className="floor-plate relative h-full overflow-hidden">
                <div className="absolute left-5 top-4 z-10 flex items-center gap-2.5">
                  <span className="label-mono">Red de agentes</span>
                  <span className="hidden text-[12px] text-ink-mute sm:block">
                    haz click en un nodo para entrar a su sala
                  </span>
                </div>
                <OrbitGraph />
                {nodeCount === 0 && (
                  <div className="pointer-events-none absolute inset-0 grid place-items-center">
                    <div className="max-w-sm text-center">
                      <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-white text-ink-mute shadow-soft">
                        <Icon name="network" size={26} />
                      </span>
                      <div className="font-display text-[18px] font-bold text-ink">Topología vacía</div>
                      <p className="mt-1 text-[13px] text-ink-soft">
                        Lanza un briefing desde la planta y los agentes aparecerán aquí,
                        orquestados por el Director.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* navegación móvil */}
      <MobileNav view={view} onView={setView} onOpenProjects={() => setShowProjects(true)} />

      {/* drill-in de sala */}
      <RoomPanel />

      {/* lector de entregables (informe .md) */}
      <DeliverableModal />

      {/* pop-up de lanzamiento: áreas + intake */}
      <LaunchModal
        open={launchGoal !== null}
        goal={launchGoal ?? ""}
        onCancel={() => setLaunchGoal(null)}
        onConfirm={async (opts) => {
          if (launchGoal === null) return;
          await onLaunch(launchGoal, opts);
          setLaunchGoal(null);
        }}
      />

      {/* historial de proyectos */}
      <ProjectsDrawer
        open={showProjects}
        onClose={() => setShowProjects(false)}
        onOpen={openCampaign}
        currentId={campaignId}
      />
    </div>
  );
}
