// Prueba real de generación de imagen con el modelo configurado (OPENAI_IMAGE_MODEL).
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
const model = env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const size = process.argv[2] || "1024x1024";

console.log(`Generando con model=${model} size=${size}…`);
const res = await fetch("https://api.openai.com/v1/images/generations", {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model,
    prompt:
      "Minimalist product ad of a reusable water bottle on a clean studio background, soft lighting, high quality",
    size,
    n: 1,
  }),
});
const json = await res.json();
if (!res.ok) {
  console.error("ERROR", res.status, ":", JSON.stringify(json).slice(0, 600));
  process.exit(1);
}
const b64 = json.data?.[0]?.b64_json;
const url = json.data?.[0]?.url;
console.log("OK ✓  b64_len:", b64 ? b64.length : 0, " url:", url || "(devuelve b64)");
