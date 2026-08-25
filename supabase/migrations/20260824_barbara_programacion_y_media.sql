-- Bárbara · calendario futuro y copia persistente de cada pieza.
-- Telegram es un canal de entrega; nunca la única fuente de un archivo ni de
-- la programación. Este modelo separa la pieza generada (`barbara_memoria`),
-- sus archivos (`barbara_media`) y su publicación futura (`barbara_programaciones`).

create table if not exists public.barbara_programaciones (
  id                   uuid primary key default gen_random_uuid(),
  barbara_cliente_id   uuid not null references public.barbara_clientes(id) on delete cascade,
  barbara_memoria_id   uuid references public.barbara_memoria(id) on delete set null,
  tipo                 text not null check (tipo in ('carrusel', 'historia', 'ugc')),
  plataforma           text not null default 'instagram' check (plataforma in ('instagram', 'tiktok', 'facebook', 'linkedin')),
  programada_para      timestamptz not null,
  estado               text not null default 'borrador' check (estado in ('borrador', 'programada', 'publicando', 'publicada', 'fallida', 'cancelada')),
  zona_horaria         text not null default 'America/Santiago',
  motivo_reprogramacion text,
  creado_por           text not null default 'barbara',
  creado_en            timestamptz not null default now(),
  actualizado_en       timestamptz not null default now()
);

create index if not exists barbara_programaciones_calendario_idx
  on public.barbara_programaciones (barbara_cliente_id, programada_para);

alter table public.barbara_programaciones enable row level security;

drop policy if exists "admin_all_barbara_programaciones" on public.barbara_programaciones;
create policy "admin_all_barbara_programaciones" on public.barbara_programaciones
  for all using (public.es_admin()) with check (public.es_admin());

drop policy if exists "cliente_ve_su_programacion_barbara" on public.barbara_programaciones;
create policy "cliente_ve_su_programacion_barbara" on public.barbara_programaciones
  for select using (exists (
    select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
    where bc.id = barbara_programaciones.barbara_cliente_id
      and lower(c.email) = lower((select auth.jwt() ->> 'email'))
  ));

-- Sólo esta RPC reprograma: evita dar UPDATE libre al cliente sobre estado,
-- plataforma o propietario de una publicación.
create or replace function public.barbara_reprogramar(
  p_programacion_id uuid,
  p_programada_para timestamptz,
  p_motivo text default null
) returns public.barbara_programaciones
language plpgsql security definer set search_path = public
as $$
declare
  fila public.barbara_programaciones;
begin
  select * into fila from public.barbara_programaciones where id = p_programacion_id for update;
  if not found then raise exception 'Programación no encontrada'; end if;
  if fila.estado not in ('borrador', 'programada') then
    raise exception 'Sólo se puede mover una pieza en borrador o programada';
  end if;
  if not public.es_admin() and not exists (
    select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
    where bc.id = fila.barbara_cliente_id
      and lower(c.email) = lower((select auth.jwt() ->> 'email'))
  ) then
    raise exception 'Sin acceso a esta programación';
  end if;
  update public.barbara_programaciones
  set programada_para = p_programada_para,
      motivo_reprogramacion = nullif(trim(coalesce(p_motivo, '')), ''),
      actualizado_en = now()
  where id = fila.id
  returning * into fila;
  return fila;
end;
$$;

revoke all on function public.barbara_reprogramar(uuid, timestamptz, text) from public;
grant execute on function public.barbara_reprogramar(uuid, timestamptz, text) to authenticated;

create table if not exists public.barbara_media (
  id                 uuid primary key default gen_random_uuid(),
  barbara_memoria_id uuid not null references public.barbara_memoria(id) on delete cascade,
  storage_path       text not null unique,
  tipo               text not null check (tipo in ('imagen', 'video', 'portada', 'documento')),
  mime_type          text not null,
  bytes              bigint,
  sha256             text,
  creado_en          timestamptz not null default now()
);

create index if not exists barbara_media_pieza_idx on public.barbara_media (barbara_memoria_id);
alter table public.barbara_media enable row level security;

drop policy if exists "admin_all_barbara_media" on public.barbara_media;
create policy "admin_all_barbara_media" on public.barbara_media
  for all using (public.es_admin()) with check (public.es_admin());

drop policy if exists "cliente_ve_su_media_barbara" on public.barbara_media;
create policy "cliente_ve_su_media_barbara" on public.barbara_media
  for select using (exists (
    select 1 from public.barbara_memoria bm
    join public.barbara_clientes bc on bc.id = bm.barbara_cliente_id
    join public.clientes c on c.id = bc.cliente_id
    where bm.id = barbara_media.barbara_memoria_id
      and lower(c.email) = lower((select auth.jwt() ->> 'email'))
  ));

insert into storage.buckets (id, name, public)
values ('barbara-media', 'barbara-media', false)
on conflict (id) do update set public = false;

comment on table public.barbara_programaciones is
  'Cola real de publicación de Bárbara. La hora se mueve mediante barbara_reprogramar y el estado sólo cambia desde el motor autorizado.';
comment on table public.barbara_media is
  'Inventario de archivos persistentes. El bucket es privado; la entrega usa URLs firmadas, no enlaces públicos eternos.';
