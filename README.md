# Orbita — Agencia de marketing agéntica 🪐

Una agencia de marketing operada por agentes de IA, **orquestada por Claude**. Un **Director**
central recibe un objetivo global ("Goal"), lo descompone y delega a 4 áreas
(**Investigación/Estrategia, Creativo, Contenido, Medios/Performance**); cada área puede abrir
**subagentes**. Todo se visualiza como una **red orbital tipo red neuronal** en tiempo real: haz
click en un nodo para entrar, ver al agente actuar en vivo, iterarlo y darle recursos.

> Corre **completa solo con `ANTHROPIC_API_KEY`**. Supabase, OpenAI Image y Kling son opcionales.

## Stack
- **Next.js (App Router) + TypeScript + Tailwind**
- **@anthropic-ai/sdk** — cerebro orquestador (Director `claude-opus-4-8`, áreas `claude-sonnet-4-6`)
- **Supabase** (opcional) — persistencia; si no está, store en memoria
- **d3-force** (canvas) — la red orbital; **zustand**, **framer-motion**, **zod**

## Cómo correr
1. Instala dependencias (ya hecho): `npm install`
2. Crea `.env.local` (copia de `.env.local.example`) con, como mínimo:
   ```
   ANTHROPIC_API_KEY=sk-ant-...tu-key...
   ```
3. `npm run dev` → abre http://localhost:3000
4. Escribe un **Goal** en la barra superior (o pulsa "usar ejemplo") y dale **Lanzar 🚀**.

### Supabase (opcional)

**Opción automática (recomendada):** pon un *Personal Access Token* en `.env.local`
(`SUPABASE_ACCESS_TOKEN=sbp_...`, créalo en supabase.com → Account → Access Tokens) y corre:
```
node scripts/setup-supabase.mjs
```
Descubre tu proyecto, aplica `supabase/schema.sql`, obtiene las API keys y las escribe en
`.env.local`. Luego reinicia `npm run dev`. (Debug: `node scripts/db-counts.mjs <campaignId>`.)

**Opción manual:**
1. Crea un proyecto en supabase.com.
2. **SQL Editor → New query →** pega [`supabase/schema.sql`](supabase/schema.sql) → **RUN**.
3. En **Project Settings → API**, copia a `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
4. Reinicia `npm run dev`. Verás el badge **Supabase: on** y el estado persiste entre reinicios.

### Tools externas (opcional)
- `OPENAI_API_KEY` → `generate_image` usa **OpenAI Images** real; si no, placeholder.
  - Modelo configurable con `OPENAI_IMAGE_MODEL` (ej. `gpt-image-2`, el último). Descubre los ids de
    tu cuenta con `node scripts/openai-models.mjs`.
  - Las imágenes reales se suben a **Supabase Storage** (bucket público `orbita-images`,
    `node scripts/setup-storage.mjs`) y la DB guarda solo la URL pública. Sin Supabase, usa data-URL.
- `KLING_API_KEY` + `KLING_API_URL` → `generate_video` intenta **Kling** real; si no, placeholder.
- `TAVILY_API_KEY` → `web_search` real; si no, resultados simulados.
- **MCP:** registra tools de servidores MCP en [`lib/mcp.ts`](lib/mcp.ts) y quedan disponibles para los agentes.

### Proyectos / historial
Cada campaña se guarda (Supabase o memoria). En la app, **📁 Proyectos guardados** (barra lateral)
lista todas las campañas y permite reabrir cualquiera (se rehidrata + reconecta su feed en vivo).
API: `GET /api/campaigns`. Inspección CLI: `node scripts/list-campaigns.mjs`.

## Arquitectura (mapa rápido)
- `lib/agents/orchestrator.ts` — crea campaña + nodos y corre al Director en background.
- `lib/agents/agentLoop.ts` — loop genérico tool-use (streaming) + emisión de eventos + subagentes.
- `lib/agents/definitions.ts` — system prompts y modelos por agente.
- `lib/tools/*` — tools (registry, board, content, media, image, video, search, subagent).
- `lib/store.ts` — persistencia (Supabase o memoria). `lib/agents/events.ts` — bus de eventos + SSE.
- `app/api/*` — `campaign` (POST lanzar, GET `?id=` rehidratar), `agent/run` (SSE en vivo), `agent/message` (iterar), `health`.
- `components/*` — `OrbitGraph` (canvas), `AgentPanel`, `ActivityStream`, `GoalBar`, `OrbitNode`.

## Límites de la v1
- Profundidad de subagentes = 2; tope de rondas y timeout por agente (evita loops caros).
- El feed en vivo usa **SSE**; el log en memoria permite reconstruir la órbita al recargar mientras
  el server siga vivo. Con Supabase, la rehidratación tras reinicio del server usa el snapshot.
