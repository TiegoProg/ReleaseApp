// Provisiona Supabase usando el Personal Access Token (sbp_) vía Management API:
//  1) descubre el proyecto, 2) obtiene URL + keys, 3) aplica supabase/schema.sql,
//  4) escribe los valores reales en .env.local (sin imprimir secretos).
import fs from "node:fs";

const ENV = ".env.local";
const API = "https://api.supabase.com";

function parseEnv(txt) {
  const map = {};
  for (const raw of txt.split(/\r?\n/)) {
    const t = raw.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    map[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return map;
}

function mask(v) {
  if (!v) return "(vacío)";
  return `${v.slice(0, 6)}…(len=${v.length})`;
}

async function mgmt(token, path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new Error(`${path} -> ${res.status}: ${typeof json === "string" ? json : JSON.stringify(json)}`);
  }
  return json;
}

function upsertEnv(envText, updates) {
  let lines = envText.split(/\r?\n/);
  const done = new Set();
  lines = lines.map((line) => {
    const t = line.trim();
    if (!t || t.startsWith("#")) return line;
    const i = t.indexOf("=");
    if (i < 0) return line;
    const key = t.slice(0, i).trim();
    if (key in updates) {
      done.add(key);
      return `${key}=${updates[key]}`;
    }
    return line;
  });
  for (const [k, v] of Object.entries(updates)) {
    if (!done.has(k)) lines.push(`${k}=${v}`);
  }
  return lines.join("\n");
}

async function main() {
  const envText = fs.readFileSync(ENV, "utf8");
  const env = parseEnv(envText);
  const token = env.SUPABASE_ACCESS_TOKEN;
  if (!token || !token.startsWith("sbp_")) {
    console.error("No encontré SUPABASE_ACCESS_TOKEN (sbp_...) en .env.local");
    process.exit(1);
  }

  console.log("→ Listando proyectos…");
  const projects = await mgmt(token, "/v1/projects");
  if (!Array.isArray(projects) || projects.length === 0) {
    console.error("El token no tiene proyectos. Crea un proyecto en supabase.com primero.");
    process.exit(1);
  }
  console.log(
    "Proyectos:",
    projects.map((p) => `${p.name} [${p.id}] (${p.region}, ${p.status})`).join(" | ")
  );

  // elige ACTIVE_HEALTHY si hay; si no, el primero
  const project =
    projects.find((p) => p.status === "ACTIVE_HEALTHY") || projects[0];
  const ref = project.id || project.ref;
  console.log(`→ Usando proyecto: ${project.name} [${ref}] estado=${project.status}`);

  const url = `https://${ref}.supabase.co`;

  console.log("→ Obteniendo API keys…");
  let anon = "";
  let service = "";
  try {
    const keys = await mgmt(token, `/v1/projects/${ref}/api-keys?reveal=true`);
    if (Array.isArray(keys)) {
      for (const k of keys) {
        if (k.name === "anon") anon = k.api_key;
        if (k.name === "service_role") service = k.api_key;
      }
    }
  } catch (e) {
    console.warn("No pude leer api-keys vía Management API:", e.message);
  }

  console.log("→ Aplicando schema (supabase/schema.sql)…");
  const sql = fs.readFileSync("supabase/schema.sql", "utf8");
  await mgmt(token, `/v1/projects/${ref}/database/query`, {
    method: "POST",
    body: JSON.stringify({ query: sql }),
  });
  console.log("  schema aplicado ✓");

  console.log("→ Verificando tablas…");
  const tables = await mgmt(token, `/v1/projects/${ref}/database/query`, {
    method: "POST",
    body: JSON.stringify({
      query:
        "select table_name from information_schema.tables where table_schema='public' order by table_name;",
    }),
  });
  console.log("  tablas public:", JSON.stringify(tables));

  // actualizar .env.local con valores reales
  const updates = { NEXT_PUBLIC_SUPABASE_URL: url };
  if (anon) updates.NEXT_PUBLIC_SUPABASE_ANON_KEY = anon;
  if (service) updates.SUPABASE_SERVICE_ROLE_KEY = service;
  const newEnv = upsertEnv(envText, updates);
  fs.writeFileSync(ENV, newEnv, "utf8");
  console.log("→ .env.local actualizado (enmascarado):");
  console.log("  NEXT_PUBLIC_SUPABASE_URL =", url);
  console.log("  NEXT_PUBLIC_SUPABASE_ANON_KEY =", mask(anon));
  console.log("  SUPABASE_SERVICE_ROLE_KEY =", mask(service));
  console.log("\nLISTO. Reinicia el dev server para que tome las nuevas variables.");
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
