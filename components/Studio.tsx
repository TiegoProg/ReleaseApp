"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "./Icon";
import { useUiStore } from "@/lib/uiStore";

// ============================================================================
// UGC Studio — creación tipo Higgsfield: avatar (identity-lock) → character
// sheet → animación a video (Seedance). Adaptado al stack actual de Orbita.
// ============================================================================

interface PersonaVideo {
  url: string;
  script: string;
  preset?: string;
  createdAt: string;
}

interface Persona {
  id: string;
  name: string;
  avatarUrl: string;
  sheetUrl: string;
  sourceUrl?: string;
  identity: string;
  voiceName: string;
  language: string;
  seed: number;
  product?: string;
  mode: string;
  videos: PersonaVideo[];
  createdAt: string;
}

type VideoStatus = "idle" | "rendering" | "ready" | "failed" | "stub";

const PRESETS: { key: string; label: string }[] = [
  { key: "talking-head", label: "Talking head" },
  { key: "unboxing", label: "Unboxing" },
  { key: "review", label: "Review" },
  { key: "try-on", label: "Try-on" },
];

const DEFAULT_SCRIPT_HINT =
  "Shot on iPhone front camera, vertical 9:16, natural HDR, real skin tones, authentic UGC creator energy…";

export default function Studio() {
  const config = useUiStore((s) => s.config);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [loadingRoster, setLoadingRoster] = useState(true);

  // Generación de video
  const [script, setScript] = useState("");
  const [preset, setPreset] = useState("talking-head");
  const [videoStatus, setVideoStatus] = useState<VideoStatus>("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoMeta, setVideoMeta] = useState<string>("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selected = personas.find((p) => p.id === selectedId) ?? null;

  const loadRoster = useCallback(async () => {
    try {
      const res = await fetch("/api/avatar");
      const data = await res.json();
      const list: Persona[] = data?.personas ?? [];
      setPersonas(list);
      if (list.length && !selectedId) setSelectedId(list[0].id);
    } catch {
      /* noop */
    } finally {
      setLoadingRoster(false);
    }
  }, [selectedId]);

  useEffect(() => {
    loadRoster();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCreated = useCallback((p: Persona) => {
    setPersonas((prev) => [p, ...prev]);
    setSelectedId(p.id);
    setCreating(false);
  }, []);

  const generate = useCallback(async () => {
    if (!selected || !script.trim() || videoStatus === "rendering") return;
    setVideoStatus("rendering");
    setVideoUrl(null);
    setVideoError(null);
    setVideoMeta("");
    if (pollRef.current) clearInterval(pollRef.current);

    try {
      const res = await fetch("/api/ugc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId: selected.id, script, motionPreset: preset }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "No se pudo generar.");
      const job = data.job;
      setVideoMeta(`voz: ${data.voiceMode} · video: ${job.mode}`);

      const personaId = selected.id;
      let saved = false; // evita doble-guardado por carrera de polls
      // Persiste el clip en la persona (galería) y refresca el roster en memoria.
      const doSave = async (url: string) => {
        if (saved) return;
        saved = true;
        try {
          const r = await fetch("/api/ugc/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ personaId, videoUrl: url, script, preset }),
          });
          const d = await r.json();
          if (r.ok && d.persona)
            setPersonas((prev) => prev.map((p) => (p.id === d.persona.id ? d.persona : p)));
        } catch {
          /* el video igual se muestra; solo no se persistió */
        }
      };

      if (job.status === "ready") {
        setVideoUrl(job.videoUrl);
        setVideoStatus("ready");
        doSave(job.videoUrl);
      } else if (job.status === "stub") {
        setVideoUrl(job.videoUrl);
        setVideoStatus("stub");
      } else if (job.status === "failed") {
        setVideoError(job.error ?? "Falló el render.");
        setVideoStatus("failed");
      } else if (job.status === "rendering" && job.requestId) {
        // poll
        pollRef.current = setInterval(async () => {
          try {
            const r = await fetch(`/api/ugc/status?requestId=${encodeURIComponent(job.requestId)}`);
            const d = await r.json();
            const j = d.job;
            if (j.status === "ready") {
              setVideoUrl(j.videoUrl);
              setVideoStatus("ready");
              if (pollRef.current) clearInterval(pollRef.current);
              doSave(j.videoUrl);
            } else if (j.status === "failed") {
              setVideoError(j.error ?? "Falló el render.");
              setVideoStatus("failed");
              if (pollRef.current) clearInterval(pollRef.current);
            }
          } catch {
            /* sigue intentando */
          }
        }, 5000);
      }
    } catch (e: any) {
      setVideoError(e?.message ?? "Error al generar.");
      setVideoStatus("failed");
    }
  }, [selected, script, preset, videoStatus]);

  return (
    <div className="mx-auto flex h-full max-w-[1200px] flex-col gap-4">
      {/* header */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="label-mono">Creación de creatividades</div>
          <h1 className="font-display text-[24px] font-bold tracking-tighter-2 text-ink">UGC Studio</h1>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            Crea avatares consistentes (GPT Image 2) y anímalos a video hablado (Seedance 2.0).
          </p>
        </div>
        {!config?.hasOpenAI && (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11.5px] font-medium text-amber-700">
            Sin OPENAI_API_KEY → avatares en modo stub
          </span>
        )}
      </div>

      {/* roster de avatares */}
      <AvatarRoster
        personas={personas}
        selectedId={selectedId}
        loading={loadingRoster}
        onSelect={setSelectedId}
        onCreate={() => setCreating(true)}
      />

      {/* lienzo: character sheet del avatar seleccionado */}
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {selected ? (
          <PersonaCanvas
            persona={selected}
            videoStatus={videoStatus}
            videoUrl={videoUrl}
            videoError={videoError}
            videoMeta={videoMeta}
          />
        ) : (
          <EmptyState onCreate={() => setCreating(true)} />
        )}
      </div>

      {/* barra de creación (estilo Higgsfield) */}
      {selected && (
        <CreationBar
          persona={selected}
          script={script}
          onScript={setScript}
          preset={preset}
          onPreset={setPreset}
          status={videoStatus}
          onGenerate={generate}
        />
      )}

      {/* modal crear avatar */}
      <AnimatePresence>
        {creating && <CreateAvatarModal onClose={() => setCreating(false)} onCreated={onCreated} />}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------
function AvatarRoster({
  personas,
  selectedId,
  loading,
  onSelect,
  onCreate,
}: {
  personas: Persona[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="floor-plate p-3">
      <div className="mb-2.5 flex items-center justify-between px-1">
        <span className="label-mono">Roster de avatares</span>
        <span className="text-[11.5px] text-ink-mute">{personas.length} guardados</span>
      </div>
      <div className="scroll-thin flex gap-3 overflow-x-auto pb-1">
        <button
          onClick={onCreate}
          className="group flex h-[112px] w-[92px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-white/60 text-ink-mute transition hover:border-area-creative hover:text-area-creative"
        >
          <Icon name="plus" size={22} />
          <span className="text-[11px] font-semibold">Crear avatar</span>
        </button>

        {loading && personas.length === 0 && (
          <div className="grid h-[112px] place-items-center px-4 text-[12px] text-ink-mute">
            cargando…
          </div>
        )}

        {personas.map((p) => {
          const on = p.id === selectedId;
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              title={p.name}
              className={`relative h-[112px] w-[92px] shrink-0 overflow-hidden rounded-2xl border-2 bg-surface-sunken transition ${
                on ? "border-area-creative shadow-soft" : "border-line opacity-90 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.avatarUrl} alt={p.name} className="h-full w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 py-1 text-left text-[10.5px] font-medium text-white">
                {p.name}
              </span>
              {on && (
                <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-area-creative text-white">
                  <Icon name="check" size={12} strokeWidth={2.6} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Canvas: character sheet + meta + resultado de video
// ---------------------------------------------------------------------------
function PersonaCanvas({
  persona,
  videoStatus,
  videoUrl,
  videoError,
  videoMeta,
}: {
  persona: Persona;
  videoStatus: VideoStatus;
  videoUrl: string | null;
  videoError: string | null;
  videoMeta: string;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr,300px]">
      {/* sheet */}
      <div className="floor-plate p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="label-mono">Character sheet · {persona.name}</span>
          {persona.mode.startsWith("stub") && (
            <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[10.5px] text-ink-mute">
              stub
            </span>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-[150px,1fr]">
          <div>
            <div className="label-mono mb-1.5 text-center">Source</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={persona.sourceUrl || persona.avatarUrl}
              alt="source"
              className="w-full rounded-xl border border-line object-cover"
            />
          </div>
          <div>
            <div className="label-mono mb-1.5 text-center">Sheet</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={persona.sheetUrl}
              alt="character sheet"
              className="w-full rounded-xl border border-line object-cover"
            />
          </div>
        </div>
      </div>

      {/* lateral: anclas de identidad + resultado */}
      <div className="flex flex-col gap-4">
        <div className="floor-plate p-4">
          <div className="label-mono mb-2">Anclas de coherencia</div>
          <Anchor icon="user" label="Identidad" value={persona.identity} />
          <Anchor icon="mic" label="Voz" value={`${persona.voiceName} · ${persona.language}`} />
          <Anchor icon="refresh" label="Seed movimiento" value={String(persona.seed)} />
          {persona.product && <Anchor icon="image" label="Producto" value={persona.product} />}
        </div>

        <div className="floor-plate p-4">
          <div className="label-mono mb-2">Resultado</div>
          {videoStatus === "idle" && (
            <p className="text-[12.5px] text-ink-mute">
              Escribe el guion abajo y dale <b>Generar</b> para animar a {persona.name}.
            </p>
          )}
          {videoStatus === "rendering" && (
            <div className="flex items-center gap-2 text-[13px] text-ink-soft">
              <Icon name="sparkle" size={16} className="animate-spin-slow text-area-creative" />
              Renderizando con Seedance…
            </div>
          )}
          {(videoStatus === "ready" || videoStatus === "stub") && videoUrl && (
            <div className="space-y-2">
              {videoUrl.endsWith(".png") ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={videoUrl} alt="render" className="w-full rounded-xl border border-line" />
              ) : (
                <video
                  src={videoUrl}
                  poster={persona.avatarUrl}
                  controls
                  playsInline
                  className="w-full rounded-xl border border-line"
                />
              )}
              {videoStatus === "ready" && (
                <p className="flex items-center gap-1 text-[11.5px] font-medium text-status-done">
                  <Icon name="check" size={13} /> Guardado en {persona.name} ↓
                </p>
              )}
              {videoStatus === "stub" && (
                <p className="text-[11.5px] text-ink-mute">
                  Stub — configura <code>FAL_KEY</code> para render real.
                </p>
              )}
            </div>
          )}
          {videoStatus === "failed" && (
            <p className="text-[12.5px] font-medium text-status-error">{videoError}</p>
          )}
          {videoMeta && <p className="mt-2 text-[11px] text-ink-mute">{videoMeta}</p>}
        </div>
      </div>
      </div>

      {/* galería de clips generados (persistidos en la persona) */}
      {persona.videos && persona.videos.length > 0 && (
        <div className="floor-plate p-4">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="label-mono">Videos de {persona.name}</span>
            <span className="text-[11.5px] text-ink-mute">{persona.videos.length} guardados</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {persona.videos.map((v, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-line bg-black/90">
                <video
                  src={v.url}
                  poster={persona.avatarUrl}
                  controls
                  playsInline
                  className="aspect-[9/16] w-full object-cover"
                />
                <p className="line-clamp-2 px-2 py-1.5 text-[11px] text-ink-mute">{v.script}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Anchor({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 py-1">
      <Icon name={icon} size={15} className="mt-0.5 shrink-0 text-ink-mute" />
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-ink-soft">{label}</div>
        <div className="line-clamp-2 text-[12px] text-ink-mute">{value}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barra de creación
// ---------------------------------------------------------------------------
function CreationBar({
  persona,
  script,
  onScript,
  preset,
  onPreset,
  status,
  onGenerate,
}: {
  persona: Persona;
  script: string;
  onScript: (v: string) => void;
  preset: string;
  onPreset: (v: string) => void;
  status: VideoStatus;
  onGenerate: () => void;
}) {
  return (
    <div className="rounded-3xl border border-line bg-ink/[0.97] p-3 shadow-lift">
      <textarea
        value={script}
        onChange={(e) => onScript(e.target.value)}
        rows={2}
        placeholder={`Guion que dirá ${persona.name}… (${DEFAULT_SCRIPT_HINT})`}
        className="w-full resize-none bg-transparent px-2 py-1.5 text-[13.5px] text-white outline-none placeholder:text-white/35"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {/* presets */}
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => onPreset(p.key)}
              className={`rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition ${
                preset === p.key ? "bg-white text-ink" : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          {/* avatar slot */}
          <span className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 text-[11.5px] font-medium text-white/80">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={persona.avatarUrl} alt="" className="h-5 w-5 rounded object-cover" />
            {persona.name}
          </span>

          <span className="text-[11px] text-white/40">Est. ~$0.75 · 8s · 9:16</span>

          <button
            onClick={onGenerate}
            disabled={!script.trim() || status === "rendering"}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13.5px] font-semibold text-white shadow-soft transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#ec4899,#8b5cf6)" }}
          >
            {status === "rendering" ? "Generando…" : "Generar"}
            <Icon name={status === "rendering" ? "sparkle" : "video"} size={15} className={status === "rendering" ? "animate-spin-slow" : ""} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="floor-plate grid h-full min-h-[320px] place-items-center">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-white text-area-creative shadow-soft">
          <Icon name="user" size={26} />
        </span>
        <div className="font-display text-[18px] font-bold text-ink">Aún no tienes avatares</div>
        <p className="mt-1 text-[13px] text-ink-soft">
          Crea tu primer avatar UGC. Generaremos su retrato héroe y una character sheet con vistas y
          detalles para mantener la identidad consistente.
        </p>
        <button
          onClick={onCreate}
          className="mx-auto mt-4 flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-semibold text-white shadow-soft"
          style={{ background: "linear-gradient(135deg,#ec4899,#8b5cf6)" }}
        >
          Crear avatar <Icon name="sparkle" size={16} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal: crear avatar
// ---------------------------------------------------------------------------
function CreateAvatarModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (p: Persona) => void;
}) {
  const [brief, setBrief] = useState("");
  const [name, setName] = useState("");
  const [sourceImageUrl, setSourceImageUrl] = useState("");
  const [product, setProduct] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!brief.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief,
          name: name || undefined,
          sourceImageUrl: sourceImageUrl || undefined,
          product: product || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "No se pudo crear.");
      onCreated(data.persona);
    } catch (e: any) {
      setError(e?.message ?? "Error al crear el avatar.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-ink/35 backdrop-blur-[3px]"
      />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className="relative w-full max-w-[540px] overflow-hidden rounded-3xl border border-line bg-canvas shadow-lift"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-4">
          <div>
            <div className="label-mono">Identity-lock</div>
            <h2 className="font-display text-[20px] font-bold tracking-tighter-2 text-ink">
              Crear avatar UGC
            </h2>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-white text-ink-soft shadow-soft transition hover:text-ink"
            aria-label="Cerrar"
          >
            <Icon name="close" size={17} />
          </button>
        </div>

        <div className="space-y-3.5 px-6 py-5">
          <Labeled label="¿Cómo es la persona? (describe el creador)">
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={3}
              placeholder="Ej: mujer 24-28, latina, pelo castaño ondulado, casual, energía cercana, dormitorio con luz de ventana"
              className="w-full resize-none rounded-xl border border-line bg-white px-3 py-2 text-[13px] text-ink shadow-soft outline-none placeholder:text-ink-mute focus:ring-2 focus:ring-area-creative/20"
            />
          </Labeled>
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Nombre (opcional)">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sofía"
                className="w-full rounded-xl border border-line bg-white px-3 py-2 text-[13px] text-ink shadow-soft outline-none focus:ring-2 focus:ring-area-creative/20"
              />
            </Labeled>
            <Labeled label="Producto (opcional)">
              <input
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="ATELIER INK 12"
                className="w-full rounded-xl border border-line bg-white px-3 py-2 text-[13px] text-ink shadow-soft outline-none focus:ring-2 focus:ring-area-creative/20"
              />
            </Labeled>
          </div>
          <Labeled label="Foto de referencia (URL, opcional) — fija la cara real">
            <input
              value={sourceImageUrl}
              onChange={(e) => setSourceImageUrl(e.target.value)}
              placeholder="https://…  (usa input_fidelity=high para mantener el rostro)"
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-[13px] text-ink shadow-soft outline-none focus:ring-2 focus:ring-area-creative/20"
            />
          </Labeled>

          {error && <p className="text-[13px] font-medium text-status-error">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line bg-white/60 px-6 py-3.5 backdrop-blur">
          <button
            onClick={onClose}
            className="rounded-xl border border-line bg-white px-4 py-2.5 text-[13.5px] font-semibold text-ink-soft shadow-soft transition hover:text-ink"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={!brief.trim() || busy}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-semibold text-white shadow-soft transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#ec4899,#8b5cf6)" }}
          >
            {busy ? "Generando avatar + sheet…" : "Generar avatar"}
            <Icon name={busy ? "sparkle" : "rocket"} size={16} className={busy ? "animate-spin-slow" : ""} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
