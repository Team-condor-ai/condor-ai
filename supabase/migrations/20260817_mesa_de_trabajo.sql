-- Portal Cóndor · "mesa de crafteo": biblioteca, links a repos y reuniones.
--
-- Pega y ejecuta en: Supabase -> SQL Editor -> New query -> Run.
-- Todo es idempotente (`if not exists` / `on conflict`): se puede correr más
-- de una vez sin romper nada.
--
-- OJO: las tablas de REUNIONES ya existen desde junio (`reuniones.sql`,
-- `reuniones_fix.sql`) y la Edge Function `reunion-notificar` también. Acá
-- solo se agrega la columna del link de Meet, que es lo único que faltaba.

-- ───────────────────────────────────────────────────────────────────────────
-- 1) Productos: links a todo (repo, sitio, documentación)
-- ───────────────────────────────────────────────────────────────────────────
alter table public.productos add column if not exists repo_url text;
alter table public.productos add column if not exists sitio_url text;
alter table public.productos add column if not exists docs_url text;

-- ───────────────────────────────────────────────────────────────────────────
-- 2) Reuniones: link de Google Meet
-- ───────────────────────────────────────────────────────────────────────────
alter table public.reuniones add column if not exists meet_url text;

-- ───────────────────────────────────────────────────────────────────────────
-- 3) Biblioteca de archivos (presentaciones, propuestas, material de marca)
--
-- Solo guarda los archivos SUBIDOS. Las plantillas que se generan solas
-- (cotización, contrato, presentación de producto) no viven en esta tabla:
-- se arman al vuelo desde los datos del cliente, no son archivos guardados.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.biblioteca (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  descripcion     text,
  categoria       text not null default 'presentacion',
  archivo_url     text,
  archivo_nombre  text,
  peso_bytes      bigint,
  creado_en       timestamptz not null default now()
);

alter table public.biblioteca enable row level security;

drop policy if exists "admin_all_biblioteca" on public.biblioteca;
create policy "admin_all_biblioteca" on public.biblioteca
  for all using ( public.es_admin() ) with check ( public.es_admin() );

-- Bucket de Storage para los archivos. Público de lectura para poder
-- descargar con una URL directa; solo admins suben/borran — mismo patrón
-- que `barbara-logos`.
insert into storage.buckets (id, name, public)
values ('biblioteca', 'biblioteca', true)
on conflict (id) do nothing;

drop policy if exists "admin_manage_biblioteca" on storage.objects;
create policy "admin_manage_biblioteca" on storage.objects
  for all
  using ( bucket_id = 'biblioteca' and public.es_admin() )
  with check ( bucket_id = 'biblioteca' and public.es_admin() );
