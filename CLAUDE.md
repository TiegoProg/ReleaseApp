# Orbita — guía para Claude

Orbita es una agencia de marketing agéntica (Next.js 14). El módulo central es el **UGC Studio**: avatares/personas persistentes, generación de imagen con GPT Image y video con Seedance 2.0 (reference-to-video) vía fal.

## 👉 Estado / Próximos pasos (léelo si el usuario pregunta "¿qué hago?")

El pipeline **"keyframe-first"** ya está IMPLEMENTADO (etapas 1-4, ver [HANDOFF.md](HANDOFF.md)):
componer al personaje en la escena como imagen fija con GPT Image (avatar **+** sheet),
aprobarla en el compositor y enviarla como `@Image1` del render (el sheet nunca va a Seedance).
Validación end-to-end pendiente: Video 1 "The Mirror / Your Prime Self".

**Lo único pendiente (opcional):** etapa #5 — keyframes persistidos por producción en el
motor multi-shot ([lib/productions.ts](lib/productions.ts)), que hoy sigue usando el avatar como `@Image1`.

Archivos clave del keyframe: [lib/keyframe.ts](lib/keyframe.ts), [app/api/ugc/keyframe/route.ts](app/api/ugc/keyframe/route.ts),
`KeyframePanel` en [components/Studio.tsx](components/Studio.tsx). Tests: `npm test`.

> **Preferencia del usuario:** trabajar directo sobre `main` (no crear rama).

## Mapa rápido del código

- `lib/personas.ts` — roster de personas (avatar héroe = ancla de identidad, sheet, voz, seed). Persistente en Supabase.
- `lib/avatar.ts` — genera avatar héroe + character sheet (`gpt-image-1`, `input_fidelity=high`). `editImage()` hoy acepta 1 sola referencia.
- `lib/scene.ts` — genera fondos/escenas vacías (sin personas).
- `lib/seedance.ts` — reference-to-video (fal). `@Image1`=avatar, `@Image2`=escena, `@Image3+`=refs extra.
- `lib/ugcPrompt.ts` — reglas server-side: lista negativa, relighting, consistency lock.
- `lib/productions.ts` — motor multi-shot.
- `components/Studio.tsx` — UI del Studio (Compositor + lienzo con character sheet).
- `AI_UGC_SYSTEM.md` — spec del sistema UGC.
