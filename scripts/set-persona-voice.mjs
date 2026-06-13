// Fija el voice lock de ElevenLabs de una persona en el índice persistente de
// Supabase Storage (personas/index.json). Así la voz pineada sobrevive reinicios
// y NO depende de un default global.
//   node scripts/set-persona-voice.mjs <personaId> <elevenVoiceId>
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "orbita-images";
const INDEX_PATH = "personas/index.json";

function parseEnv(txt) {
  const map = {};
  for (const raw of txt.split(/\r?\n/)) {
    const t = raw.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    // corta comentarios inline (  # ...)
    let v = t.slice(i + 1).trim();
    const c = v.indexOf(" #");
    if (c >= 0) v = v.slice(0, c).trim();
    map[t.slice(0, i).trim()] = v;
  }
  return map;
}

const [, , personaId, voiceId] = process.argv;
if (!personaId || !voiceId) {
  console.error("Uso: node scripts/set-persona-voice.mjs <personaId> <elevenVoiceId>");
  process.exit(1);
}

const env = parseEnv(fs.readFileSync(".env.local", "utf8"));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await sb.storage.from(BUCKET).download(INDEX_PATH);
if (error || !data) {
  console.error("No pude leer personas/index.json:", error?.message ?? "vacío");
  process.exit(1);
}
const list = JSON.parse(await data.text());
const p = list.find((x) => x.id === personaId);
if (!p) {
  console.error(`Persona ${personaId} no está en el índice. IDs:`, list.map((x) => `${x.name}=${x.id}`).join(" | "));
  process.exit(1);
}

const prev = p.elevenVoiceId ?? "(ninguno)";
p.elevenVoiceId = voiceId;

const buf = Buffer.from(JSON.stringify(list), "utf8");
const up = await sb.storage
  .from(BUCKET)
  .upload(INDEX_PATH, buf, { contentType: "application/json", upsert: true });
if (up.error) {
  console.error("Falló el upload del índice:", up.error.message);
  process.exit(1);
}

console.log(`✅ Voice lock actualizado para "${p.name}" (${p.id})`);
console.log(`   elevenVoiceId: ${prev} → ${voiceId}`);
