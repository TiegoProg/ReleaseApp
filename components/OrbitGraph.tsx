"use client";

import { useEffect, useRef } from "react";
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceRadial,
  forceSimulation,
  type Simulation,
} from "d3-force";
import { AREAS } from "@/lib/types";
import { useUiStore, type NodeData } from "@/lib/uiStore";
import { STATUS_COLOR, nodeColor } from "./OrbitNode";

interface SimNode {
  id: string;
  depth: number;
  r: number;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}
interface SimLink {
  source: any;
  target: any;
  fromId: string;
  toId: string;
}

const PULSE_MS = 1500;

function depthOf(n: NodeData): number {
  return n.kind === "director" ? 0 : n.kind === "area" ? 1 : 2;
}
function radiusVisual(depth: number): number {
  return depth === 0 ? 26 : depth === 1 ? 16 : 10;
}

export default function OrbitGraph() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const simNodes = useRef<Map<string, SimNode>>(new Map());
  const sizeRef = useRef({ w: 800, h: 600 });

  // Reconstruye nodos/links cuando cambia el conjunto de nodos.
  const nodeOrder = useUiStore((s) => s.nodeOrder);

  // ---- setup canvas + simulation (una vez) ----
  useEffect(() => {
    const container = containerRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      sizeRef.current = { w, h };
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      applyForces();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const sim = forceSimulation<SimNode, SimLink>([])
      .force("charge", forceManyBody().strength(-240))
      .force("collide", forceCollide<SimNode>().radius((d) => d.r + 16))
      .alphaDecay(0.02);
    simRef.current = sim;
    sim.stop();

    function applyForces() {
      const { w, h } = sizeRef.current;
      const cx = w / 2;
      const cy = h / 2;
      const base = Math.min(w, h);
      const radial = forceRadial<SimNode>(
        (d) => (d.depth === 0 ? 0 : d.depth === 1 ? base * 0.28 : base * 0.42),
        cx,
        cy
      ).strength((d) => (d.depth === 0 ? 0 : d.depth === 1 ? 0.9 : 0.55));
      sim.force("radial", radial);
      // fija al director en el centro
      simNodes.current.forEach((n) => {
        if (n.depth === 0) {
          n.fx = cx;
          n.fy = cy;
        }
      });
      sim.alpha(0.6).restart();
    }

    // RAF: tick + draw
    let raf = 0;
    const loop = () => {
      sim.tick();
      draw(ctx);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // click -> seleccionar nodo
    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let hit: string | null = null;
      let best = Infinity;
      simNodes.current.forEach((n) => {
        const dx = n.x - mx;
        const dy = n.y - my;
        const d = Math.hypot(dx, dy);
        if (d < n.r + 8 && d < best) {
          best = d;
          hit = n.id;
        }
      });
      if (hit) {
        const st = useUiStore.getState();
        const nd = st.nodes[hit];
        if (nd) {
          st.selectNode(hit);
          st.selectRoom(nd.kind === "director" ? "director" : nd.area ?? "research");
        }
      }
    };
    canvas.addEventListener("click", onClick);

    resize();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("click", onClick);
      sim.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- rebuild nodes/links on nodeOrder change ----
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    const { nodes } = useUiStore.getState();
    const { w, h } = sizeRef.current;
    const cx = w / 2;
    const cy = h / 2;

    for (const id of nodeOrder) {
      const nd = nodes[id];
      if (!nd) continue;
      const depth = depthOf(nd);
      if (!simNodes.current.has(id)) {
        // posición inicial: cerca del padre o alrededor del centro
        const parent = nd.parentId ? simNodes.current.get(nd.parentId) : null;
        const angle = Math.random() * Math.PI * 2;
        const rad = depth === 0 ? 0 : 60 + depth * 40;
        simNodes.current.set(id, {
          id,
          depth,
          r: radiusVisual(depth),
          x: (parent?.x ?? cx) + Math.cos(angle) * rad,
          y: (parent?.y ?? cy) + Math.sin(angle) * rad,
        });
      }
    }

    const nodeArr = Array.from(simNodes.current.values());
    const links: SimLink[] = [];
    for (const id of nodeOrder) {
      const nd = nodes[id];
      if (nd?.parentId && simNodes.current.has(nd.parentId)) {
        links.push({ source: nd.parentId, target: id, fromId: nd.parentId, toId: id });
      }
    }

    sim.nodes(nodeArr);
    sim.force(
      "link",
      forceLink<SimNode, SimLink>(links)
        .id((d: any) => d.id)
        .distance((l: any) => (simNodes.current.get(l.toId)?.depth === 1 ? 170 : 95))
        .strength(0.12)
    );
    // re-fija director
    nodeArr.forEach((n) => {
      if (n.depth === 0) {
        n.fx = cx;
        n.fy = cy;
      }
    });
    sim.alpha(0.8).restart();
  }, [nodeOrder]);

  // ---- draw ----
  function draw(ctx: CanvasRenderingContext2D) {
    const { w, h } = sizeRef.current;
    const cx = w / 2;
    const cy = h / 2;
    const base = Math.min(w, h);
    const now = Date.now();
    const { nodes, linkPulses, selectedNodeId } = useUiStore.getState();

    ctx.clearRect(0, 0, w, h);

    // anillos de órbita
    ctx.save();
    ctx.strokeStyle = "rgba(11,16,32,0.08)";
    ctx.lineWidth = 1;
    for (const rr of [base * 0.28, base * 0.42]) {
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // links
    const linkForce = simRef.current?.force("link") as any;
    const links: SimLink[] = linkForce ? linkForce.links() : [];
    for (const l of links) {
      const s = l.source as SimNode;
      const t = l.target as SimNode;
      if (!s || !t) continue;
      const pulseExp = linkPulses[`${l.fromId}->${l.toId}`] || linkPulses[`${l.toId}->${l.fromId}`];
      const active = pulseExp && now < pulseExp;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      if (active) {
        const tt = (pulseExp - now) / PULSE_MS; // 1 -> 0
        ctx.strokeStyle = `rgba(56,189,248,${0.25 + 0.6 * tt})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        // punto de "flujo de datos"
        const frac = (now % 900) / 900;
        const px = s.x + (t.x - s.x) * frac;
        const py = s.y + (t.y - s.y) * frac;
        ctx.beginPath();
        ctx.arc(px, py, 2.4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(125,211,252,0.95)";
        ctx.fill();
      } else {
        ctx.strokeStyle = "rgba(11,16,32,0.10)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // nodos
    simNodes.current.forEach((n) => {
      const nd = nodes[n.id];
      if (!nd) return;
      const ring = nodeColor(nd);
      const fill = STATUS_COLOR[nd.status];
      const pulsing = nd.status === "thinking" || nd.status === "tool";
      const glow = pulsing ? 0.55 + 0.25 * Math.sin(now / 220) : 0.3;

      // glow
      const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 3);
      grad.addColorStop(0, hexA(fill, glow));
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * 3, 0, Math.PI * 2);
      ctx.fill();

      // cuerpo
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = hexA(fill, 0.9);
      ctx.fill();

      // anillo por área/tipo
      ctx.lineWidth = n.id === selectedNodeId ? 3.5 : 2;
      ctx.strokeStyle = n.id === selectedNodeId ? "#0b1020" : ring;
      ctx.stroke();

      // label
      const label =
        nd.kind === "director" ? "Director" : nd.area ? AREAS[nd.area].short : nd.role;
      const text = nd.kind === "subagent" ? truncate(nd.role, 14) : label;
      ctx.font = `${nd.kind === "director" ? 600 : 500} ${nd.kind === "director" ? 13 : 11}px ui-sans-serif, system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "rgba(11,16,32,0.72)";
      ctx.fillText(text, n.x, n.y + n.r + 5);
    });
  }

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas ref={canvasRef} className="block h-full w-full cursor-pointer" />
    </div>
  );
}

function hexA(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
