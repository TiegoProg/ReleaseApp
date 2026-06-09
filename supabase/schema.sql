-- Orbita — schema de Supabase
-- Aplica esto en: Supabase Dashboard -> SQL Editor -> New query -> pega y RUN.
-- (Supabase es OPCIONAL: si no lo configuras, la app usa un store en memoria.)

create extension if not exists "pgcrypto";

-- Campañas (un goal global)
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  goal text not null,
  status text not null default 'running',
  created_at timestamptz not null default now()
);

-- Agentes: director, áreas y subagentes
create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  kind text not null,                 -- director | area | subagent
  area text,                          -- research | creative | content | media | null (director)
  role text not null,
  status text not null default 'idle',
  parent_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_agents_campaign on agents(campaign_id);

-- Mensajes / historial por agente (texto, tool_call, tool_result, instrucciones del usuario)
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  role text not null,                 -- system | user | assistant | tool
  content_json jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_campaign on messages(campaign_id);
create index if not exists idx_messages_agent on messages(agent_id);

-- Board compartido: entregables producidos por las áreas
create table if not exists deliverables (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  area text not null,                 -- research | creative | content | media | director
  type text not null,                 -- brief | copy | script | calendar | image | video | budget | channel_plan
  title text not null,
  payload_json jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_deliverables_campaign on deliverables(campaign_id);

-- Recursos que el usuario adjunta a un área
create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  area text,
  kind text not null,
  payload_json jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_resources_campaign on resources(campaign_id);

-- Realtime (opcional): publica cambios de estas tablas.
-- La app v1 usa SSE para el feed en vivo; esto deja Realtime listo si quieres usarlo.
do $$
begin
  begin
    alter publication supabase_realtime add table messages;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table agents;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table deliverables;
  exception when others then null;
  end;
end $$;

-- NOTA sobre RLS: la app accede con la SERVICE ROLE KEY desde el servidor (bypassa RLS),
-- y el navegador nunca consulta Supabase directamente (usa las API routes + SSE).
-- Si activas RLS, recuerda que la service role la ignora; añade políticas solo si
-- piensas consultar desde el cliente con la anon key.
