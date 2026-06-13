// Produce la secuencia completa del ad de Cholibrium (estilo podcast, 3 clips
// de 8s, Seedance PRO) contra el dev server local. Clip 1 actúa de "gate": si
// renderiza OK, los clips 2 y 3 se encolan en paralelo. Todo queda guardado en
// el proyecto de Mark. Uso: node scripts/produce-podcast-ad.mjs
const BASE = "http://localhost:3000";
const PERSONA_ID = "b43726b6-1c90-485e-83fa-652276458198"; // Mark
const MODEL = "bytedance/seedance-2.0/reference-to-video"; // standard (no existe "pro" en fal)

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// --- escena podcast compartida (@Image2 en los 3 clips → continuidad) -------
async function makeScene() {
  const res = await fetch(`${BASE}/api/scene`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt:
        "Cozy podcast studio interior, empty (no people): two comfortable chairs facing each other at a slight angle, professional podcast microphone on a boom arm, warm practical lamps, dark acoustic foam panels and wood accents in the background, soft moody warm lighting, shallow depth of field, photoreal, shot on a cinema camera",
      aspect: "9:16",
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.url) {
    log("⚠️ escena falló:", data.error ?? res.status, "→ sigo sin @Image2");
    return null;
  }
  log("✅ escena podcast lista:", data.url);
  return data.url;
}

// --- los 3 clips de la secuencia ---------------------------------------------
function clips(sceneUrl) {
  const setRef = sceneUrl
    ? "matching the podcast set shown in @Image2 (same chairs, microphone on boom arm, warm lamps, acoustic panels — exact continuity)"
    : "a cozy podcast studio: comfortable chair, professional microphone on a boom arm, warm practical lamps, dark acoustic panels behind";

  return [
    {
      name: "Clip 1 · hook (¿comes hongos?)",
      prompt:
        `Podcast interview, vertical 9:16. @Image1 is Mark, a guest sitting in ${setRef}. Frame Mark chest-up, slightly off-center, subtle documentary handheld feel. ` +
        `Opening beat: an OFF-CAMERA female interviewer — warm, playful — asks "Wait… you eat mushrooms?" and laughs softly. Only her voice is heard from off-screen; she is NEVER visible. ` +
        `Mark grins at the question, gives a small knowing nod, then answers — lip-sync Mark's spoken reply precisely to @Audio1. Natural podcast-guest gestures, relaxed credible energy. ` +
        `His hands stay EMPTY the whole clip: no bottle, no product, no props in his hands.`,
      script:
        "Yeah — not the magic kind. Functional mushrooms. Honestly, best thing I've done for my energy in years.",
    },
    {
      name: "Clip 2 · historia/beneficio",
      prompt:
        `Podcast interview, vertical 9:16, ${setRef}. @Image1 is Mark, chest-up framing, subtle handheld, same wardrobe and seat as the previous clip. ` +
        `Mid-conversation: Mark leans in slightly toward the unseen off-camera interviewer and tells his story with easy natural hand gestures — lip-sync precisely to @Audio1. ` +
        `Conversational, credible, no hard-sell. His hands stay EMPTY: no bottle, no product.`,
      script:
        "I used to crash every single afternoon. Two weeks on Cholibrium and that three PM fog? Gone. Steady energy all day.",
    },
    {
      name: "Clip 3 · cierre/CTA",
      prompt:
        `Podcast interview, vertical 9:16, ${setRef}. @Image1 is Mark, chest-up, subtle handheld, continuity with the previous clips. ` +
        `Closing beat: Mark glances at the unseen interviewer, then turns slightly toward the camera for his final line — half-smile, open relaxed palms — lip-sync precisely to @Audio1. ` +
        `Warm, honest, zero salesman energy. Hands EMPTY: no bottle, no product.`,
      script:
        "Look — I was skeptical too. Give it two weeks, link's below. Worst case? You prove an old guy wrong.",
    },
  ];
}

// --- pipeline por clip: encolar → poll → save --------------------------------
async function startClip(clip, sceneUrl) {
  const res = await fetch(`${BASE}/api/ugc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      personaId: PERSONA_ID,
      prompt: clip.prompt,
      script: clip.script,
      speak: true,
      references: sceneUrl ? [{ kind: "image", url: sceneUrl }] : [],
      model: MODEL,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  if (data.job.status === "failed") throw new Error(data.job.error ?? "falló al encolar");
  log(`▶ ${clip.name} encolado (requestId: ${data.job.requestId}, voz: ${data.voiceMode}, costo ≈ $${data.job.costUsd})`);
  return { job: data.job, script: data.script };
}

async function waitReady(requestId, name) {
  const deadline = Date.now() + 20 * 60_000;
  let polls = 0;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 12_000));
    // Errores de RED se reintentan; un status "failed" del job ABORTA de inmediato.
    let d = null;
    try {
      const res = await fetch(`${BASE}/api/ugc/status?requestId=${encodeURIComponent(requestId)}`);
      d = await res.json();
    } catch {
      log(`  … ${name}: error de red en el poll, reintento`);
      continue;
    }
    if (d?.job?.status === "ready") return d.job.videoUrl;
    if (d?.job?.status === "failed") throw new Error(d.job.error ?? "render falló");
    polls++;
    if (polls % 5 === 0) log(`  … ${name}: renderizando (${polls} polls)`);
  }
  throw new Error("timeout (20 min)");
}

async function save(url, script, cost, mode) {
  const res = await fetch(`${BASE}/api/ugc/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ personaId: PERSONA_ID, videoUrl: url, script, preset: "podcast", cost, model: mode }),
  });
  if (!res.ok) log("  ⚠️ no se pudo guardar en el proyecto (el video existe igual)");
}

async function runClip(clip, sceneUrl) {
  const { job, script } = await startClip(clip, sceneUrl);
  let url = job.videoUrl;
  if (job.status === "rendering") url = await waitReady(job.requestId, clip.name);
  await save(url, `${clip.name}: ${script}`, job.costUsd, job.mode);
  log(`✅ ${clip.name} LISTO → ${url}`);
  return { name: clip.name, url, cost: job.costUsd };
}

// --- main ---------------------------------------------------------------------
const results = [];
try {
  // Escena podcast ya generada en el intento anterior (set validado visualmente).
  const SCENE_REUSE =
    "https://ujrgjakvvneusypmjoym.supabase.co/storage/v1/object/public/orbita-images/uploads/scene/4e8bfb46-ac1e-4deb-95d8-1063006fc395.png";
  const scene = SCENE_REUSE || (await makeScene());
  const [c1, c2, c3] = clips(scene);

  // Gate: clip 1 primero — si fal falla (saldo/prompt), no quemamos los otros dos.
  results.push(await runClip(c1, scene));

  // Clips 2 y 3 en paralelo.
  const rest = await Promise.allSettled([runClip(c2, scene), runClip(c3, scene)]);
  for (const r of rest) {
    if (r.status === "fulfilled") results.push(r.value);
    else results.push({ name: "clip", url: null, error: String(r.reason?.message ?? r.reason) });
  }
} catch (e) {
  console.error("❌ ABORTADO:", e.message);
}

console.log("\n========== RESULTADO ==========");
for (const r of results) {
  if (r.url) console.log(`✅ ${r.name}\n   ${r.url}\n   ≈ $${r.cost}`);
  else console.log(`❌ ${r.name}: ${r.error}`);
}
const spent = results.reduce((s, r) => s + (r.cost ?? 0), 0);
console.log(`Total: ${results.filter((r) => r.url).length}/3 clips · ≈ $${spent.toFixed(2)}`);
