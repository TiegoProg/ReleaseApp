"use client";

import { Icon, type GlyphName } from "./Icon";
import type { NavView } from "./SideNav";

const ITEMS: { key: NavView | "projects"; label: string; icon: GlyphName }[] = [
  { key: "floor", label: "Planta", icon: "home" },
  { key: "board", label: "Entregables", icon: "board" },
  { key: "network", label: "Red", icon: "network" },
  { key: "projects", label: "Proyectos", icon: "projects" },
];

export default function MobileNav({
  view,
  onView,
  onOpenProjects,
}: {
  view: NavView;
  onView: (v: NavView) => void;
  onOpenProjects: () => void;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/85 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
        {ITEMS.map((it) => {
          const active = it.key === view;
          return (
            <button
              key={it.key}
              onClick={() => (it.key === "projects" ? onOpenProjects() : onView(it.key as NavView))}
              className={`flex flex-col items-center gap-1 rounded-xl py-1.5 text-[10.5px] font-medium transition ${
                active ? "text-ink" : "text-ink-mute"
              }`}
            >
              <span
                className={`grid h-8 w-12 place-items-center rounded-xl transition ${
                  active ? "bg-ink text-white shadow-soft" : ""
                }`}
              >
                <Icon name={it.icon} size={18} strokeWidth={active ? 1.95 : 1.7} />
              </span>
              {it.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
