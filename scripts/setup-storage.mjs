// Crea el bucket público de Storage para las imágenes generadas.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

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
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const BUCKET = "orbita-images";
const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

const { data: list, error: listErr } = await sb.storage.listBuckets();
if (listErr) {
  console.error("error listando buckets:", listErr.message);
  process.exit(1);
}
if (list?.find((b) => b.name === BUCKET)) {
  console.log(`bucket "${BUCKET}" ya existe ✓`);
} else {
  const { error } = await sb.storage.createBucket(BUCKET, { public: true });
  if (error) {
    console.error("error creando bucket:", error.message);
    process.exit(1);
  }
  console.log(`bucket "${BUCKET}" creado (público) ✓`);
}
