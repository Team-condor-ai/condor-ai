-- Bárbara · aprendizaje global idempotente y sustentado en agregados.

alter table public.barbara_patrones
  add column if not exists evidencia_clave text,
  add column if not exists evidencia jsonb,
  add column if not exists marcas integer not null default 0,
  add column if not exists confianza_numerica numeric(5,4)
    check (confianza_numerica is null or (confianza_numerica >= 0 and confianza_numerica <= 1));

create unique index if not exists barbara_patrones_evidencia_clave_idx
  on public.barbara_patrones (evidencia_clave)
  where evidencia_clave is not null;

create table if not exists public.barbara_patrones_corridas (
  id                   uuid primary key default gen_random_uuid(),
  huella               text not null unique check (length(huella) = 64),
  piezas               integer not null,
  marcas               integer not null,
  contrastes           integer not null,
  patrones_guardados   integer not null,
  creado_en            timestamptz not null default now()
);

create table if not exists public.barbara_patrones_auditoria (
  id                   uuid primary key default gen_random_uuid(),
  patron_id            uuid not null references public.barbara_patrones(id) on delete cascade,
  activo_antes         boolean not null,
  activo_despues       boolean not null,
  actor                text not null,
  creado_en            timestamptz not null default now()
);

alter table public.barbara_patrones_corridas enable row level security;
alter table public.barbara_patrones_auditoria enable row level security;
drop policy if exists "admin_barbara_patrones_corridas" on public.barbara_patrones_corridas;
create policy "admin_barbara_patrones_corridas" on public.barbara_patrones_corridas
  for all using (public.es_admin()) with check (public.es_admin());
drop policy if exists "admin_barbara_patrones_auditoria" on public.barbara_patrones_auditoria;
create policy "admin_barbara_patrones_auditoria" on public.barbara_patrones_auditoria
  for all using (public.es_admin()) with check (public.es_admin());

create or replace function public.barbara_configurar_patron_global(
  p_patron_id uuid,
  p_activo boolean
) returns public.barbara_patrones
language plpgsql security definer set search_path = public
as $$
declare
  fila public.barbara_patrones;
  antes boolean;
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if not public.es_admin() then raise exception 'Sólo staff puede gobernar patrones globales'; end if;
  select * into fila from public.barbara_patrones where id = p_patron_id for update;
  if not found then raise exception 'Patrón no encontrado'; end if;
  if p_activo and (
    fila.evidencia is null or fila.muestras < 4 or fila.marcas < 3
    or coalesce(fila.confianza_numerica, 0) < 0.15
  ) then raise exception 'Evidencia insuficiente para activar este patrón'; end if;
  antes := fila.activo;
  update public.barbara_patrones set activo = p_activo, actualizado_en = now()
  where id = fila.id returning * into fila;
  insert into public.barbara_patrones_auditoria (patron_id, activo_antes, activo_despues, actor)
  values (fila.id, antes, fila.activo, coalesce(nullif(actor_email, ''), 'staff'));
  return fila;
end;
$$;

revoke all on function public.barbara_configurar_patron_global(uuid, boolean) from public;
grant execute on function public.barbara_configurar_patron_global(uuid, boolean) to authenticated;

comment on column public.barbara_patrones.evidencia is
  'Contraste agregado sin texto, marca ni identificadores de cliente.';
comment on table public.barbara_patrones_corridas is
  'Huella de cada conjunto exacto ya procesado; evita contar semanalmente las mismas piezas.';
