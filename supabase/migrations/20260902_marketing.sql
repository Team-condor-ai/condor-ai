-- Módulo Marketing — calendario de contenido + seguimiento diario en
-- Instagram (2-sept-2026, pedido de Joaquín)
-- Pega en Supabase → SQL Editor → Run (idempotente)

-- Una fila por día con contenido (solo lunes/martes/jueves/viernes tienen
-- tema asignado). El frontend hace upsert-sin-pisar de la semana en curso
-- al entrar al módulo; de ahí en más solo se editan los booleanos.
create table if not exists public.marketing_contenido (
  id uuid primary key default gen_random_uuid(),
  fecha date not null unique,
  tema text not null,
  responsable_email text not null,
  hecho boolean not null default false,
  publicado_instagram boolean not null default false,
  publicado_linkedin boolean not null default false,
  publicado_tiktok boolean not null default false,
  publicado_facebook boolean not null default false,
  actualizado_en timestamptz not null default now(),
  creado_en timestamptz not null default now()
);
create index if not exists idx_marketing_contenido_fecha on public.marketing_contenido(fecha);

-- Una fila por día, TODOS los días de la semana: seguir 200 cuentas desde
-- @condor.ai. `cantidad` es opcional -- si queda vacío pero `hecho=true`
-- se asume la meta de 200 (ver META_SEGUIDOS_DIA en tipos.ts).
create table if not exists public.marketing_seguimiento_diario (
  id uuid primary key default gen_random_uuid(),
  fecha date not null unique,
  responsable_email text not null,
  hecho boolean not null default false,
  cantidad integer,
  actualizado_en timestamptz not null default now(),
  creado_en timestamptz not null default now()
);
create index if not exists idx_marketing_seguimiento_fecha on public.marketing_seguimiento_diario(fecha);

-- Snapshot manual del total de seguidores de @condor.ai, una vez por
-- semana (viernes), para calcular cuántos seguidores nuevos se ganaron.
-- Manual hasta que exista un token de Meta Graph API para automatizarlo
-- (ver el comentario extenso en tipos.ts sobre por qué Blotato no sirve
-- para esto todavía).
create table if not exists public.marketing_seguidores_snapshot (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  cantidad integer not null,
  creado_por text,
  creado_en timestamptz not null default now()
);
create index if not exists idx_marketing_snapshot_fecha on public.marketing_seguidores_snapshot(fecha desc);

alter table public.marketing_contenido enable row level security;
drop policy if exists "admins_marketing_contenido" on public.marketing_contenido;
create policy "admins_marketing_contenido" on public.marketing_contenido
  for all using ( public.es_admin() ) with check ( public.es_admin() );

alter table public.marketing_seguimiento_diario enable row level security;
drop policy if exists "admins_marketing_seguimiento" on public.marketing_seguimiento_diario;
create policy "admins_marketing_seguimiento" on public.marketing_seguimiento_diario
  for all using ( public.es_admin() ) with check ( public.es_admin() );

alter table public.marketing_seguidores_snapshot enable row level security;
drop policy if exists "admins_marketing_snapshot" on public.marketing_seguidores_snapshot;
create policy "admins_marketing_snapshot" on public.marketing_seguidores_snapshot
  for all using ( public.es_admin() ) with check ( public.es_admin() );
