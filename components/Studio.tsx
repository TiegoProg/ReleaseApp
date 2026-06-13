"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Icon } from "./Icon";
import { useUiStore } from "@/lib/uiStore";
import {
  UGC_TEMPLATES,
  getUgcTemplate,
  fillUgcTemplate,
  missingRequiredFields,
  type UgcTemplateDef,
} from "@/lib/ugcTemplates";

// ============================================================================
// UGC Studio — creación tipo Higgsfield: avatar (identity-lock) → character
// sheet → animación a video (Seedance 2.0). Ahora con compositor MULTI-REFERENCIA:
// materiales con tags (@Image1, @Video1, @Audio1…), menciones @ en el prompt y
// control de expresiones. Adaptado al stack actual de Orbita.
// ============================================================================

interface PersonaVideo {
  url: string;
  script: string;
  preset?: string;
  cost?: number;
  model?: string;
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

type RefKind = "image" | "video" | "audio";

interface Material {
  id: string;
  kind: RefKind;
  url: string;
  name: string;
}

// Material ya numerado con su tag (@Image2, @Video1, @Audio1…) para el prompt.
interface TaggedMaterial {
  tag: string;
  kind: RefKind;
  label: string;
  url?: string;
  materialId?: string; // ausente en los fijos (avatar / voz)
  locked?: boolean;
}

// Límites de Seedance 2.0 multi-referencia.
const LIMITS = { image: 9, video: 3, audio: 3, total: 12 };

// Expresiones rápidas — inyectan una directiva en el prompt ("manejar expresiones").
const EXPRESSIONS: { key: string; label: string; text: string }[] = [
  { key: "smiling", label: "Smiling", text: "warm, genuine smile" },
  { key: "excited", label: "Excited", text: "excited, high-energy expression" },
  { key: "surprised", label: "Surprised", text: "pleasantly surprised, wide eyes" },
  { key: "serious", label: "Confident", text: "calm, confident, serious tone" },
  { key: "laughing", label: "Laughing", text: "laughing naturally" },
  { key: "curious", label: "Curious", text: "curious, thoughtful look" },
];

const DEFAULT_SCRIPT_HINT =
  "Shot on iPhone front camera, vertical 9:16, natural HDR, real skin tones, authentic UGC creator energy…";

// Modelo Seedance según calidad elegida (mismo override que manda generate()).
// "final" = standard (máxima calidad; en fal NO existe tier "pro").
function seedanceModel(quality: "draft" | "final"): string {
  return quality === "draft"
    ? "bytedance/seedance-2.0/fast/reference-to-video"
    : "bytedance/seedance-2.0/reference-to-video";
}

// Clip propuesto por el agente de prompts (/api/ugc/assist).
interface AssistClip {
  templateId: string;
  values: Record<string, string>;
  rationale?: string;
}
interface AssistMsg {
  role: "user" | "assistant";
  content: string;
  questions?: string[];
  plan?: { title?: string; clips: AssistClip[] };
}

// Reglas de iconos por tipo de material.
const KIND_ICON: Record<RefKind, any> = { image: "image", video: "video", audio: "mic" };
const ACCEPT: Record<RefKind, string> = { image: "image/*", video: "video/*", audio: "audio/*" };

// Numera los materiales en tags posicionales, igual que el backend:
// @Image1 = avatar (fijo); @Audio1 = voz del guion (si speak); luego, en orden,
// los materiales adicionales por tipo.
function buildTags(avatarName: string, materials: Material[], voiceOn: boolean): TaggedMaterial[] {
  const items: TaggedMaterial[] = [];
  let img = 1;
  let vid = 1;
  let aud = 1;

  items.push({ tag: `@Image${img++}`, kind: "image", label: `Avatar · ${avatarName}`, locked: true });
  if (voiceOn) items.push({ tag: `@Audio${aud++}`, kind: "audio", label: "Voz del guion", locked: true });

  for (const m of materials) {
    if (m.kind === "image")
      items.push({ tag: `@Image${img++}`, kind: "image", label: m.name, url: m.url, materialId: m.id });
    else if (m.kind === "video")
      items.push({ tag: `@Video${vid++}`, kind: "video", label: m.name, url: m.url, materialId: m.id });
    else items.push({ tag: `@Audio${aud++}`, kind: "audio", label: m.name, url: m.url, materialId: m.id });
  }
  return items;
}

export default function Studio() {
  const config = useUiStore((s) => s.config);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [loadingRoster, setLoadingRoster] = useState(true);
  // Proyecto del avatar: modal con sus videos, identidad y stats.
  const [projectOpen, setProjectOpen] = useState(false);
  // Asistente (agente de prompts): planifica el ad y produce los clips.
  const [assistOpen, setAssistOpen] = useState(false);

  // Compositor
  const [prompt, setPrompt] = useState("");
  const [script, setScript] = useState("");
  const [speak, setSpeak] = useState(true);
  // Formato Meta Ads: "libre" = compositor manual; otro id = template guiado
  // (el server arma guion + prompt desde lib/ugcTemplates).
  const [templateId, setTemplateId] = useState("libre");
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  // Calidad/costo del render: "draft" = Seedance Fast (más barato, para iterar);
  // "final" = Pro (máxima calidad). El modelo se manda como override por request.
  const [quality, setQuality] = useState<"draft" | "final">("final");
  const [materials, setMaterials] = useState<Material[]>([]);

  // Generación de video
  const [videoStatus, setVideoStatus] = useState<VideoStatus>("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoMeta, setVideoMeta] = useState<string>("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selected = personas.find((p) => p.id === selectedId) ?? null;

  // Template activo + guion armado en vivo (mismo builder que usa el server).
  const activeTemplate: UgcTemplateDef | undefined =
    templateId === "libre" ? undefined : getUgcTemplate(templateId);
  const assembledScript = useMemo(() => {
    if (!activeTemplate) return "";
    return fillUgcTemplate(activeTemplate, templateValues, {
      hasProductRef: materials.some((m) => m.kind === "image"),
    }).script;
  }, [activeTemplate, templateValues, materials]);

  // Guion efectivo: el del template (si está activo) o el manual.
  const effectiveScript = activeTemplate ? assembledScript : script;

  const tags = useMemo(
    () => (selected ? buildTags(selected.name, materials, speak && !!effectiveScript.trim()) : []),
    [selected, materials, speak, effectiveScript]
  );

  const counts = useMemo(() => {
    const images = 1 + materials.filter((m) => m.kind === "image").length; // +avatar
    const videos = materials.filter((m) => m.kind === "video").length;
    const audios =
      (speak && effectiveScript.trim() ? 1 : 0) + materials.filter((m) => m.kind === "audio").length;
    return { images, videos, audios, total: images + videos + audios };
  }, [materials, speak, effectiveScript]);

  const overLimit =
    counts.images > LIMITS.image ||
    counts.videos > LIMITS.video ||
    counts.audios > LIMITS.audio ||
    counts.total > LIMITS.total;

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
    setMaterials([]);
  }, []);

  const addMaterial = useCallback((m: Material) => setMaterials((prev) => [...prev, m]), []);
  const removeMaterial = useCallback(
    (id: string) => setMaterials((prev) => prev.filter((m) => m.id !== id)),
    []
  );

  const generate = useCallback(async () => {
    if (!selected || videoStatus === "rendering" || overLimit) return;
    if (activeTemplate) {
      // Modo template: requiere los campos obligatorios completos.
      if (missingRequiredFields(activeTemplate, templateValues).length) return;
    } else if (!script.trim() && !prompt.trim()) {
      // Modo libre: necesita guion hablado o un prompt.
      return;
    }

    setVideoStatus("rendering");
    setVideoUrl(null);
    setVideoError(null);
    setVideoMeta("");
    if (pollRef.current) clearInterval(pollRef.current);

    try {
      const references = materials.map((m) => ({ kind: m.kind, url: m.url }));
      const model = seedanceModel(quality);
      const res = await fetch("/api/ugc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: selected.id,
          prompt,
          script,
          // El template siempre voicea (el lip-sync depende de @Audio1).
          speak: activeTemplate ? true : speak,
          references,
          model,
          templateId: activeTemplate?.id,
          templateValues: activeTemplate ? templateValues : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "No se pudo generar.");
      const job = data.job;
      // Guion final (el server lo arma en modo template) — para persistirlo.
      const finalScript: string = data.script || script || prompt;
      const cost: number | undefined = job?.costUsd;
      const costLabel = cost != null ? ` · ≈ $${cost.toFixed(2)}` : "";
      setVideoMeta(`voz: ${data.voiceMode} · video: ${job.mode} · ${data.counts?.total ?? "?"} materiales${costLabel}`);

      const personaId = selected.id;
      let saved = false; // evita doble-guardado por carrera de polls
      const doSave = async (url: string) => {
        if (saved) return;
        saved = true;
        try {
          const r = await fetch("/api/ugc/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              personaId,
              videoUrl: url,
              script: finalScript,
              preset: activeTemplate?.id ?? "libre",
              cost,
              model: job?.mode,
            }),
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
  }, [selected, prompt, script, speak, quality, materials, videoStatus, overLimit, activeTemplate, templateValues]);

  return (
    <div className="mx-auto flex h-full max-w-[1200px] flex-col gap-4">
      {/* header */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="label-mono">Creación de creatividades</div>
          <h1 className="font-display text-[24px] font-bold tracking-tighter-2 text-ink">UGC Studio</h1>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            Avatares consistentes (GPT Image 2) animados a video hablado con referencias múltiples (Seedance 2.0).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!config?.hasOpenAI && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11.5px] font-medium text-amber-700">
              Sin OPENAI_API_KEY → avatares en modo stub
            </span>
          )}
          <button
            onClick={() => setAssistOpen(true)}
            disabled={!selected}
            title={selected ? "El agente arma el plan del anuncio y produce los clips" : "Crea o selecciona un avatar primero"}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold text-white shadow-soft transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#ec4899,#8b5cf6)" }}
          >
            <Icon name="sparkle" size={15} /> Asistente IA
          </button>
        </div>
      </div>

      {/* roster de avatares — click = seleccionar + abrir su proyecto */}
      <AvatarRoster
        personas={personas}
        selectedId={selectedId}
        loading={loadingRoster}
        onSelect={(id) => {
          setSelectedId(id);
          setProjectOpen(true);
        }}
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
            onOpenProject={() => setProjectOpen(true)}
          />
        ) : (
          <EmptyState onCreate={() => setCreating(true)} />
        )}
      </div>

      {/* compositor multi-referencia */}
      {selected && (
        <MultiRefComposer
          persona={selected}
          prompt={prompt}
          onPrompt={setPrompt}
          script={script}
          onScript={setScript}
          speak={speak}
          onSpeak={setSpeak}
          quality={quality}
          onQuality={setQuality}
          templateId={templateId}
          onTemplateId={setTemplateId}
          templateValues={templateValues}
          onTemplateValues={setTemplateValues}
          assembledScript={assembledScript}
          materials={materials}
          onAddMaterial={addMaterial}
          onRemoveMaterial={removeMaterial}
          tags={tags}
          counts={counts}
          overLimit={overLimit}
          status={videoStatus}
          onGenerate={generate}
        />
      )}

      {/* Modales SIN AnimatePresence: con reactStrictMode el exit nunca
          desmonta (modal zombie invisible que bloquea clicks). Entrada animada
          via initial/animate; la salida es instantánea. */}
      {creating && <CreateAvatarModal onClose={() => setCreating(false)} onCreated={onCreated} />}
      {projectOpen && selected && (
        <AvatarProjectModal persona={selected} onClose={() => setProjectOpen(false)} />
      )}
      {assistOpen && selected && (
        <AssistantPanel
          persona={selected}
          quality={quality}
          onClose={() => setAssistOpen(false)}
          onApply={(clip) => {
            setTemplateId(clip.templateId);
            setTemplateValues(clip.values);
            setAssistOpen(false);
          }}
          onPersona={(p) => setPersonas((prev) => prev.map((x) => (x.id === p.id ? p : x)))}
        />
      )}
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
  onOpenProject,
}: {
  persona: Persona;
  videoStatus: VideoStatus;
  videoUrl: string | null;
  videoError: string | null;
  videoMeta: string;
  onOpenProject: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const totalCost = (persona.videos ?? []).reduce((s, v) => s + (v.cost ?? 0), 0);
  const rendering = videoStatus === "rendering" || videoStatus === "ready" || videoStatus === "stub" || videoStatus === "failed";

  return (
    <div className="space-y-3">
      {/* barra compacta del avatar + toggle de detalles (libera espacio) */}
      <div className="floor-plate flex items-center gap-3 px-3 py-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={persona.avatarUrl} alt={persona.name} className="h-9 w-9 rounded-lg object-cover" />
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-ink">{persona.name}</div>
          <div className="truncate text-[11px] text-ink-mute">
            {persona.voiceName} · {persona.language} · seed {persona.seed}
            {totalCost > 0 && <span className="text-ink-soft"> · ≈ ${totalCost.toFixed(2)} gastado</span>}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onOpenProject}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-ink shadow-soft transition hover:border-area-creative hover:text-area-creative"
          >
            <Icon name="video" size={13} />
            Proyecto · {persona.videos?.length ?? 0}
          </button>
          <button
            onClick={() => setDetailsOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-ink-soft shadow-soft transition hover:text-ink"
          >
            {detailsOpen ? "Ocultar detalles" : "Character sheet"}
            <Icon name="chevron" size={13} className={detailsOpen ? "-rotate-90" : "rotate-90"} />
          </button>
        </div>
      </div>

      {(detailsOpen || rendering) && (
      <div className={detailsOpen ? "grid gap-4 lg:grid-cols-[1fr,300px]" : "grid gap-4"}>
        {/* sheet */}
        <div className={`floor-plate p-4 ${detailsOpen ? "" : "hidden"}`}>
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
                Escribe el prompt / guion abajo y dale <b>Generar</b> para animar a {persona.name}.
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
      )}

      {/* resumen del proyecto (la galería completa vive en el modal) */}
      {persona.videos && persona.videos.length > 0 && (
        <button
          onClick={onOpenProject}
          className="floor-plate group flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:border-area-creative/40"
        >
          <div className="flex -space-x-2">
            {persona.videos.slice(0, 3).map((v, i) => (
              <span
                key={i}
                className="grid h-8 w-8 place-items-center overflow-hidden rounded-lg border-2 border-white bg-ink/90 shadow-soft"
              >
                <Icon name="video" size={13} className="text-white/70" />
              </span>
            ))}
          </div>
          <span className="text-[12.5px] text-ink-soft">
            <b className="font-semibold text-ink">{persona.videos.length} videos</b> generados
            {totalCost > 0 && <span className="text-ink-mute"> · ≈ ${totalCost.toFixed(2)} invertido</span>}
          </span>
          <span className="ml-auto flex items-center gap-1 text-[11.5px] font-semibold text-area-creative opacity-0 transition group-hover:opacity-100">
            Ver proyecto <Icon name="chevron" size={12} />
          </span>
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Proyecto del avatar: de qué trata + galería de videos generados
// ---------------------------------------------------------------------------
function AvatarProjectModal({ persona, onClose }: { persona: Persona; onClose: () => void }) {
  const videos = persona.videos ?? [];
  const totalCost = videos.reduce((s, v) => s + (v.cost ?? 0), 0);

  // Etiqueta legible del formato con el que se generó cada clip.
  // Cubre también los presets antiguos (antes de los templates Meta Ads).
  const LEGACY_LABELS: Record<string, string> = {
    "talking-head": "Talking head",
    unboxing: "Unboxing",
    review: "Review",
    "try-on": "Try-on",
  };
  const formatLabel = (preset?: string) => {
    if (!preset || preset === "libre") return "Libre";
    return getUgcTemplate(preset)?.label ?? LEGACY_LABELS[preset] ?? preset;
  };

  return (
    // El root DEBE ser motion.div: AnimatePresence solo desmonta cuando su hijo
    // directo (motion) completa el exit; con un div plano queda un modal zombie.
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] grid place-items-center p-4"
    >
      <div onClick={onClose} className="absolute inset-0 bg-ink/35 backdrop-blur-[3px]" />
      <motion.div
        initial={{ y: 20, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className="relative flex max-h-[88vh] w-full max-w-[960px] flex-col overflow-hidden rounded-3xl border border-line bg-canvas shadow-lift"
      >
        {/* header: quién es + de qué trata */}
        <div className="flex items-start gap-4 border-b border-line px-6 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={persona.avatarUrl}
            alt={persona.name}
            className="h-16 w-16 shrink-0 rounded-2xl border border-line object-cover shadow-soft"
          />
          <div className="min-w-0 flex-1">
            <div className="label-mono">Proyecto</div>
            <h2 className="font-display text-[20px] font-bold tracking-tighter-2 text-ink">{persona.name}</h2>
            <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-ink-soft">{persona.identity}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Chip icon="mic" text={`${persona.voiceName} · ${persona.language}`} />
              <Chip icon="refresh" text={`seed ${persona.seed}`} />
              {persona.product && <Chip icon="image" text={persona.product} />}
              <Chip icon="video" text={`${videos.length} videos`} />
              {totalCost > 0 && <Chip icon="sparkle" text={`≈ $${totalCost.toFixed(2)} invertido`} />}
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-white text-ink-soft shadow-soft transition hover:text-ink"
            aria-label="Cerrar"
          >
            <Icon name="close" size={17} />
          </button>
        </div>

        {/* galería */}
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {videos.length === 0 ? (
            <div className="grid place-items-center py-14 text-center">
              <Icon name="video" size={28} className="mb-2 text-ink-mute" />
              <p className="text-[13.5px] font-medium text-ink-soft">Aún no hay videos de {persona.name}.</p>
              <p className="mt-1 text-[12px] text-ink-mute">
                Cierra este panel, elige un formato en el compositor y dale Generar.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {videos.map((v, i) => (
                <div
                  key={i}
                  className="group overflow-hidden rounded-2xl border border-line bg-white shadow-soft transition hover:shadow-lift"
                >
                  <div className="relative bg-ink">
                    <video
                      src={v.url}
                      poster={persona.avatarUrl}
                      controls
                      playsInline
                      preload="metadata"
                      className="aspect-[9/16] w-full object-cover"
                    />
                    <span className="absolute left-1.5 top-1.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                      {formatLabel(v.preset)}
                    </span>
                    {v.cost != null && (
                      <span className="absolute right-1.5 top-1.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                        ≈ ${v.cost.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="px-2.5 py-2">
                    <p className="line-clamp-2 text-[11.5px] leading-snug text-ink-soft">{v.script}</p>
                    <p className="mt-1 text-[10.5px] text-ink-mute">
                      {v.createdAt ? new Date(v.createdAt).toLocaleDateString() : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Chip({ icon, text }: { icon: any; text: string }) {
  return (
    <span className="flex items-center gap-1 rounded-full border border-line bg-white px-2 py-0.5 text-[10.5px] font-medium text-ink-soft shadow-soft">
      <Icon name={icon} size={11} className="text-ink-mute" />
      {text}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Asistente IA: agente de prompts que planifica el anuncio (chat) y PRODUCE
// los clips hasta el objetivo (secuencial: /api/ugc → poll → save).
// ---------------------------------------------------------------------------
type ClipJobStatus = "pending" | "rendering" | "ready" | "failed";
interface ClipJob {
  label: string;
  status: ClipJobStatus;
  url?: string;
  cost?: number;
  error?: string;
}

function AssistantPanel({
  persona,
  quality,
  onClose,
  onApply,
  onPersona,
}: {
  persona: Persona;
  quality: "draft" | "final";
  onClose: () => void;
  onApply: (clip: AssistClip) => void;
  onPersona: (p: Persona) => void;
}) {
  const [messages, setMessages] = useState<AssistMsg[]>([
    {
      role: "assistant",
      content: `Soy tu director creativo. Dime qué anuncio quieres crear con ${persona.name} — producto, a quién apunta y qué quieres lograr — y armo el plan de clips listo para producir.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [jobs, setJobs] = useState<ClipJob[]>([]);
  const producing = jobs.some((j) => j.status === "pending" || j.status === "rendering");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, jobs]);

  // Último plan propuesto (el agente puede iterarlo; manda el más reciente).
  const lastPlan = [...messages].reverse().find((m) => m.plan?.clips?.length)?.plan;

  async function send() {
    const text = input.trim();
    if (!text || sending || producing) return;
    setInput("");
    const next: AssistMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setSending(true);
    try {
      const res = await fetch("/api/ugc/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: persona.id,
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "El asistente falló.");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, questions: data.questions, plan: data.plan },
      ]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ ${e?.message ?? "Error al consultar el asistente."}` },
      ]);
    } finally {
      setSending(false);
    }
  }

  // Espera un render de fal hasta ready/failed (poll cada 5s, tope 6 min).
  async function waitForJob(requestId: string): Promise<{ url?: string; error?: string }> {
    const deadline = Date.now() + 6 * 60_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const res = await fetch(`/api/ugc/status?requestId=${encodeURIComponent(requestId)}`);
        const d = await res.json();
        if (d.job?.status === "ready") return { url: d.job.videoUrl };
        if (d.job?.status === "failed") return { error: d.job.error ?? "Render falló." };
      } catch {
        /* red intermitente: seguimos intentando hasta el deadline */
      }
    }
    return { error: "Timeout esperando el render (6 min)." };
  }

  // Produce TODOS los clips del plan, en secuencia, hasta terminar (el objetivo).
  async function produceAll(clips: AssistClip[]) {
    if (producing) return;
    const labels = clips.map((c, i) => {
      const tpl = getUgcTemplate(c.templateId);
      return `Clip ${i + 1} · ${tpl?.label ?? c.templateId}`;
    });
    setJobs(clips.map((_, i) => ({ label: labels[i], status: "pending" })));

    const results: ClipJob[] = [];
    for (let i = 0; i < clips.length; i++) {
      setJobs((prev) => prev.map((j, k) => (k === i ? { ...j, status: "rendering" } : j)));
      const clip = clips[i];
      let result: ClipJob = { label: labels[i], status: "failed", error: "desconocido" };
      try {
        const res = await fetch("/api/ugc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personaId: persona.id,
            templateId: clip.templateId,
            templateValues: clip.values,
            speak: true,
            references: [],
            model: seedanceModel(quality),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "No se pudo encolar el render.");
        const job = data.job;
        if (job.status === "failed") throw new Error(job.error ?? "Render falló al encolar.");

        let url: string | undefined = job.videoUrl;
        if (job.status === "rendering" && job.requestId) {
          const done = await waitForJob(job.requestId);
          if (done.error) throw new Error(done.error);
          url = done.url;
        }
        if (!url) throw new Error("Render sin URL de video.");

        // Persistir en la persona (igual que el flujo manual).
        try {
          const saveRes = await fetch("/api/ugc/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              personaId: persona.id,
              videoUrl: url,
              script: data.script,
              preset: clip.templateId,
              cost: job.costUsd,
              model: job.mode,
            }),
          });
          const saved = await saveRes.json();
          if (saveRes.ok && saved.persona) onPersona(saved.persona);
        } catch {
          /* el clip existe igual; solo falló persistirlo */
        }
        result = { label: labels[i], status: "ready", url, cost: job.costUsd };
      } catch (e: any) {
        result = { label: labels[i], status: "failed", error: e?.message ?? String(e) };
      }
      results.push(result);
      setJobs((prev) => prev.map((j, k) => (k === i ? result : j)));
    }

    // Resumen final al chat (el agente "reporta" el cierre del objetivo).
    const ok = results.filter((r) => r.status === "ready").length;
    const spent = results.reduce((s, r) => s + (r.cost ?? 0), 0);
    const fails = results
      .filter((r) => r.status === "failed")
      .map((r) => `${r.label}: ${r.error}`)
      .join(" · ");
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content:
          ok === results.length
            ? `✅ Objetivo cumplido: ${ok}/${results.length} clips producidos (≈ $${spent.toFixed(2)}). Están guardados en el proyecto de ${persona.name}.`
            : `Terminé la producción: ${ok}/${results.length} clips listos${spent > 0 ? ` (≈ $${spent.toFixed(2)})` : ""}. Fallaron: ${fails}. Si fue saldo de fal, recarga y dime "reintenta" para volver a producir los que faltan.`,
      },
    ]);
  }

  const estPerClip = estimateUgcCost(quality, false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] flex justify-end"
    >
      <div onClick={producing ? undefined : onClose} className="absolute inset-0 bg-ink/35 backdrop-blur-[3px]" />
      <motion.div
        initial={{ x: 40 }}
        animate={{ x: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="relative flex h-full w-full max-w-[460px] flex-col border-l border-line bg-canvas shadow-lift"
      >
        {/* header */}
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span
            className="grid h-9 w-9 place-items-center rounded-xl text-white"
            style={{ background: "linear-gradient(135deg,#ec4899,#8b5cf6)" }}
          >
            <Icon name="sparkle" size={16} />
          </span>
          <div className="min-w-0">
            <div className="text-[13.5px] font-bold text-ink">Asistente IA</div>
            <div className="truncate text-[11px] text-ink-mute">
              Director creativo · {persona.name} · {quality === "final" ? "Final · pro" : "Draft · fast"} · ≈ ${estPerClip.toFixed(2)}/clip
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={producing}
            title={producing ? "Producción en curso — espera a que termine" : "Cerrar"}
            className="ml-auto grid h-8 w-8 place-items-center rounded-lg border border-line bg-white text-ink-soft shadow-soft transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Cerrar asistente"
          >
            <Icon name="close" size={15} />
          </button>
        </div>

        {/* conversación */}
        <div ref={scrollRef} className="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[88%] rounded-2xl px-3 py-2 text-[12.5px] leading-snug ${
                  m.role === "user"
                    ? "bg-ink text-white"
                    : "border border-line bg-white text-ink shadow-soft"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
                {!!m.questions?.length && (
                  <ul className="mt-1.5 space-y-0.5">
                    {m.questions.map((q, k) => (
                      <li key={k} className="text-[12px] font-medium text-area-creative">• {q}</li>
                    ))}
                  </ul>
                )}
                {/* plan propuesto: cards por clip */}
                {!!m.plan?.clips?.length && (
                  <div className="mt-2.5 space-y-2">
                    {m.plan.title && (
                      <div className="label-mono">{m.plan.title}</div>
                    )}
                    {m.plan.clips.map((clip, k) => {
                      const tpl = getUgcTemplate(clip.templateId);
                      const filled = tpl
                        ? fillUgcTemplate(tpl, clip.values, { hasProductRef: false })
                        : null;
                      return (
                        <div key={k} className="rounded-xl border border-line bg-surface-sunken p-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-md bg-ink px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-white">
                              Clip {k + 1}
                            </span>
                            <span className="text-[11px] font-semibold text-ink">{tpl?.label ?? clip.templateId}</span>
                            <button
                              onClick={() => onApply(clip)}
                              className="ml-auto rounded-md border border-line bg-white px-2 py-0.5 text-[10.5px] font-semibold text-ink-soft shadow-soft transition hover:text-ink"
                              title="Cargar este clip en el compositor para editarlo"
                            >
                              Aplicar
                            </button>
                          </div>
                          {filled && (
                            <p className="mt-1.5 text-[11.5px] italic leading-snug text-ink-soft">“{filled.script}”</p>
                          )}
                          {clip.rationale && (
                            <p className="mt-1 text-[10.5px] text-ink-mute">{clip.rationale}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex items-center gap-2 text-[12px] text-ink-mute">
              <Icon name="sparkle" size={14} className="animate-spin-slow text-area-creative" /> pensando…
            </div>
          )}

          {/* progreso de producción */}
          {jobs.length > 0 && (
            <div className="rounded-2xl border border-line bg-white p-3 shadow-soft">
              <div className="label-mono mb-1.5">Producción</div>
              {jobs.map((j, i) => (
                <div key={i} className="flex items-center gap-2 py-1 text-[12px]">
                  {j.status === "ready" ? (
                    <Icon name="check" size={13} className="text-status-done" />
                  ) : j.status === "failed" ? (
                    <Icon name="close" size={13} className="text-status-error" />
                  ) : j.status === "rendering" ? (
                    <Icon name="sparkle" size={13} className="animate-spin-slow text-area-creative" />
                  ) : (
                    <span className="h-3 w-3 rounded-full border border-line" />
                  )}
                  <span className="text-ink-soft">{j.label}</span>
                  <span className="ml-auto text-[11px] text-ink-mute">
                    {j.status === "ready" && `listo${j.cost != null ? ` · ≈ $${j.cost.toFixed(2)}` : ""}`}
                    {j.status === "rendering" && "renderizando…"}
                    {j.status === "pending" && "en cola"}
                    {j.status === "failed" && (j.error ?? "falló")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* acciones del plan + input */}
        <div className="border-t border-line bg-white/70 px-4 py-3 backdrop-blur">
          {lastPlan && !producing && (
            <button
              onClick={() => produceAll(lastPlan.clips)}
              className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-soft transition"
              style={{ background: "linear-gradient(135deg,#ec4899,#8b5cf6)" }}
            >
              <Icon name="rocket" size={15} />
              Producir {lastPlan.clips.length} clips · ≈ ${(lastPlan.clips.length * estPerClip).toFixed(2)}
            </button>
          )}
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              disabled={sending || producing}
              placeholder={producing ? "Produciendo clips…" : "Ej: quiero un ad de Cholibrium para hombres 50+…"}
              className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-2 text-[13px] text-ink shadow-soft outline-none placeholder:text-ink-mute focus:ring-2 focus:ring-area-creative/20 disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={!input.trim() || sending || producing}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink text-white shadow-soft transition disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Enviar"
            >
              <Icon name="chevron" size={15} />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
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
// Compositor multi-referencia (estilo Higgsfield + guía Seedance 2.0)
// Estimación de costo en vivo — espejo de estimateCostUsd() en lib/seedance.ts.
// 720p · 8s; pro $0.3024/s, fast $0.2419/s; 0.6× si hay video de referencia.
function estimateUgcCost(quality: "draft" | "final", hasVideoInput: boolean): number {
  const perSec = quality === "final" ? 0.3024 : 0.2419;
  const videoMult = hasVideoInput ? 0.6 : 1;
  return Math.round(perSec * 8 * videoMult * 100) / 100;
}

// ---------------------------------------------------------------------------
function MultiRefComposer({
  persona,
  prompt,
  onPrompt,
  script,
  onScript,
  speak,
  onSpeak,
  quality,
  onQuality,
  templateId,
  onTemplateId,
  templateValues,
  onTemplateValues,
  assembledScript,
  materials,
  onAddMaterial,
  onRemoveMaterial,
  tags,
  counts,
  overLimit,
  status,
  onGenerate,
}: {
  persona: Persona;
  prompt: string;
  onPrompt: (v: string) => void;
  script: string;
  onScript: (v: string) => void;
  speak: boolean;
  onSpeak: (v: boolean) => void;
  quality: "draft" | "final";
  onQuality: (v: "draft" | "final") => void;
  templateId: string;
  onTemplateId: (v: string) => void;
  templateValues: Record<string, string>;
  onTemplateValues: (v: Record<string, string>) => void;
  assembledScript: string;
  materials: Material[];
  onAddMaterial: (m: Material) => void;
  onRemoveMaterial: (id: string) => void;
  tags: TaggedMaterial[];
  counts: { images: number; videos: number; audios: number; total: number };
  overLimit: boolean;
  status: VideoStatus;
  onGenerate: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [uploading, setUploading] = useState<RefKind | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRefs = {
    image: useRef<HTMLInputElement>(null),
    video: useRef<HTMLInputElement>(null),
    audio: useRef<HTMLInputElement>(null),
  };
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const atCap = (kind: RefKind) =>
    counts[`${kind}s` as "images" | "videos" | "audios"] >= LIMITS[kind] || counts.total >= LIMITS.total;

  async function handleFile(kind: RefKind, file: File | null) {
    if (!file) return;
    setUploadError(null);
    setUploading(kind);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error ?? "No se pudo subir.");
      onAddMaterial({ id: crypto.randomUUID(), kind, url: d.url, name: file.name });
    } catch (e: any) {
      setUploadError(e?.message ?? "Error al subir.");
    } finally {
      setUploading(null);
    }
  }

  // Inserta un tag en el prompt en la posición del cursor.
  function insertTag(tag: string) {
    const el = promptRef.current;
    const caret = el?.selectionStart ?? prompt.length;
    const next = `${prompt.slice(0, caret)}${tag} ${prompt.slice(caret)}`;
    onPrompt(next);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = caret + tag.length + 1;
      el?.setSelectionRange(pos, pos);
    });
  }

  function applyExpression(text: string) {
    const phrase = `${persona.name}'s facial expression: ${text}.`;
    onPrompt(prompt.trim() ? `${prompt.trim()} ${phrase}` : phrase);
  }

  const tpl = templateId === "libre" ? undefined : getUgcTemplate(templateId);
  const tplMissing = tpl ? missingRequiredFields(tpl, templateValues) : [];
  const tplReady = !!tpl && tplMissing.length === 0;
  // Lo que dirá el avatar (para la barra colapsada y el preview).
  const spokenPreview = tpl ? assembledScript : script.trim() || prompt.trim();

  const canGenerate =
    (tpl ? tplReady : !!script.trim() || !!prompt.trim()) && !overLimit && status !== "rendering";

  function setField(key: string, value: string) {
    onTemplateValues({ ...templateValues, [key]: value });
  }

  return (
    <div className="rounded-3xl border border-line bg-ink/[0.97] p-3 shadow-lift">
      {/* header: colapsar / expandir el compositor */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-wide text-white/40">Compositor</span>
        {/* contador solo colapsado: expandido ya se ve junto a Generar */}
        {!open && (
          <span className="font-mono text-[10.5px] text-white/30">
            {counts.images}img · {counts.videos}vid · {counts.audios}aud · {counts.total}/12
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="ml-auto flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[11px] font-medium text-white/70 transition hover:bg-white/20 hover:text-white"
        >
          {open ? "Colapsar" : "Expandir"}
          <Icon name="chevron" size={12} className={open ? "rotate-90" : "-rotate-90"} />
        </button>
      </div>

      <div className={open ? "" : "hidden"}>
      {/* formato Meta Ads: libre o template guiado */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[10.5px] font-semibold uppercase tracking-wide text-white/35">Formato</span>
        <button
          type="button"
          onClick={() => onTemplateId("libre")}
          className={`rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition ${
            !tpl ? "bg-white text-ink" : "bg-white/10 text-white/70 hover:bg-white/20"
          }`}
          title="Compositor manual: prompt + guion libres"
        >
          Libre
        </button>
        {UGC_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTemplateId(t.id)}
            className={`rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition ${
              tpl?.id === t.id ? "bg-white text-ink" : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
            title={t.why}
          >
            {t.label}
            <span className={`ml-1.5 text-[10px] ${tpl?.id === t.id ? "text-ink/60" : "text-white/40"}`}>
              {t.tagline}
            </span>
          </button>
        ))}
      </div>

      {/* bandeja de materiales con tags */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <span
            key={t.tag}
            className="group flex items-center gap-1.5 rounded-lg bg-white/10 py-1 pl-1 pr-2 text-[11.5px] font-medium text-white/85"
            title={t.label}
          >
            {t.url ? (
              t.kind === "image" ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={t.url} alt="" className="h-6 w-6 rounded object-cover" />
              ) : (
                <span className="grid h-6 w-6 place-items-center rounded bg-white/10">
                  <Icon name={KIND_ICON[t.kind]} size={13} />
                </span>
              )
            ) : t.locked && t.kind === "image" ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={persona.avatarUrl} alt="" className="h-6 w-6 rounded object-cover" />
            ) : (
              <span className="grid h-6 w-6 place-items-center rounded bg-white/10">
                <Icon name={KIND_ICON[t.kind]} size={13} />
              </span>
            )}
            <button
              type="button"
              onClick={() => insertTag(t.tag)}
              className="font-mono text-[10.5px] text-white/70 hover:text-white"
              title={`Insertar ${t.tag} en el prompt`}
            >
              {t.tag}
            </button>
            <span className="max-w-[120px] truncate text-white/55">{t.label}</span>
            {!t.locked && t.materialId && (
              <button
                type="button"
                onClick={() => onRemoveMaterial(t.materialId!)}
                className="ml-0.5 text-white/40 transition hover:text-white"
                aria-label="Quitar material"
              >
                <Icon name="close" size={12} />
              </button>
            )}
          </span>
        ))}

        {/* añadir material */}
        {(["image", "video", "audio"] as RefKind[]).map((kind) => (
          <button
            key={kind}
            type="button"
            disabled={atCap(kind) || uploading !== null}
            onClick={() => fileRefs[kind].current?.click()}
            className="flex items-center gap-1 rounded-lg border border-dashed border-white/25 px-2 py-1 text-[11px] font-medium text-white/60 transition hover:border-white/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            title={atCap(kind) ? "Límite alcanzado" : `Añadir ${kind}`}
          >
            <Icon name={uploading === kind ? "sparkle" : "plus"} size={12} className={uploading === kind ? "animate-spin-slow" : ""} />
            {kind === "image" ? "Imagen" : kind === "video" ? "Video" : "Audio"}
          </button>
        ))}
        {(["image", "video", "audio"] as RefKind[]).map((kind) => (
          <input
            key={kind}
            ref={fileRefs[kind]}
            type="file"
            accept={ACCEPT[kind]}
            className="hidden"
            onChange={(e) => {
              handleFile(kind, e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
        ))}
      </div>

      {uploadError && <p className="mb-2 px-1 text-[11px] text-rose-300">{uploadError}</p>}

      {!tpl ? (
        /* prompt libre con menciones @ */
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-1">
          <textarea
            ref={promptRef}
            value={prompt}
            onChange={(e) => onPrompt(e.target.value)}
            rows={2}
            placeholder={`Prompt de la escena — escribe @ para insertar referencias (${DEFAULT_SCRIPT_HINT})`}
            className="w-full resize-none bg-transparent px-2 py-1.5 text-[13.5px] text-white outline-none placeholder:text-white/35"
          />
          {/* guion hablado */}
          <div className="flex items-center gap-2 border-t border-white/10 px-1.5 pt-1.5">
            <Icon name="mic" size={14} className="shrink-0 text-white/45" />
            <input
              value={script}
              onChange={(e) => onScript(e.target.value)}
              placeholder={`Guion que dirá ${persona.name}… (voz ${persona.voiceName}, ${persona.language})`}
              className="min-w-0 flex-1 bg-transparent py-0.5 text-[13px] text-white outline-none placeholder:text-white/30"
            />
            <button
              type="button"
              onClick={() => onSpeak(!speak)}
              className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[10.5px] font-semibold transition ${
                speak ? "bg-white/15 text-white" : "bg-white/5 text-white/40"
              }`}
              title="Generar voz a partir del guion (→ @Audio1)"
            >
              <Icon name={speak ? "check" : "close"} size={11} /> Voz
            </button>
          </div>
        </div>
      ) : (
        /* campos guiados del template */
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-2.5">
          <p className="mb-2 text-[11.5px] leading-snug text-white/45">{tpl.why}</p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {tpl.fields.map((f) => (
              <label key={f.key} className={f.kind === "long" ? "md:col-span-2" : ""}>
                <span className="mb-0.5 block text-[10.5px] font-semibold uppercase tracking-wide text-white/40">
                  {f.label}
                  {f.required && <span className="ml-1 text-rose-300">*</span>}
                </span>
                {f.kind === "long" ? (
                  <textarea
                    value={templateValues[f.key] ?? ""}
                    onChange={(e) => setField(f.key, e.target.value)}
                    rows={2}
                    placeholder={f.placeholder}
                    className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.05] px-2 py-1.5 text-[13px] text-white outline-none placeholder:text-white/25 focus:border-white/30"
                  />
                ) : (
                  <input
                    value={templateValues[f.key] ?? ""}
                    onChange={(e) => setField(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-2 py-1.5 text-[13px] text-white outline-none placeholder:text-white/25 focus:border-white/30"
                  />
                )}
              </label>
            ))}
          </div>

          {/* hint de producto (@Image2) + tips del formato */}
          {tpl.needsProductRef && counts.images < 2 && (
            <p className="mt-2 rounded-lg bg-amber-400/10 px-2 py-1 text-[11px] text-amber-200">
              Tip: sube una foto del producto (botón “+ Imagen”) — será <span className="font-mono">@Image2</span> y
              Seedance lo replicará exacto.
            </p>
          )}
          {!!tpl.notes?.length && (
            <ul className="mt-2 space-y-0.5">
              {tpl.notes.map((n, i) => (
                <li key={i} className="text-[11px] text-white/35">· {n}</li>
              ))}
            </ul>
          )}

          {/* preview del guion que se voicea */}
          <div className="mt-2 rounded-xl border border-white/10 bg-ink/60 px-2.5 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/35">
              {persona.name} dirá (voz {persona.voiceName})
            </span>
            <p className={`mt-0.5 text-[12.5px] leading-snug ${assembledScript ? "text-white/85" : "italic text-white/30"}`}>
              {assembledScript || "Completa los campos para armar el guion…"}
            </p>
          </div>
        </div>
      )}

      {/* expresiones (solo modo libre; el template define la energía) */}
      {!tpl && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-wide text-white/35">Expresión</span>
          {EXPRESSIONS.map((ex) => (
            <button
              key={ex.key}
              type="button"
              onClick={() => applyExpression(ex.text)}
              className="rounded-lg bg-white/8 px-2 py-1 text-[11px] font-medium text-white/65 transition hover:bg-white/20 hover:text-white"
              title={ex.text}
            >
              {ex.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {/* calidad/costo: draft = Seedance Fast (barato, para iterar) · final = Pro */}
        <div
          className="flex items-center gap-0.5 rounded-lg bg-white/5 p-0.5"
          title="Draft = Seedance Fast (más barato, para iterar) · Final = Pro (máxima calidad)"
        >
          {(["draft", "final"] as const).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onQuality(q)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                quality === q ? "bg-white text-ink" : "text-white/55 hover:text-white"
              }`}
            >
              {q === "draft" ? "Draft · fast" : "Final · pro"}
            </button>
          ))}
        </div>

        <span
          className="text-[11px] font-medium text-white/45"
          title="Costo estimado del render (720p · 8s). 0.6× si incluyes un video de referencia."
        >
          ≈ ${estimateUgcCost(quality, counts.videos > 0).toFixed(2)}
        </span>

        <div className="ml-auto flex items-center gap-2.5">
          <span className={`text-[11px] ${overLimit ? "font-semibold text-rose-300" : "text-white/40"}`}>
            {counts.images}/9 img · {counts.videos}/3 vid · {counts.audios}/3 aud · {counts.total}/12
          </span>

          <button
            onClick={onGenerate}
            disabled={!canGenerate}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13.5px] font-semibold text-white shadow-soft transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#ec4899,#8b5cf6)" }}
          >
            {status === "rendering" ? "Generando…" : "Generar"}
            <Icon
              name={status === "rendering" ? "sparkle" : "video"}
              size={15}
              className={status === "rendering" ? "animate-spin-slow" : ""}
            />
          </button>
        </div>
      </div>
      </div>{/* /cuerpo expandido */}

      {/* barra slim cuando el compositor está colapsado */}
      {!open && (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={persona.avatarUrl} alt="" className="h-7 w-7 rounded-lg object-cover" />
          <span className="text-[12px] font-medium text-white/80">{persona.name}</span>
          {tpl && (
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/60">
              {tpl.label}
            </span>
          )}
          {spokenPreview.trim() && (
            <span className="max-w-[40%] truncate text-[11px] text-white/35">{spokenPreview}</span>
          )}
          <button
            onClick={onGenerate}
            disabled={!canGenerate}
            className="ml-auto flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold text-white shadow-soft transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#ec4899,#8b5cf6)" }}
          >
            {status === "rendering" ? "Generando…" : "Generar"}
            <Icon
              name={status === "rendering" ? "sparkle" : "video"}
              size={14}
              className={status === "rendering" ? "animate-spin-slow" : ""}
            />
          </button>
        </div>
      )}
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
    // Root motion.div: ver nota en AvatarProjectModal (evita el modal zombie).
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] grid place-items-center p-4"
    >
      <div onClick={onClose} className="absolute inset-0 bg-ink/35 backdrop-blur-[3px]" />
      <motion.div
        initial={{ y: 20, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
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
    </motion.div>
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
