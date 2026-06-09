// Cuenta filas en Supabase para un campaignId, vía Management API (PAT).
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
const token = env.SUPABASE_ACCESS_TOKEN;
const ref = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace("https://", "").split(".")[0];
const cid = process.argv[2];
if (!cid) {
  console.error("uso: node scripts/db-counts.mjs <campaignId>");
  process.exit(1);
}

const query = `
select 'campaigns' as t, count(*)::int as c from campaigns where id='${cid}'
union all select 'agents', count(*)::int from agents where campaign_id='${cid}'
union all select 'messages', count(*)::int from messages where campaign_id='${cid}'
union all select 'deliverables', count(*)::int from deliverables where campaign_id='${cid}';`;

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query }),
});
const json = await res.json();
if (!res.ok) {
  console.error("ERROR:", JSON.stringify(json));
  process.exit(1);
}
console.log("Conteos en Supabase:", JSON.stringify(json));
