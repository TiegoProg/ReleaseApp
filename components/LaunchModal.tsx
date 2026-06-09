"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "./Icon";
import { ROOMS, AREA_ROOM_KEYS } from "@/lib/areaMeta";
import type { AreaKey } from "@/lib/types";

export interface LaunchIntake {
  product?: string;
  audience?: string;
  budget?: string;
  channels?: string;
  productImageUrl?: string;
  notes?: string;
}

export default function LaunchModal({
  open,
  goal,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  goal: string;
  onCancel: () => void;
  onConfirm: (opts: { areas: AreaKey[]; intake: LaunchIntake }) => Promise<void> | void;
}) {
  const [areas, setAreas] = useState<AreaKey[]>([...AREA_ROOM_KEYS]);
  const [intake, setIntake] = useState<LaunchIntake>({});
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reinicia al abrir.
  useEffect(() => {
    if (open) {
      setAreas([...AREA_ROOM_KEYS]);
      setIntake({});
      setError(null);
      setLaunching(false);
    }
  }, [open]);

  function toggle(k: AreaKey) {
    setAreas((prev) => (prev.includes(k) ? prev.filter((a) => a !== k) : [...prev, k]));
  }

  async function confirm() {
    if (areas.length === 0 || launching) return;
    setLaunching(true);
    setError(null);
    try {
      await onConfirm({ areas, intake });
    } catch (e: any) {
      setError(e?.message ?? "No se pudo lanzar.");
      setLaunching(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-ink/35 backdrop-blur-[3px]"
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="relative flex max-h-[88vh] w-full max-w-[620px] flex-col overflow-hidden rounded-3xl border border-line bg-canvas shadow-lift"
          >
            {/* header */}
            <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-4">
              <div>
                <div className="label-mono">Antes de montar la agencia</div>
                <h2 className="font-display text-[20px] font-bold tracking-tighter-2 text-ink">
                  ¿Qué quieres que trabaje?
                </h2>
              </div>
              <button
                onClick={onCancel}
                className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-white text-ink-soft shadow-soft transition hover:text-ink"
                aria-label="Cerrar"
              >
                <Icon name="close" size={17} />
              </button>
            </div>

            {/* cuerpo */}
            <div className="scroll-thin flex-1 overflow-y-auto px-6 py-5">
              {/* objetivo (preview) */}
              <div className="mb-5 rounded-2xl border border-line bg-white p-3.5 shadow-soft">
                <div className="label-mono mb-1">Objetivo</div>
                <p className="line-clamp-3 text-[13.5px] leading-snug text-ink-soft">{goal}</p>
              </div>

              {/* selección de áreas */}
              <div className="mb-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-ink">Áreas que quieres activar</span>
                  <span className="text-[11.5px] text-ink-mute">{areas.length} de 4</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {AREA_ROOM_KEYS.map((k) => {
                    const r = ROOMS[k];
                    const on = areas.includes(k);
                    return (
                      <button
                        key={k}
                        onClick={() => toggle(k)}
                        className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition ${
                          on ? "bg-white shadow-soft" : "border-line bg-white/60 opacity-70"
                        }`}
                        style={on ? { borderColor: r.color } : undefined}
                      >
                        <span
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white shadow-soft"
                          style={{ background: `linear-gradient(140deg, ${r.from}, ${r.to})` }}
                        >
                          <Icon name={r.icon} size={20} strokeWidth={1.8} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13.5px] font-semibold text-ink">{r.short}</div>
                          <div className="line-clamp-1 text-[11.5px] text-ink-mute">{r.tagline}</div>
                        </div>
                        <span
                          className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
                            on ? "border-transparent text-white" : "border-line text-transparent"
                          }`}
                          style={on ? { background: r.color } : undefined}
                        >
                          <Icon name="check" size={13} strokeWidth={2.6} />
                        </span>
                      </button>
                    );
                  })}
                </div>
                {areas.length === 0 && (
                  <p className="mt-2 text-[12px] font-medium text-status-error">Activa al menos un área.</p>
                )}
              </div>

              {/* intake */}
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-ink">Afinemos la campaña</span>
                  <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[10.5px] font-medium text-ink-mute">
                    opcional
                  </span>
                </div>
                <p className="mb-3 text-[12px] text-ink-mute">
                  Lo que completes evita que los agentes tengan que preguntártelo después.
                </p>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <Field label="Producto / marca" value={intake.product} onChange={(v) => setIntake((s) => ({ ...s, product: v }))} placeholder="Ej: Cholibrium, complejo de 10 hongos" />
                  <Field label="Presupuesto disponible" value={intake.budget} onChange={(v) => setIntake((s) => ({ ...s, budget: v }))} placeholder="Ej: $8.000/mes" />
                  <Field label="Audiencia" value={intake.audience} onChange={(v) => setIntake((s) => ({ ...s, audience: v }))} placeholder="Ej: adultos 40-65, salud preventiva" />
                  <Field label="Canales" value={intake.channels} onChange={(v) => setIntake((s) => ({ ...s, channels: v }))} placeholder="Ej: Meta + TikTok" />
                  <div className="sm:col-span-2">
                    <Field
                      label="Foto de referencia del producto (URL)"
                      value={intake.productImageUrl}
                      onChange={(v) => setIntake((s) => ({ ...s, productImageUrl: v }))}
                      placeholder="https://…  — mejora mucho los anuncios"
                      icon="image"
                    />
                  </div>
                </div>
              </div>

              {error && <p className="mt-4 text-[13px] font-medium text-status-error">{error}</p>}
            </div>

            {/* acciones */}
            <div className="flex items-center justify-between gap-2 border-t border-line bg-white/60 px-6 py-3.5 backdrop-blur">
              <button
                onClick={onCancel}
                className="rounded-xl border border-line bg-white px-4 py-2.5 text-[13.5px] font-semibold text-ink-soft shadow-soft transition hover:text-ink"
              >
                Cancelar
              </button>
              <button
                onClick={confirm}
                disabled={areas.length === 0 || launching}
                className="group flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-semibold text-white shadow-soft transition disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#0ea5e9,#7c3aed)" }}
              >
                {launching ? "Montando agencia…" : "Lanzar campaña"}
                <Icon
                  name={launching ? "sparkle" : "rocket"}
                  size={16}
                  className={launching ? "animate-spin-slow" : "transition group-hover:translate-x-0.5"}
                />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  icon,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: "image";
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-medium text-ink-soft">{label}</span>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 shadow-soft transition focus-within:ring-2 focus-within:ring-area-research/20">
        {icon && <Icon name={icon} size={15} className="shrink-0 text-ink-mute" />}
        <input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-mute"
        />
      </div>
    </label>
  );
}
