# HANDOFF — Pipeline UGC "keyframe-first" (robustez de identidad/escena)

> **Estado:** propuesta de diseño acordada el 2026-06-16. **Aún NO implementado** — esto es la spec para retomar y construir desde casa.
> **Si abres una sesión y no sabes qué hacer: este es el trabajo pendiente.** Antes de tocar código, haz un brainstorming corto para fijar requisitos y luego TDD.

---

## 1. Objetivo

Robustecer el pipeline UGC añadiendo una etapa intermedia de **composición de personaje-en-escena como imagen fija (keyframe)** antes de animar con Seedance. Hoy el avatar va directo a video y el modelo tiene que *imaginar* vestuario, edad, físico y entorno durante el render — suficiente para un selfie de gym, insuficiente para piezas cinematográficas.

## 2. Cómo funciona HOY (y dónde se queda corto)

Flujo actual, directo:

```
avatar héroe (@Image1) + prompt  ──►  Seedance reference-to-video
```

- Shot único: `const images = [persona.avatarUrl, ...refImages]` → Seedance. Ver [app/api/ugc/route.ts:98](app/api/ugc/route.ts).
- Producción multi-shot: `[persona.avatarUrl, ...sceneUrl, ...extraImageUrls]`. Ver [lib/productions.ts:329](lib/productions.ts).
- `generateScene()` solo crea **fondos vacíos sin personas**. Ver [lib/scene.ts:41](lib/scene.ts).
- `editImage()` (GPT Image / `gpt-image-1`, `input_fidelity=high`) hoy acepta **una sola** imagen de referencia. Ver [lib/avatar.ts:110](lib/avatar.ts).

**Limitación:** no existe un paso que componga "Mark, 45-50, frente a un espejo, con su prime-self en el reflejo" como still aprobable. El modelo de video improvisa esos elementos → deriva de identidad, vestuario inconsistente, escenas complejas (dos instancias del mismo sujeto) imposibles.

## 3. Solución propuesta — 2 etapas (keyframe-first)

```
Etapa 1 (imagen):  avatar + sheet  ──►  GPT Image (gpt-image-1, input_fidelity=high)
                                          + prompt de escena
                                   ──►  KEYFRAME fijo  ──► (humano aprueba)

Etapa 2 (video):   keyframe aprobado (@Image1) + prompt de movimiento  ──►  Seedance
```

**Por qué aquí SÍ se usa el `sheetUrl`:** GPT Image es un modelo de visión que *lee* la character sheet como referencia de identidad (múltiples ángulos + detalle de cara/piel/pelo). Eso enriquece la composición. **Ojo:** el sheet NO debe pasarse a Seedance — el modelo de video copiaría el collage (vistas múltiples, fondo de estudio, etiquetas de texto). El sheet es oro en la etapa de imagen, veneno en la de video.

**Matiz de fidelidad:** `input_fidelity=high` preserva la **cara/identidad**; la **edad, físico y vestuario** los manda el prompt. Por eso podemos envejecer/suavizar a Mark sin perder que sea él.

## 4. Cambios de código concretos

1. **Extender `editImage()` a multi-imagen** ([lib/avatar.ts:110](lib/avatar.ts)). El endpoint `/v1/images/edits` de OpenAI acepta varias imágenes en el form (`image[]`). Aceptar `refUrls: string[]` (avatar + sheet) en vez de un solo `refUrl`.
2. **Nueva función `lib/keyframe.ts` → `composeCharacterInScene({ personaId, prompt, aspect })`**: toma `avatarUrl` + `sheetUrl` de la persona ([lib/personas.ts](lib/personas.ts)) + prompt, llama al `editImage` multi-imagen, persiste el still en Storage y devuelve la URL.
3. **Nuevo endpoint `app/api/ugc/keyframe/route.ts`**: invoca la función y devuelve `{ url, mode }` para previsualización/aprobación.
4. **UI en Studio** ([components/Studio.tsx](components/Studio.tsx)): botón "Generar keyframe" en el Compositor → preview → "Usar este keyframe". Al aprobar, ese keyframe entra como `@Image1` del render de video **en lugar** del avatar héroe.
5. **(Opcional)** persistir keyframes aprobados por producción para reusarlos entre shots y bloquear continuidad.

Reglas que ya existen y se mantienen: lista negativa canónica + relighting anti-"pegado" ([lib/ugcPrompt.ts:15](lib/ugcPrompt.ts), [lib/ugcPrompt.ts:23](lib/ugcPrompt.ts)) y consistency lock con `outfit`/`background` ([lib/ugcPrompt.ts:71](lib/ugcPrompt.ts)).

## 5. Caso de validación — Video 1: "The Mirror / Your Prime Self"

Pieza emocional y cinematográfica. Hombre de 45-50 años se enfrenta a su realidad: más cansado, menos tonificado, postura apagada, pero realista y relatable. Frente a un espejo ve su reflejo actual **y** una versión más fuerte, atlética y disciplinada de sí mismo — su "prime self": el que fue o el que puede volver a ser. Sensación de despertar interno, decisión de volver a entrenar. **No** transformación exagerada ni before/after agresivo: historia de regreso, disciplina y reconexión.

- Formato: **b-roll**, **sin voz**, **sin texto en pantalla**, **sin logos**.
- Tono: premium, masculino, emocional, realista, inspirador.
- Reto técnico clave: **dos instancias del mismo sujeto en un frame** (Mark actual + prime-self en el reflejo). Esto solo es viable componiendo el keyframe en la Etapa 1; el video directo no lo logra.

Este es el escenario con el que se debe probar end-to-end la implementación.

## 6. Primer paso al retomar

1. Brainstorming corto: confirmar requisitos (¿keyframe único o varios beats?, ¿aprobar 1 o N candidatos?, persistencia).
2. TDD sobre `editImage()` multi-imagen.
3. Construir `composeCharacterInScene` + endpoint.
4. UI de aprobación en el Compositor.
5. Validar con "The Mirror".
