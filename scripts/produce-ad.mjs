// ============================================================================
// Driver genérico de producciones UGC — reemplaza los scripts hardcodeados de
// un solo uso. Lee una campaña JSON y la corre contra /api/ugc/produce.
//
// Uso:
//   node scripts/produce-ad.mjs campaigns/cholibrium/testimonial-v2.json
//       → DRY-RUN: imprime el render plan (costo, shots, modelo). No gasta.
//   node scripts/produce-ad.mjs campaigns/cholibrium/testimonial-v2.json --approve
//       → Produce de verdad: voz → gate → resto en paralelo, y pollea hasta el final.
//
// Formato de la campaña JSON = body de POST /api/ugc/produce (sin "approve"):
//   { personaId, title, shots:[{name,prompt,script}], scenePrompt|sceneUrl,
//     extraImageUrls, lock:{outfit,background,lighting,camera,emotionArc,...},
//     model, gate, budgetUsd }
// ============================================================================

import { readFileSync } from "node:fs";

const BASE = process.env.ORBITA_BASE || "http://localhost:3000";

const file = process.argv[2];
const approve = process.argv.includes("--approve");
if (!file) {
  console.error("Uso: node scripts/produce-ad.mjs <campaña.json> [--approve]");
  process.exit(1);
}

const campaign = JSON.parse(readFileSync(file, "utf8"));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function api(path, init) {
  const res = await fetch(`${BASE}${path}`, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status} en ${path}`);
  return data;
}

function printPlan(plan) {
  console.log("\n========== RENDER PLAN ==========");
  console.log(`Campaña:     ${plan.title}`);
  console.log(`Persona:     ${plan.persona}`);
  console.log(`Modelo:      ${plan.model}`);
  console.log(`Shots:       ${plan.shots.length} (gate: ${plan.gate ? "sí — shot 1 primero" : "no — todos en paralelo"})`);
  for (const [i, s] of plan.shots.entries()) console.log(`  ${i + 1}. ${s.name} — "${s.script}"`);
  console.log(`Escena:      ${plan.willGenerateScene ? "se genera 1 frame compartido (@Image2)" : "reutiliza sceneUrl / sin escena"}`);
  console.log(`Costo/clip:  ≈ $${plan.perClipUsd}`);
  console.log(`Estimado:    ≈ $${plan.estimatedCostUsd}  (cap $${plan.budgetUsd} → ${plan.withinBudget ? "OK" : "EXCEDIDO"})`);
  console.log("=================================\n");
}

function printShots(production) {
  for (const s of production.shots) {
    const mark =
      s.status === "ready" ? "✅" : s.status === "failed" ? "❌" : s.status === "skipped" ? "⛔" : "…";
    console.log(`  ${mark} ${s.name} [${s.status}]${s.videoUrl ? `\n     ${s.videoUrl}` : ""}${s.error ? `\n     ${s.error}` : ""}`);
  }
}

// 1) Dry-run SIEMPRE primero: el plan se muestra antes de gastar.
const dry = await api("/api/ugc/produce", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ...campaign, approve: false }),
});
printPlan(dry.plan);

if (!approve) {
  console.log("Dry-run: nada se renderizó. Corre de nuevo con --approve para producir.");
  process.exit(0);
}

// 2) Producción real (aprobada explícitamente).
log(`aprobado → produciendo "${campaign.title}"…`);
const created = await api("/api/ugc/produce", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ...campaign, approve: true }),
});
const id = created.production.id;
log(`producción ${id} creada (estado: ${created.production.status})`);

// 3) Poll del pipeline hasta estado terminal (el endpoint avanza el gate solo).
const deadline = Date.now() + 30 * 60_000;
let production = created.production;
let polls = 0;
while (Date.now() < deadline) {
  if (["ready", "partial", "failed"].includes(production.status)) break;
  await new Promise((r) => setTimeout(r, 12_000));
  try {
    ({ production } = await api(`/api/ugc/produce/status?id=${id}`));
  } catch (e) {
    log(`⚠️ poll falló (${e.message}) — reintento`);
    continue;
  }
  polls++;
  if (polls % 5 === 0) {
    log(`estado: ${production.status} · gastado ≈ $${production.spentUsd}`);
    printShots(production);
  }
}

console.log("\n========== RESULTADO ==========");
console.log(`Estado final: ${production.status} · gastado ≈ $${production.spentUsd} de $${production.budgetUsd}`);
printShots(production);
console.log("\nBitácora:");
for (const line of production.log) console.log(`  ${line}`);
