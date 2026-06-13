# Cholibrium — Paquete de Producción UGC v2 ("Mi rutina a los 55")

> Generado por el sistema AI_UGC_SYSTEM.md · 2026-06-12
> Estado: **READY TO RENDER — pendiente de aprobación (ningún render pago lanzado)**

## 0. Supuestos (marcados explícitamente)

| # | Supuesto | Base |
|---|----------|------|
| A1 | Producto = **Cholibrium**, suplemento de hongos funcionales (wellness/energía) | Inferido del workspace: `scripts/produce-podcast-ad.mjs`, persona "Mark" (`b43726b6-1c90-485e-83fa-652276458198`), campaña podcast v1 ya renderizada |
| A2 | País/idioma = **EE.UU. / inglés** | Guiones v1 en inglés americano |
| A3 | Plataforma = **Meta Ads** (Reels/Feed 9:16) | `lib/ugcTemplates.ts` está optimizado para Meta |
| A4 | Presupuesto ≈ **$10 USD máx** por concepto | Run v1 costó ≈ $7.26 (3×8s standard) |
| A5 | Landing page URL = **desconocida** → confirmar antes de subir el ad | No provista |
| A6 | Imagen real del producto = **no disponible en el workspace** → overlay en post requiere el packshot real | Regla de Product Handling #1 |

---

## 1. Análisis del producto

- **Resumen:** Cholibrium, blend de hongos funcionales en cápsulas, posicionado en wellness diario (energía estable, rutina de salud). El nombre sugiere soporte cardiovascular/colesterol → **nicho de altísimo riesgo de compliance en Meta**: la creatividad vende experiencia personal y rutina, nunca tratamiento.
- **Categoría:** Suplemento health & wellness (hongos funcionales).
- **Público objetivo:** Hombres y mujeres 45–65, EE.UU., conscientes de su salud, escépticos del hype, cansancio vespertino, quieren sentirse "en control" sin cambios drásticos. *(A2)*
- **Nivel de awareness:** Problem-aware — conocen su cansancio/preocupación de salud; no conocen los hongos funcionales como solución.
- **Sofisticación de mercado:** Alta (etapa 4–5 en suplementos) → no funciona gritar claims; funciona identificación + mecanismo + anti-hype.
- **Dolor principal:** El bajón de energía de las 3 PM que el café ya no arregla.
- **Dolores secundarios:** Sentirse "mayor" antes de tiempo; niebla mental; la incomodidad silenciosa con la propia salud (nunca verbalizada como condición médica).
- **Deseo central:** Volver a sentirse uno mismo; hacer *algo* proactivo por su salud que sea simple.
- **Trigger emocional:** Alivio + orgullo silencioso ("finalmente fui honesto conmigo y actué").
- **Barrera de confianza:** "Los hongos son snake oil" / fatiga de suplementos milagro.
- **Mejor ángulo UGC:** Par creíble de 50s, recomendación casual anti-vendedor.
- **Arquetipo de creador:** "Mark" — hombre ~55, regular guy, energía de invitado de podcast, cero actor.
- **Estrategia de click a landing:** Curiosidad específica ("functional mushrooms — not the magic kind") + CTA suave "link below if you're curious". Cero urgencia falsa.
- **Riesgos de compliance:** claims de colesterol/corazón, before/after, lenguaje de diagnóstico, atributos personales en 2ª persona. Ver §10.
- **Claims a evitar:** lowers/reduces cholesterol, treats, doctor said I have…, números de laboratorio, reemplaza medicación.
- **Claims usables:** "part of my morning routine", "I felt steadier", "best thing I've done for my energy", "supports my wellness routine".
- **Mostrar visualmente:** Mark hablando a cámara, cocina con luz de mañana, manos VACÍAS.
- **Agregar en post:** packshot real del producto (overlay), captions, hook text, CTA card, disclaimer "results may vary".

---

## 2. Ángulos creativos

| Ángulo | Hook | Dolor | Driver | Creador | Estilo | Por qué convierte | Riesgo | Dificultad | Plataforma |
|---|---|---|---|---|---|---|---|---|---|
| **1. El invitado del podcast** *(v1 — YA PRODUCIDO)* | "Wait… you eat mushrooms?" | Crash vespertino | Curiosidad + humor | Mark, invitado | Podcast interview | Formato nativo, social proof implícito | Bajo | Media | Meta/TikTok |
| **2. Mi rutina a los 55** ★ RECOMENDADO | "I'm fifty-five, and I finally got honest about my health." | Café que ya no alcanza | Honestidad/identificación | Mark, selfie | Testimonial talking-head | Formato #1 en conversión Meta; vulnerabilidad creíble en 1ª persona, compliance-safe | Bajo | Baja | Meta Reels |
| **3. El marido escéptico** | "My wife bought me mushroom pills. I laughed at her." | Escepticismo | Humor + redención | Mark, casual | Skit/testimonial | El arco escéptico→converso desarma objeciones | Medio | Alta (rango actoral IA) | Meta/TikTok |
| **4. Nadie habla de este hongo** | "Nobody is talking about this mushroom — and it's actually wild." | Curiosidad/FOMO | Mecanismo | Mark (hook) + b-roll | Hook + b-roll VO | El más barato de escalar; retención por corte duro a los 3s | Medio | Media | Meta/TikTok |

**Selección first-pass:** Ángulo 2 (primario, este paquete) → Ángulo 4 como variante de escala si v2 valida.
**Hipótesis creativa única del ad:** *La honestidad de un hombre de 55 sobre su energía convierte mejor que cualquier claim de producto.*

---

## 3. Concepto recomendado

**"Mi rutina a los 55"** — Testimonial selfie 24s (3 clips × 8s ensamblados en post), Mark en su cocina con luz de mañana, hablando a cámara como a un amigo. Producto NUNCA en mano (label accuracy → overlay en post). Voz Gemini TTS como fuente de verdad. Arco: honestidad → descubrimiento → recomendación sin presión.

---

## 4. Spec del creador / avatar

```text
Gender: Hombre
Age range: 53–58
Appearance: = persona "Mark" existente (face lock con su imagen de referencia actual)
Wardrobe: Henley gris oscuro o camisa de franela casual abierta sobre camiseta — NO la ropa del podcast v1 (concepto distinto, lock distinto)
Room / background: Cocina hogareña real, luz natural de mañana, taza de café fuera de foco, madera cálida
Lighting: Luz de ventana lateral suave, sin luz de estudio
Camera style: Selfie frontal a un brazo de distancia, leve shake natural, levemente descentrado
Facial expression: Sincero, medio-sonriente, ceja levemente alzada en el hook
Energy: Calmada, creíble, cero pitch
Voice: Media-grave, ligera textura rasposa, calidez de mediooeste americano
Accent: Americano neutro
Speech speed: ~140 wpm, sin apuro
Emotional range: Honestidad vulnerable → entusiasmo contenido → calidez
Gestures: Micro-gestos de una mano (la otra sostiene el teléfono), palma abierta en el cierre
Credibility cues: Arrugas reales, canas, cocina imperfecta, pausas naturales, autodeprecación suave
Reason this creator fits: La audiencia 45–65 confía en un par que ya pasó por lo mismo, no en un influencer
```

---

## 5. Prompt GPT Image 2.0 (avatar / frame de referencia)

```text
Create a highly realistic UGC-style reference image for an AI ad creator.

Creator:
[FACE REFERENCE: persona "Mark" — preserve the identity, face shape, age (~55), gray-flecked hair,
skin tone, and overall look of the reference person. Do not change ethnicity, age, facial
structure, or gender. Maintain high identity consistency. Do not beautify.]
Man in his mid-50s, warm approachable face, light natural wrinkles, slight half-smile,
relaxed posture holding the camera at arm's length (selfie framing).

Wardrobe:
Dark gray henley shirt, casual, slightly worn-in. No logos, no accessories.

Environment:
Real lived-in home kitchen in the morning: soft natural window light from the side, warm
wood cabinets slightly out of focus, a coffee mug on the counter in the blurry background.
Authentic, slightly imperfect, NOT a staged showroom kitchen.

Camera:
Vertical 9:16 composition, front phone camera look at arm's length, chest-up framing,
slightly off-center, natural lens, authentic social media selfie framing.

Expression:
Sincere and warm, about to share something honest — half-smile, slightly raised eyebrow.

Pose:
Standing, one hand extended holding the phone (implied), other hand relaxed. Hands empty,
no product in hand.

Style:
Realistic, natural, raw UGC reference, not cinematic, not overproduced, not stock photo.

Negative instructions:
No text, no subtitles, no logo, no watermark, no floating words, no UI, no distorted hands,
no extra limbs, no product label hallucination, no unrealistic skin, no over-beautification.
```

**Frame adicional (escena vacía, será @Image2 para continuidad):**

```text
Real lived-in home kitchen interior in the morning, empty (no people): warm wood cabinets,
soft natural window light from the left, coffee mug and french press on the counter, shallow
depth of field, photoreal, vertical 9:16, authentic and slightly imperfect, no text, no logos,
no watermark.
```

---

## 6. Voice bible + prompts Gemini TTS

### Voice bible — "Mark"

```text
Voice name: Mark (usar la voz NOMBRADA ya asignada a la persona en Supabase — voice lock)
Gender: Masculino
Age sound: 55 años — madura, vivida
Accent: Americano neutro con calidez de midwest
Pitch: Medio-grave
Texture: Ligera gravilla, natural, sin pulir
Pacing: ~140 wpm, conversacional, sin apuro
Emotional delivery: Honesto y reflexivo en el hook → entusiasmo contenido en el medio → calidez relajada en el cierre
Pause style: Pausa corta (300–400ms) después de la primera frase de cada clip
Laugh style: Media exhalación-risa autodeprecativa, solo en el clip 3
Breathing style: Respiración audible sutil antes del hook
Conversational realism: Como contándole a un amigo en la cocina, jamás leyendo
Words to emphasize: "honest", "steadier", "myself", "curious"
Pronunciation notes: Cholibrium = "koh-LIB-ree-um"
```

### Prompts TTS (uno por clip)

**Clip 1 — hook/dolor:**
```text
Generate clean spoken audio for a UGC ad.
Voice style: Male, mid-50s, neutral American accent with midwest warmth, medium-low pitch, light gravel.
Delivery: Natural, conversational, sincere, like confiding in a friend — not salesy.
Emotion: Honest, slightly vulnerable, warm.
Pacing: ~140 wpm, short pause (350ms) after the first sentence, not rushed.
Performance notes: Soft audible breath before the first word; emphasis on "honest".
Script: "I'm fifty-five, and I finally got honest about my health. Coffee wasn't fixing my afternoons anymore. Something had to change."
Pronunciation notes: —
Output purpose: Final voice source for Seedance 2.0 video merge and lip-sync (@Audio1, clip 1).
```

**Clip 2 — descubrimiento/lógica:**
```text
Generate clean spoken audio for a UGC ad.
Voice style: [misma voz exacta que clip 1 — voice lock]
Delivery: Natural, conversational, a notch more energy than clip 1 — sharing a discovery, not pitching.
Emotion: Quietly enthusiastic, credible.
Pacing: ~140 wpm, micro-pause before "Two weeks in".
Performance notes: Emphasis on "steadier"; slight smile in the voice.
Script: "A buddy put me onto Cholibrium — functional mushrooms. It's just part of my morning now. Two weeks in? Steadier all day."
Pronunciation notes: Cholibrium = "koh-LIB-ree-um".
Output purpose: Final voice source for Seedance 2.0 (@Audio1, clip 2).
```

**Clip 3 — recomendación/CTA:**
```text
Generate clean spoken audio for a UGC ad.
Voice style: [misma voz exacta — voice lock]
Delivery: Relaxed, warm, zero pressure — closing a chat with a friend.
Emotion: Warm, self-aware, honest.
Pacing: ~135 wpm, pause (400ms) after "magic", soft half-laugh exhale after "myself".
Performance notes: Emphasis on "curious"; no salesman energy whatsoever.
Script: "I'm not saying it's magic. I'm saying I feel more like myself again. Link's below if you're curious — that's all."
Pronunciation notes: —
Output purpose: Final voice source for Seedance 2.0 (@Audio1, clip 3).
```

---

## 7. Guion shot-by-shot

| | Shot 1 — Hook | Shot 2 — Descubrimiento | Shot 3 — Cierre/CTA |
|---|---|---|---|
| **Duración** | 8s | 8s | 8s |
| **Objetivo** | Parar el scroll con honestidad inesperada | Introducir el producto como lógica natural | Recomendación sin presión + click |
| **Emoción** | Vulnerabilidad sincera | Entusiasmo contenido | Calidez autoconsciente |
| **Diálogo** | "I'm fifty-five, and I finally got honest about my health. Coffee wasn't fixing my afternoons anymore. Something had to change." | "A buddy put me onto Cholibrium — functional mushrooms. It's just part of my morning now. Two weeks in? Steadier all day." | "I'm not saying it's magic. I'm saying I feel more like myself again. Link's below if you're curious — that's all." |
| **Acción visual** | Mark a cámara, leve inclinación hacia el lente en "honest" | Mira brevemente fuera de cámara al recordar, vuelve al lente; asiente en "steadier" | Palma abierta relajada, media risa, mirada sostenida al lente |
| **Framing** | Selfie chest-up, descentrado | Idéntico (continuity lock) | Idéntico |
| **Manos** | Vacías; micro-gesto con mano libre | Vacías | Vacías; palma abierta al cierre |
| **Producto** | No aparece | **Overlay packshot en post (2.5s–6.5s)** | CTA card en post (últimos 2s) |
| **Fondo** | Cocina @Image2 | Idéntico | Idéntico |
| **Audio** | @Audio1 clip 1 | @Audio1 clip 2 | @Audio1 clip 3 |
| **Transición** | Corte duro | Corte duro | Fin + end card |
| **Riesgos** | Lip-sync del arranque; expresión sobreactuada | Pronunciación "Cholibrium"; mirada fuera de cámara puede romper conexión | Risa puede salir falsa; manos deformes en palma abierta |

---

## 8. Prompts Seedance 2.0 (por shot)

**Consistency lock (referenciado en los 3 prompts):**
```text
Face lock: @Image1 = referencia persona Mark (sin cambios de identidad)
Voice lock: @Audio1 Gemini TTS voz nombrada de Mark (fuente de verdad, lip-sync exacto)
Outfit lock: henley gris oscuro, idéntico en los 3 clips
Background lock: @Image2 cocina mañana, mismos objetos/profundidad
Lighting lock: luz de ventana lateral suave, idéntica
Camera lock: selfie 9:16 chest-up a un brazo, shake sutil idéntico
Product lock: producto JAMÁS generado en mano ni en frame — solo overlay real en post
Emotion arc: honestidad → entusiasmo contenido → calidez
Gesture rules: una mano siempre "sosteniendo el teléfono", manos VACÍAS, micro-gestos
Audio pacing rules: el video respeta las pausas del TTS, sin cortar aire
Shot continuity notes: mismo asiento de cámara, misma hora del día, mismo lente
```

**Shot 1:**
```text
TEMPLATE: UGC testimonial talking-head, selfie style.

INPUTS:
@Image1 = Mark avatar reference (kitchen selfie frame)
@Image2 = empty kitchen scene reference (continuity)
@Audio1 = Gemini TTS clip 1

ACTION: Mark holds the phone at arm's length and talks directly into the lens, sincere and
slightly vulnerable. On the word "honest" he leans in a touch closer. Natural micro-gestures
with his free hand, small head movements, authentic pauses matching the audio. His hands stay
EMPTY the whole clip: no bottle, no product, no props.

AUDIO: Use provided Gemini TTS audio (@Audio1) as the source of truth. Match mouth movement
and facial performance precisely to the audio from first frame to last. Do not invent a
different voice.

CAMERA: Vertical 9:16. Handheld front-camera selfie at arm's length, chest-up, slightly
off-center, subtle natural shake. Looks self-filmed on a phone, not a studio production.

PRODUCT HANDLING: Not shown. Product will be added as a real packshot overlay in post-production.

BACKGROUND: Matching the kitchen shown in @Image2 — warm wood cabinets, soft morning window
light from the left, coffee mug out of focus. Exact continuity.

NEGATIVE INSTRUCTIONS: No captions, no subtitles, no lower thirds, no floating text, no
watermark, no UI, no extra limbs, no distorted hands, no product label hallucination, no text
on clothing/walls, no overacting, no fake commercial energy.

OUTPUT: 9:16 vertical video. Duration: 8 seconds. Realistic UGC footage for paid social.
Clean output for post-production.
```

**Shot 2:**
```text
TEMPLATE: UGC testimonial talking-head, selfie style — continuity with previous clip.

INPUTS:
@Image1 = Mark avatar reference (same as shot 1)
@Image2 = empty kitchen scene reference (same)
@Audio1 = Gemini TTS clip 2

ACTION: Same wardrobe, framing and energy as the previous clip. Mark glances briefly
off-camera as if recalling the moment ("a buddy put me onto…"), then returns his eyes to the
lens. He gives a small confident nod on the word "steadier". Free-hand micro-gestures, hands
EMPTY: no bottle, no product, no props.

AUDIO: Use provided Gemini TTS audio (@Audio1) as the source of truth. Lip-sync precisely.
Do not invent a different voice.

CAMERA: Vertical 9:16. Identical handheld selfie framing as previous clip — chest-up,
slightly off-center, subtle shake. Same lens feel.

PRODUCT HANDLING: Not shown in generation. Real product packshot will be overlaid in
post-production from second 2.5 to 6.5 of this clip.

BACKGROUND: Same kitchen as @Image2, same lighting, same depth of field. Exact continuity.

NEGATIVE INSTRUCTIONS: No captions, no subtitles, no lower thirds, no floating text, no
watermark, no UI, no extra limbs, no distorted hands, no product label hallucination, no text
on clothing/walls, no overacting, no fake commercial energy.

OUTPUT: 9:16 vertical video. Duration: 8 seconds. Realistic UGC footage for paid social.
Clean output for post-production.
```

**Shot 3:**
```text
TEMPLATE: UGC testimonial talking-head, selfie style — closing clip, continuity locked.

INPUTS:
@Image1 = Mark avatar reference (same)
@Image2 = empty kitchen scene reference (same)
@Audio1 = Gemini TTS clip 3

ACTION: Same wardrobe, framing and seat as previous clips. Mark delivers his closing line
relaxed and warm: a soft self-aware half-laugh after "myself", then an open relaxed palm
gesture with his free hand on "that's all", holding eye contact with the lens to the end.
Zero salesman energy. Hands EMPTY: no bottle, no product.

AUDIO: Use provided Gemini TTS audio (@Audio1) as the source of truth. Lip-sync precisely,
including the soft laugh. Do not invent a different voice.

CAMERA: Vertical 9:16. Identical handheld selfie framing — chest-up, slightly off-center,
subtle shake.

PRODUCT HANDLING: Not shown. CTA end card and packshot added in post-production over the
final 2 seconds.

BACKGROUND: Same kitchen as @Image2. Exact continuity with previous clips.

NEGATIVE INSTRUCTIONS: No captions, no subtitles, no lower thirds, no floating text, no
watermark, no UI, no extra limbs, no distorted hands, no product label hallucination, no text
on clothing/walls, no overacting, no fake commercial energy.

OUTPUT: 9:16 vertical video. Duration: 8 seconds. Realistic UGC footage for paid social.
Clean output for post-production.
```

---

## 9. Plan de overlay / postproducción

```text
Editing tool: CapCut (o Premiere)
Subtitle text: Transcripción exacta de los 3 guiones, frase por frase
Subtitle style: Sans bold blanca con stroke negro fino, 3-4 palabras por línea, centrado bajo (zona segura)
Hook text: "55 and finally honest about my health" — frames 0:00–0:03, top-center
On-screen text timing: hook 0–3s; "functional mushrooms ≠ magic mushrooms" 9–12s (refuerzo en mute)
Product overlay timing: packshot real PNG 16.5s–22.5s (clip 2: 2.5s–6.5s relativos), entrada con scale-up suave 95→100%
Packshot placement: centro-derecha, 30% del ancho, sin tapar la cara ni los subtítulos
CTA visual: end card últimos 2s — packshot + "Link below ↓" + disclaimer pequeño "Results may vary."
Music direction: acústica cálida lo-fi, -18 dB bajo la voz, fade-in 1s, sin drops
Sound effects: whoosh sutil en los 2 cortes duros; pop suave en la entrada del packshot
Zoom/cut pacing: punch-in digital 103% en el inicio del clip 2 (reset de atención); cortes duros entre clips
Safe zones: 220px superiores e inferiores libres (UI de Reels); subtítulos dentro de zona segura
Export format: 1080×1920, H.264, 30fps, ~12 Mbps, AAC 48kHz
Filename convention: ORB_CHOL_TESTIMONIAL_MARK_V2_[SHOT#|FINAL]_[FECHA].mp4
Meta/TikTok upload notes: subir como 9:16 Reels placement; primary text corto; sin claims de salud en el copy del ad; categoría especial NO aplica pero revisar política de suplementos
```

---

## 10. Revisión de compliance

**Chequeos del guion v2 (los 3 clips): ✅ APROBADO con notas**

| Chequeo | Resultado |
|---|---|
| Claims médicos (colesterol/corazón) | ✅ Ausentes — el guion nunca menciona colesterol, corazón ni condiciones |
| Claims financieros | ✅ N/A |
| Before/after | ✅ Sin números, sin labs, sin fotos comparativas |
| Atributos personales (2ª persona) | ✅ Todo en 1ª persona ("I finally got honest…") — patrón seguro Meta |
| Promesas irreales | ✅ "I'm not saying it's magic" desactiva la promesa explícitamente |
| Testimonios falsos | ⚠️ Es un creador AI: NO etiquetar como "cliente verificado"; tratar como creative dramatization. Añadir disclaimer si la cuenta del anunciante lo requiere |
| Lenguaje de diagnóstico | ✅ Ausente |
| Producto restringido | ✅ Suplemento permitido en Meta con lenguaje correcto |
| Wording sensible para plataforma | ✅ "steadier", "part of my morning", "feel more like myself" — todo en lista segura |

**Líneas riesgosas detectadas en ideas previas y sus rewrites seguros:**
- ❌ "My last checkup? Let's just say I wasn't thrilled." → implica condición médica → ✅ "I finally got honest about my health."
- ❌ "It lowered my numbers." → claim médico → ✅ "Two weeks in? Steadier all day."
- ❌ "Do you crash every afternoon?" → 2ª persona/atributo → ✅ "Coffee wasn't fixing my afternoons anymore."

**Regla dura para esta campaña:** ni el video, ni los subtítulos, ni el primary text del ad mencionan colesterol, corazón, presión, ni ninguna condición. El nombre del producto hace ese trabajo solo en la landing.

---

## 11. Plan de render

```text
What will be rendered:
  (a) 1 frame de avatar Mark-en-cocina + 1 frame de escena vacía (GPT Image 2.0)
  (b) 3 audios TTS (Gemini, voz nombrada de Mark)
  (c) 3 clips Seedance 2.0 de 8s (testimonial, shots 1-3)
Tool/model:
  (a) GPT Image 2.0  (b) Gemini TTS gemini-2.5-flash-preview-tts  (c) bytedance/seedance-2.0/reference-to-video (standard, 720p)
Why this tool/model: pipeline por fortalezas — identidad visual en imagen, voz como fuente de verdad en TTS, performance/lip-sync en Seedance. Standard (no fast) porque la cara en selfie chest-up es el 100% del frame.
Input assets: @Image1 avatar Mark (nuevo frame cocina), @Image2 escena cocina vacía, @Audio1 TTS por clip
Expected output: 3 clips 9:16 de 8s con face/voice/outfit/fondo consistentes, listos para ensamblar en post
Likely failure points: lip-sync del arranque (clip 1), pronunciación "Cholibrium" (clip 2 — validar en el TTS ANTES de Seedance), risa falsa o manos deformes (clip 3)
Max generations: 3 clips + 1 retry máximo del gate = 4
Estimated cost: imágenes ≈ interno/despreciable · TTS ≈ despreciable · Seedance standard 720p 8s = $2.42/clip → 3 clips ≈ $7.26 · peor caso con 1 retry ≈ $9.68 (dentro del cap A4 de $10)
  (alternativa fast: $1.94/clip → $5.81 los 3 — no recomendada: pierde realismo facial en el formato selfie)
Approval needed: YES — NO SE LANZA NADA SIN APROBACIÓN EXPLÍCITA
```

**Estrategia de gate (igual que v1):** TTS de los 3 clips primero (gratis, validar pronunciación y pausas) → Seedance clip 1 como gate → si QA del clip 1 pasa (≥7 en face/lip-sync/realismo), clips 2 y 3 en paralelo.

---

## 12. QA scorecard (a completar tras cada asset)

```text
Hook strength:            /10
Visual realism:           /10
Creator believability:    /10
Face consistency:         /10
Voice consistency:        /10
Lip sync:                 /10
Emotional delivery:       /10
Hand realism:             /10
Product accuracy:         /10  (N/A en clips — aplica al overlay en post)
Label accuracy:           /10  (N/A — label solo vía packshot real)
Script clarity:           /10
Pacing:                   /10
Scroll-stopping power:    /10
Landing-page intent:      /10
Compliance safety:        /10
Overall conversion potential: /10

Decision: Keep / Edit in post / Regenerate / Change concept
Reason:
Exact issue:
Prompt patch:  (parchear SOLO la sección que falló, no reescribir todo)
Next action:
```

**Umbrales:** gate (clip 1) necesita ≥7 en face consistency, lip sync y visual realism para desbloquear clips 2–3. Cualquier mano deforme = regenerar, no "edit in post".

---

## 13. Checklist ready-to-render

```text
[x] Product and offer are understood            (A1 — confirmar landing URL)
[x] Audience and country/language are defined    (A2 — supuesto marcado)
[x] Platform is defined                          (A3 — Meta Ads)
[x] Main pain point is clear                     (crash vespertino / honestidad sobre la salud)
[x] Main benefit is clear                        (energía estable, sentirse uno mismo)
[x] Compliance risks are checked                 (§10 — aprobado con regla dura)
[x] Creator/avatar spec is complete              (§4)
[x] GPT Image 2.0 prompt is ready                (§5)
[x] Gemini TTS prompt is ready                   (§6 — 3 prompts + voice bible)
[x] Seedance 2.0 prompts are ready               (§8 — 3 shots + consistency lock)
[x] Product handling plan is safe                (producto solo vía overlay real en post)
[x] Voice consistency plan is defined            (voz nombrada de Mark, TTS = fuente de verdad)
[x] Face consistency plan is defined             (@Image1 persona Mark + identity-preserve)
[x] Post-production plan is defined              (§9)
[x] Render budget is respected                   (≈$7.26, cap $10, peor caso $9.68)
[ ] Approval required before paid render         ← PENDIENTE — esperando tu OK
```

**Inputs que faltan de tu lado antes de lanzar:**
1. Confirmar landing page URL (A5)
2. Packshot real del producto en PNG para el overlay (A6)
3. Aprobación del render plan (§11)
