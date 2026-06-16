# Orbita — guía para Claude

Orbita es una agencia de marketing agéntica (Next.js 14). El módulo central es el **UGC Studio**: avatares/personas persistentes, generación de imagen con GPT Image y video con Seedance 2.0 (reference-to-video) vía fal.

## 👉 Trabajo pendiente / Próximos pasos (léelo si el usuario pregunta "¿qué hago?")

Hay una implementación acordada **pendiente de construir**: hacer el pipeline UGC más robusto con un paso **"keyframe-first"** (componer al personaje en la escena como imagen fija con GPT Image —usando avatar **+** sheet— y aprobarla antes de animar con Seedance).

**La spec completa y autocontenida está en [HANDOFF.md](HANDOFF.md).** Empieza por ahí: hacer un brainstorming corto de requisitos y luego TDD. Caso de validación: Video 1 "The Mirror / Your Prime Self".

## Mapa rápido del código

- `lib/personas.ts` — roster de personas (avatar héroe = ancla de identidad, sheet, voz, seed). Persistente en Supabase.
- `lib/avatar.ts` — genera avatar héroe + character sheet (`gpt-image-1`, `input_fidelity=high`). `editImage()` hoy acepta 1 sola referencia.
- `lib/scene.ts` — genera fondos/escenas vacías (sin personas).
- `lib/seedance.ts` — reference-to-video (fal). `@Image1`=avatar, `@Image2`=escena, `@Image3+`=refs extra.
- `lib/ugcPrompt.ts` — reglas server-side: lista negativa, relighting, consistency lock.
- `lib/productions.ts` — motor multi-shot.
- `components/Studio.tsx` — UI del Studio (Compositor + lienzo con character sheet).
- `AI_UGC_SYSTEM.md` — spec del sistema UGC.
