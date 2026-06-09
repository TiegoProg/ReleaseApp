// Lista las campañas guardadas en Supabase, vía Management API (PAT).
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

const query = `
select c.id, left(c.goal, 70) as goal, c.status, c.created_at,
  (select count(*) from agents a where a.campaign_id=c.id) as agents,
  (select count(*) from deliverables d where d.campaign_id=c.id) as deliverables
from campaigns c order by c.created_at desc limit 50;`;

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query }),
});
const rows = await res.json();
if (!res.ok) {
  console.error("ERROR:", JSON.stringify(rows));
  process.exit(1);
}
console.log(`Campañas guardadas en Supabase: ${rows.length}`);
for (const r of rows) {
  console.log(`  • ${r.created_at} [${r.status}] agents=${r.agents} deliverables=${r.deliverables}`);
  console.log(`    goal: ${r.goal}`);
}
