-- Portal Cóndor 2.0 (24-oct-2026). Registro de TODO lo que se aplicó en producción ese día fuera de
-- `20261024_leads_pipeline.sql`. Es idempotente: se puede volver a correr sin romper nada.

-- ── 1. Seguridad: vistas de contabilidad que eran legibles con la clave pública ─────────────────────
alter view if exists public.saldos_cuentas set (security_invoker = true);
alter view if exists public.asientos_descuadrados set (security_invoker = true);
alter view if exists public.pasivos_abiertos set (security_invoker = true);
revoke all on public.saldos_cuentas, public.asientos_descuadrados, public.pasivos_abiertos from anon;
-- Los clientes ya no ven los perfiles (correos) del equipo.
alter policy admins_ven_perfiles on public.admin_profiles using (public.es_admin() or id = auth.uid());

-- ── 2. Bóveda: passwords y archivos con carpetas ────────────────────────────────────────────────────
create table if not exists public.claves_carpetas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  padre_id uuid references public.claves_carpetas(id) on delete cascade,
  orden integer not null default 0,
  seccion text not null default 'claves' check (seccion in ('claves','archivos')),
  creado_en timestamptz not null default now()
);
create table if not exists public.claves (
  id uuid primary key default gen_random_uuid(),
  carpeta_id uuid references public.claves_carpetas(id) on delete set null,
  titulo text not null,
  usuario text, clave text, url text, notas text,
  tipo text not null default 'cuenta' check (tipo in ('cuenta','api','nota','archivo')),
  archivo_url text, archivo_nombre text, peso_bytes bigint, mime text,
  cliente_id uuid references public.clientes(id) on delete set null,
  creado_por text, creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(), actualizado_por text
);
create table if not exists public.claves_accesos (
  id bigint generated always as identity primary key,
  clave_id uuid references public.claves(id) on delete cascade,
  quien text not null, accion text not null default 'reveló',
  creado_en timestamptz not null default now()
);
create index if not exists claves_carpeta_idx on public.claves (carpeta_id);
alter table public.claves_carpetas enable row level security;
alter table public.claves enable row level security;
alter table public.claves_accesos enable row level security;
drop policy if exists claves_carpetas_admin on public.claves_carpetas;
create policy claves_carpetas_admin on public.claves_carpetas for all using (public.es_admin()) with check (public.es_admin());
drop policy if exists claves_admin on public.claves;
create policy claves_admin on public.claves for all using (public.es_admin()) with check (public.es_admin());
drop policy if exists claves_accesos_ver on public.claves_accesos;
create policy claves_accesos_ver on public.claves_accesos for select using (public.es_admin());
-- El valor secreto NUNCA sale en un select: solo por revelar_clave(), que deja registro.
revoke all on public.claves, public.claves_carpetas, public.claves_accesos from anon, authenticated;
grant select, insert, update, delete on public.claves_carpetas to authenticated;
grant select (id, carpeta_id, titulo, usuario, url, notas, tipo, creado_por, creado_en, actualizado_en, actualizado_por, archivo_url, archivo_nombre, peso_bytes, mime, cliente_id) on public.claves to authenticated;
grant insert (carpeta_id, titulo, usuario, clave, url, notas, tipo, creado_por, actualizado_por, actualizado_en, archivo_url, archivo_nombre, peso_bytes, mime, cliente_id) on public.claves to authenticated;
grant update (carpeta_id, titulo, usuario, clave, url, notas, tipo, actualizado_en, actualizado_por, archivo_url, archivo_nombre, peso_bytes, mime, cliente_id) on public.claves to authenticated;
grant delete on public.claves to authenticated;
grant select on public.claves_accesos to authenticated;
create or replace function public.revelar_clave(p_id uuid) returns text
language plpgsql security definer set search_path = public as $fn$
declare v text;
begin
  if not public.es_admin() then raise exception 'solo el equipo'; end if;
  select clave into v from public.claves where id = p_id;
  insert into public.claves_accesos (clave_id, quien) values (p_id, coalesce(auth.jwt() ->> 'email', 'desconocido'));
  return v;
end $fn$;
revoke all on function public.revelar_clave(uuid) from public, anon;
grant execute on function public.revelar_clave(uuid) to authenticated;

insert into storage.buckets (id, name, public) values ('boveda', 'boveda', false) on conflict (id) do nothing;
drop policy if exists boveda_admin_select on storage.objects;
drop policy if exists boveda_admin_insert on storage.objects;
drop policy if exists boveda_admin_update on storage.objects;
drop policy if exists boveda_admin_delete on storage.objects;
create policy boveda_admin_select on storage.objects for select using (bucket_id = 'boveda' and public.es_admin());
create policy boveda_admin_insert on storage.objects for insert with check (bucket_id = 'boveda' and public.es_admin());
create policy boveda_admin_update on storage.objects for update using (bucket_id = 'boveda' and public.es_admin());
create policy boveda_admin_delete on storage.objects for delete using (bucket_id = 'boveda' and public.es_admin());

-- ── 3. Pedidos de cambio de los clientes ────────────────────────────────────────────────────────────
create table if not exists public.solicitudes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  titulo text not null, detalle text,
  estado text not null default 'nueva' check (estado in ('nueva','en_curso','lista')),
  creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now()
);
create index if not exists solicitudes_cliente_idx on public.solicitudes (cliente_id, creado_en desc);
alter table public.solicitudes enable row level security;
drop policy if exists solicitudes_admin on public.solicitudes;
create policy solicitudes_admin on public.solicitudes for all using (public.es_admin()) with check (public.es_admin());
drop policy if exists solicitudes_cliente_ve on public.solicitudes;
create policy solicitudes_cliente_ve on public.solicitudes for select using (cliente_id in (select id from public.clientes where lower(email) = lower(auth.jwt() ->> 'email')));
drop policy if exists solicitudes_cliente_crea on public.solicitudes;
create policy solicitudes_cliente_crea on public.solicitudes for insert with check (estado = 'nueva' and cliente_id in (select id from public.clientes where lower(email) = lower(auth.jwt() ->> 'email')));
revoke all on public.solicitudes from anon;

-- ── 4. Actividad reciente del Panel ─────────────────────────────────────────────────────────────────
create or replace view public.actividad_reciente with (security_invoker = true) as
  select 'lead:' || e.id::text as id, e.creado_en, coalesce(e.autor, 'sistema') as quien,
         case e.tipo when 'etapa' then 'movió un lead a ' || e.a_etapa when 'sistema' then 'recibió un lead nuevo' when 'reunion' then 'actualizó una reunión' else 'anotó en un lead' end as accion,
         'leads' as modulo
  from public.lead_eventos e
  union all
  select 'clave:' || a.id::text, a.creado_en, a.quien, 'reveló la clave «' || coalesce(k.titulo, '?') || '»', 'boveda'
  from public.claves_accesos a left join public.claves k on k.id = a.clave_id
  union all
  select 'sol:' || s.id::text, s.creado_en, coalesce(c.negocio, c.nombre, 'cliente'), 'pidió un cambio: ' || s.titulo, 'solicitudes'
  from public.solicitudes s join public.clientes c on c.id = s.cliente_id;
revoke all on public.actividad_reciente from anon;
grant select on public.actividad_reciente to authenticated;

-- ── 5. Cursos (catálogo → fases → lecciones) y avance por persona ───────────────────────────────────
create table if not exists public.cursos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null, descripcion text, categoria text, nivel text, profesor text, portada_ruta text,
  para_clientes boolean not null default false, publicado boolean not null default true,
  orden integer not null default 0, creado_por text, creado_en timestamptz not null default now()
);
create table if not exists public.curso_fases (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos(id) on delete cascade,
  titulo text not null, descripcion text, orden integer not null default 0,
  creado_en timestamptz not null default now()
);
create table if not exists public.lecciones (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos(id) on delete cascade,
  fase_id uuid references public.curso_fases(id) on delete set null,
  titulo text not null, descripcion text, url text,
  video_ruta text, poster_ruta text, duracion_seg integer, duracion_min integer,
  archivo_ruta text, archivo_nombre text,
  orden integer not null default 0, creado_en timestamptz not null default now()
);
create table if not exists public.curso_progreso (
  email text not null,
  leccion_id uuid not null references public.lecciones(id) on delete cascade,
  hecha_en timestamptz not null default now(),
  primary key (email, leccion_id)
);
create index if not exists curso_fases_curso_idx on public.curso_fases (curso_id, orden);
create index if not exists lecciones_curso_idx on public.lecciones (curso_id, orden);
alter table public.cursos enable row level security;
alter table public.curso_fases enable row level security;
alter table public.lecciones enable row level security;
alter table public.curso_progreso enable row level security;
drop policy if exists cursos_admin on public.cursos;
create policy cursos_admin on public.cursos for all using (public.es_admin()) with check (public.es_admin());
drop policy if exists cursos_clientes on public.cursos;
create policy cursos_clientes on public.cursos for select using (para_clientes and exists (select 1 from public.clientes where lower(email) = lower(auth.jwt() ->> 'email') and archivado is not true));
drop policy if exists curso_fases_admin on public.curso_fases;
create policy curso_fases_admin on public.curso_fases for all using (public.es_admin()) with check (public.es_admin());
drop policy if exists curso_fases_clientes on public.curso_fases;
create policy curso_fases_clientes on public.curso_fases for select using (exists (select 1 from public.cursos c where c.id = curso_id and c.para_clientes) and exists (select 1 from public.clientes where lower(email) = lower(auth.jwt() ->> 'email') and archivado is not true));
drop policy if exists lecciones_admin on public.lecciones;
create policy lecciones_admin on public.lecciones for all using (public.es_admin()) with check (public.es_admin());
drop policy if exists lecciones_clientes on public.lecciones;
create policy lecciones_clientes on public.lecciones for select using (exists (select 1 from public.cursos c where c.id = curso_id and c.para_clientes) and exists (select 1 from public.clientes where lower(email) = lower(auth.jwt() ->> 'email') and archivado is not true));
drop policy if exists progreso_propio on public.curso_progreso;
create policy progreso_propio on public.curso_progreso for all using (lower(email) = lower(auth.jwt() ->> 'email')) with check (lower(email) = lower(auth.jwt() ->> 'email'));
revoke all on public.cursos, public.curso_fases, public.lecciones, public.curso_progreso from anon;

-- Videos en HLS (carpeta = id del curso). Privado: equipo siempre; clientes solo cursos «para clientes».
insert into storage.buckets (id, name, public) values ('cursos', 'cursos', false) on conflict (id) do nothing;
drop policy if exists cursos_obj_admin on storage.objects;
create policy cursos_obj_admin on storage.objects for all using (bucket_id = 'cursos' and public.es_admin()) with check (bucket_id = 'cursos' and public.es_admin());
drop policy if exists cursos_obj_clientes on storage.objects;
create policy cursos_obj_clientes on storage.objects for select using (
  bucket_id = 'cursos'
  and exists (select 1 from public.cursos c where c.id::text = split_part(name, '/', 1) and c.para_clientes)
  and exists (select 1 from public.clientes where lower(email) = lower(auth.jwt() ->> 'email') and archivado is not true));

-- ── 6. Suscripciones y servicios que paga Cóndor ────────────────────────────────────────────────────
create table if not exists public.servicios_condor (
  id uuid primary key default gen_random_uuid(),
  nombre text not null, proveedor text,
  categoria text not null default 'otros' check (categoria in ('infraestructura','dominios','comunicacion','pagos','crm','ia','marketing','reuniones','clientes','otros')),
  uso text, costo numeric, moneda text not null default 'USD',
  ciclo text not null default 'mensual' check (ciclo in ('mensual','anual','uso','gratis')),
  renovacion date,
  estado text not null default 'revisar' check (estado in ('activa','revisar','desactivar','cancelada')),
  necesario text not null default 'quizas' check (necesario in ('si','quizas','no')),
  responsable text, url text, notas text,
  creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now()
);
alter table public.servicios_condor enable row level security;
drop policy if exists servicios_condor_admin on public.servicios_condor;
create policy servicios_condor_admin on public.servicios_condor for all using (public.es_admin()) with check (public.es_admin());
revoke all on public.servicios_condor from anon;

-- ── 7. Fallos de envío del código de acceso (los anota la función solicitar-acceso) ──────────────────
create table if not exists public.acceso_errores (
  id bigint generated always as identity primary key,
  email text, etapa text, detalle text,
  creado_en timestamptz not null default now()
);
alter table public.acceso_errores enable row level security;
drop policy if exists acceso_errores_admin on public.acceso_errores;
create policy acceso_errores_admin on public.acceso_errores for select using (public.es_admin());
revoke all on public.acceso_errores from anon, authenticated;
grant select on public.acceso_errores to authenticated;
