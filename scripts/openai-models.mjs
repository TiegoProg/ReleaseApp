// Lista los modelos de OpenAI relacionados a imágenes, usando OPENAI_API_KEY de .env.local.
import fs from "node:fs";

function parseEnv(txt) {
  const m = {};
  for (const raw of txt.split(/\r?\n/)) {
    const t = raw.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    m[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return m;
}

const env = parseEnv(fs.readFileSync(".env.local", "utf8"));
const key = env.OPENAI_API_KEY;
if (!key) {
  console.error("No hay OPENAI_API_KEY en .env.local");
  process.exit(1);
}

const res = await fetch("https://api.openai.com/v1/models", {
  headers: { Authorization: `Bearer ${key}` },
});
const json = await res.json();
if (!res.ok) {
  console.error("ERROR:", JSON.stringify(json));
  process.exit(1);
}
const all = (json.data || []).map((m) => m.id);
const img = all
  .filter((id) => /image|dall/i.test(id))
  .sort();
console.log("Modelos de imagen disponibles:");
for (const id of img) console.log("  -", id);
console.log(`\n(total modelos en la cuenta: ${all.length})`);
