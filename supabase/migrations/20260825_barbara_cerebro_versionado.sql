-- Bárbara · cerebro privado versionado, propuestas y grafo (25-ago-2026).
--
-- Una conversación no debe sobrescribir silenciosamente lo que Bárbara sabe.
-- Los recuerdos claros pueden entrar con fuente y confianza; inferencias o
-- conflictos quedan como propuestas. Cada cambio al nodo conserva una versión
-- inmutable y cada relación está obligada a vivir dentro del mismo cliente.

alter table public.barbara_memoria_nodos
  add column if not exists confianza numeric(4,3) not null default 1
    check (confianza >= 0 and confianza <= 1),
  add column if not exists etiquetas text[] not null default '{}',
  add column if not exists version integer not null default 1 check (version > 0),
  add column if not exists fuente_tipo text,
  add column if not exists fuente_id text,
  add column if not exists actualizado_por text;

create table if not exists public.barbara_memoria_versiones (
  id                   uuid primary key default gen_random_uuid(),
  nodo_id              uuid not null references public.barbara_memoria_nodos(id) on delete cascade,
  barbara_cliente_id   uuid not null references public.barbara_clientes(id) on delete cascade,
  version              integer not null,
  tipo                 text not null,
  titulo               text not null,
  contenido            text not null,
  peso                 integer not null,
  activo               boolean not null,
  confianza            numeric(4,3) not null,
  etiquetas            text[] not null default '{}',
  origen               text,
  fuente_tipo          text,
  fuente_id            text,
  cambiado_por         text,
  creado_en            timestamptz not null default now(),
  unique (nodo_id, version)
);

create or replace function public.barbara_preparar_version_nodo()
returns trigger language plpgsql set search_path = public as $$
begin
  if row(new.tipo, new.titulo, new.contenido, new.peso, new.activo,
         new.confianza, new.etiquetas, new.origen, new.fuente_tipo, new.fuente_id)
     is distinct from
     row(old.tipo, old.titulo, old.contenido, old.peso, old.activo,
         old.confianza, old.etiquetas, old.origen, old.fuente_tipo, old.fuente_id) then
    new.version := old.version + 1;
    new.actualizado_en := now();
  end if;
  return new;
end;
$$;

drop trigger if exists barbara_memoria_nodos_preparar_version on public.barbara_memoria_nodos;
create trigger barbara_memoria_nodos_preparar_version
before update on public.barbara_memoria_nodos
for each row execute function public.barbara_preparar_version_nodo();

create or replace function public.barbara_guardar_version_nodo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.barbara_memoria_versiones (
    nodo_id, barbara_cliente_id, version, tipo, titulo, contenido, peso,
    activo, confianza, etiquetas, origen, fuente_tipo, fuente_id, cambiado_por
  ) values (
    new.id, new.barbara_cliente_id, new.version, new.tipo, new.titulo,
    new.contenido, new.peso, new.activo, new.confianza, new.etiquetas,
    new.origen, new.fuente_tipo, new.fuente_id,
    coalesce(new.actualizado_por, auth.jwt() ->> 'email', current_user)
  ) on conflict (nodo_id, version) do nothing;
  return new;
end;
$$;

drop trigger if exists barbara_memoria_nodos_guardar_version on public.barbara_memoria_nodos;
create trigger barbara_memoria_nodos_guardar_version
after insert or update on public.barbara_memoria_nodos
for each row execute function public.barbara_guardar_version_nodo();

-- Registra como versión 1 los nodos que existían antes de esta migración.
insert into public.barbara_memoria_versiones (
  nodo_id, barbara_cliente_id, version, tipo, titulo, contenido, peso,
  activo, confianza, etiquetas, origen, fuente_tipo, fuente_id, cambiado_por, creado_en
)
select id, barbara_cliente_id, version, tipo, titulo, contenido, peso, activo,
       confianza, etiquetas, origen, fuente_tipo, fuente_id, 'migracion', creado_en
from public.barbara_memoria_nodos
on conflict (nodo_id, version) do nothing;

create index if not exists barbara_memoria_versiones_nodo_idx
  on public.barbara_memoria_versiones (nodo_id, version desc);

create table if not exists public.barbara_memoria_propuestas (
  id                   uuid primary key default gen_random_uuid(),
  barbara_cliente_id   uuid not null references public.barbara_clientes(id) on delete cascade,
  nodo_objetivo_id     uuid references public.barbara_memoria_nodos(id) on delete set null,
  accion               text not null check (accion in ('crear', 'actualizar', 'conflicto')),
  tipo                 text not null check (tipo in ('gusto', 'dato', 'perfil')),
  titulo               text not null,
  contenido            text not null,
  confianza            numeric(4,3) not null check (confianza >= 0 and confianza <= 1),
  etiquetas            text[] not null default '{}',
  fuente_tipo          text not null,
  fuente_id            text,
  evidencia            text,
  razon                text,
  estado               text not null default 'pendiente'
    check (estado in ('pendiente', 'aprobada', 'rechazada', 'expirada')),
  resuelta_por         text,
  resuelta_en          timestamptz,
  creado_en            timestamptz not null default now()
);

create index if not exists barbara_memoria_propuestas_pendientes_idx
  on public.barbara_memoria_propuestas (barbara_cliente_id, estado, creado_en desc);

create table if not exists public.barbara_memoria_relaciones (
  id                   uuid primary key default gen_random_uuid(),
  barbara_cliente_id   uuid not null references public.barbara_clientes(id) on delete cascade,
  origen_id            uuid not null references public.barbara_memoria_nodos(id) on delete cascade,
  destino_id           uuid not null references public.barbara_memoria_nodos(id) on delete cascade,
  tipo                 text not null default 'relacionada',
  peso                 numeric(4,3) not null default 1 check (peso >= 0 and peso <= 1),
  activa               boolean not null default true,
  origen               text,
  creado_en            timestamptz not null default now(),
  check (origen_id <> destino_id)
);

create unique index if not exists barbara_memoria_relacion_unica_idx
  on public.barbara_memoria_relaciones (
    barbara_cliente_id,
    least(origen_id, destino_id),
    greatest(origen_id, destino_id),
    tipo
  );

create or replace function public.barbara_validar_relacion_memoria()
returns trigger language plpgsql set search_path = public as $$
declare
  cliente_origen uuid;
  cliente_destino uuid;
begin
  select barbara_cliente_id into cliente_origen from public.barbara_memoria_nodos where id = new.origen_id;
  select barbara_cliente_id into cliente_destino from public.barbara_memoria_nodos where id = new.destino_id;
  if cliente_origen is null or cliente_destino is null
     or cliente_origen <> cliente_destino
     or cliente_origen <> new.barbara_cliente_id then
    raise exception 'Una relación de memoria no puede cruzar clientes';
  end if;
  return new;
end;
$$;

drop trigger if exists barbara_memoria_relacion_mismo_cliente on public.barbara_memoria_relaciones;
create trigger barbara_memoria_relacion_mismo_cliente
before insert or update on public.barbara_memoria_relaciones
for each row execute function public.barbara_validar_relacion_memoria();

create table if not exists public.barbara_eventos (
  id                   uuid primary key default gen_random_uuid(),
  barbara_cliente_id   uuid not null references public.barbara_clientes(id) on delete cascade,
  tipo                 text not null,
  actor                text not null,
  fuente_tipo          text,
  fuente_id            text,
  payload              jsonb not null default '{}',
  creado_en            timestamptz not null default now()
);

create index if not exists barbara_eventos_cliente_idx
  on public.barbara_eventos (barbara_cliente_id, creado_en desc);

alter table public.barbara_memoria_versiones enable row level security;
alter table public.barbara_memoria_propuestas enable row level security;
alter table public.barbara_memoria_relaciones enable row level security;
alter table public.barbara_eventos enable row level security;

drop policy if exists "admin_barbara_memoria_versiones" on public.barbara_memoria_versiones;
create policy "admin_barbara_memoria_versiones" on public.barbara_memoria_versiones
  for all using (public.es_admin()) with check (public.es_admin());
drop policy if exists "admin_barbara_memoria_propuestas" on public.barbara_memoria_propuestas;
create policy "admin_barbara_memoria_propuestas" on public.barbara_memoria_propuestas
  for all using (public.es_admin()) with check (public.es_admin());
drop policy if exists "admin_barbara_memoria_relaciones" on public.barbara_memoria_relaciones;
create policy "admin_barbara_memoria_relaciones" on public.barbara_memoria_relaciones
  for all using (public.es_admin()) with check (public.es_admin());
drop policy if exists "admin_barbara_eventos" on public.barbara_eventos;
create policy "admin_barbara_eventos" on public.barbara_eventos
  for all using (public.es_admin()) with check (public.es_admin());

-- Todos los SELECT de cliente se aíslan por la misma relación canónica
-- barbara_clientes -> clientes.email. No se confía en un id enviado por UI.
drop policy if exists "cliente_ve_versiones_barbara" on public.barbara_memoria_versiones;
create policy "cliente_ve_versiones_barbara" on public.barbara_memoria_versiones
  for select using (exists (
    select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
    where bc.id = barbara_memoria_versiones.barbara_cliente_id
      and lower(c.email) = lower((select auth.jwt() ->> 'email'))
  ));
drop policy if exists "cliente_ve_propuestas_barbara" on public.barbara_memoria_propuestas;
create policy "cliente_ve_propuestas_barbara" on public.barbara_memoria_propuestas
  for select using (exists (
    select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
    where bc.id = barbara_memoria_propuestas.barbara_cliente_id
      and lower(c.email) = lower((select auth.jwt() ->> 'email'))
  ));
drop policy if exists "cliente_ve_relaciones_barbara" on public.barbara_memoria_relaciones;
create policy "cliente_ve_relaciones_barbara" on public.barbara_memoria_relaciones
  for select using (exists (
    select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
    where bc.id = barbara_memoria_relaciones.barbara_cliente_id
      and lower(c.email) = lower((select auth.jwt() ->> 'email'))
  ));
drop policy if exists "cliente_ve_eventos_barbara" on public.barbara_eventos;
create policy "cliente_ve_eventos_barbara" on public.barbara_eventos
  for select using (exists (
    select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
    where bc.id = barbara_eventos.barbara_cliente_id
      and lower(c.email) = lower((select auth.jwt() ->> 'email'))
  ));

-- Resolver una propuesta es una operación estrecha: el cliente puede aprobar
-- o rechazar el recuerdo, pero no cambiar propietario, confianza ni fuente.
create or replace function public.barbara_resolver_propuesta(
  p_propuesta_id uuid,
  p_aprobar boolean
) returns public.barbara_memoria_propuestas
language plpgsql security definer set search_path = public
as $$
declare
  propuesta public.barbara_memoria_propuestas;
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  nodo_id uuid;
begin
  select * into propuesta from public.barbara_memoria_propuestas
  where id = p_propuesta_id for update;
  if not found then raise exception 'Propuesta no encontrada'; end if;
  if propuesta.estado <> 'pendiente' then raise exception 'La propuesta ya fue resuelta'; end if;
  if not public.es_admin() and not exists (
    select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
    where bc.id = propuesta.barbara_cliente_id and lower(c.email) = actor_email
  ) then raise exception 'Sin acceso a esta propuesta'; end if;

  if p_aprobar then
    if propuesta.nodo_objetivo_id is null then
      insert into public.barbara_memoria_nodos (
        barbara_cliente_id, tipo, titulo, contenido, confianza, etiquetas,
        origen, fuente_tipo, fuente_id, actualizado_por
      ) values (
        propuesta.barbara_cliente_id, propuesta.tipo, propuesta.titulo,
        propuesta.contenido, propuesta.confianza, propuesta.etiquetas,
        propuesta.evidencia, propuesta.fuente_tipo, propuesta.fuente_id,
        coalesce(nullif(actor_email, ''), 'staff')
      ) returning id into nodo_id;
    else
      update public.barbara_memoria_nodos set
        tipo = propuesta.tipo,
        titulo = propuesta.titulo,
        contenido = propuesta.contenido,
        confianza = propuesta.confianza,
        etiquetas = propuesta.etiquetas,
        origen = propuesta.evidencia,
        fuente_tipo = propuesta.fuente_tipo,
        fuente_id = propuesta.fuente_id,
        actualizado_por = coalesce(nullif(actor_email, ''), 'staff')
      where id = propuesta.nodo_objetivo_id
        and barbara_cliente_id = propuesta.barbara_cliente_id
      returning id into nodo_id;
      if nodo_id is null then raise exception 'Nodo objetivo inválido'; end if;
    end if;
  end if;

  update public.barbara_memoria_propuestas set
    estado = case when p_aprobar then 'aprobada' else 'rechazada' end,
    resuelta_por = coalesce(nullif(actor_email, ''), 'staff'),
    resuelta_en = now()
  where id = propuesta.id returning * into propuesta;

  insert into public.barbara_eventos (
    barbara_cliente_id, tipo, actor, fuente_tipo, fuente_id, payload
  ) values (
    propuesta.barbara_cliente_id, 'memoria_propuesta_resuelta',
    coalesce(nullif(actor_email, ''), 'staff'), 'propuesta', propuesta.id::text,
    jsonb_build_object('estado', propuesta.estado, 'nodo_id', nodo_id)
  );
  return propuesta;
end;
$$;

revoke all on function public.barbara_resolver_propuesta(uuid, boolean) from public;
grant execute on function public.barbara_resolver_propuesta(uuid, boolean) to authenticated;

-- El grafo es editable por su dueño, pero mediante RPC estrechas: no se le da
-- UPDATE/INSERT general sobre la tabla ni posibilidad de elegir otro cliente.
create or replace function public.barbara_guardar_nodo(
  p_barbara_cliente_id uuid,
  p_tipo text,
  p_titulo text,
  p_contenido text,
  p_nodo_id uuid default null
) returns public.barbara_memoria_nodos
language plpgsql security definer set search_path = public
as $$
declare
  fila public.barbara_memoria_nodos;
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if p_tipo not in ('gusto', 'dato') then raise exception 'Tipo de nota no editable'; end if;
  if length(trim(coalesce(p_titulo, ''))) not between 1 and 120
     or length(trim(coalesce(p_contenido, ''))) not between 1 and 1600 then
    raise exception 'Título o contenido inválido';
  end if;
  if not public.es_admin() and not exists (
    select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
    where bc.id = p_barbara_cliente_id and lower(c.email) = actor_email
  ) then raise exception 'Sin acceso a esta memoria'; end if;

  if p_nodo_id is null then
    insert into public.barbara_memoria_nodos (
      barbara_cliente_id, tipo, titulo, contenido, confianza, origen,
      fuente_tipo, actualizado_por
    ) values (
      p_barbara_cliente_id, p_tipo, trim(p_titulo), trim(p_contenido), 1,
      'Nota creada explícitamente desde el portal', 'portal',
      coalesce(nullif(actor_email, ''), 'staff')
    ) returning * into fila;
  else
    update public.barbara_memoria_nodos set
      tipo = p_tipo,
      titulo = trim(p_titulo),
      contenido = trim(p_contenido),
      confianza = 1,
      origen = 'Nota editada explícitamente desde el portal',
      fuente_tipo = 'portal',
      actualizado_por = coalesce(nullif(actor_email, ''), 'staff')
    where id = p_nodo_id and barbara_cliente_id = p_barbara_cliente_id
      and tipo in ('gusto', 'dato')
    returning * into fila;
    if fila.id is null then raise exception 'Nota no encontrada o no editable'; end if;
  end if;
  return fila;
end;
$$;

create or replace function public.barbara_establecer_nodo_activo(
  p_nodo_id uuid,
  p_activo boolean
) returns public.barbara_memoria_nodos
language plpgsql security definer set search_path = public
as $$
declare
  fila public.barbara_memoria_nodos;
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  select * into fila from public.barbara_memoria_nodos where id = p_nodo_id for update;
  if not found then raise exception 'Nota no encontrada'; end if;
  if not public.es_admin() and not exists (
    select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
    where bc.id = fila.barbara_cliente_id and lower(c.email) = actor_email
  ) then raise exception 'Sin acceso a esta memoria'; end if;
  update public.barbara_memoria_nodos set
    activo = p_activo,
    actualizado_por = coalesce(nullif(actor_email, ''), 'staff')
  where id = fila.id returning * into fila;
  return fila;
end;
$$;

create or replace function public.barbara_establecer_regla_activa(
  p_regla_id uuid,
  p_activa boolean
) returns public.barbara_reglas
language plpgsql security definer set search_path = public
as $$
declare
  fila public.barbara_reglas;
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  select * into fila from public.barbara_reglas where id = p_regla_id for update;
  if not found then raise exception 'Regla no encontrada'; end if;
  if not public.es_admin() and not exists (
    select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
    where bc.id = fila.barbara_cliente_id and lower(c.email) = actor_email
  ) then raise exception 'Sin acceso a esta regla'; end if;
  update public.barbara_reglas set activa = p_activa, actualizado_en = now()
  where id = fila.id returning * into fila;
  insert into public.barbara_eventos (barbara_cliente_id, tipo, actor, fuente_tipo, fuente_id, payload)
  values (fila.barbara_cliente_id, 'regla_estado_cambiado',
    coalesce(nullif(actor_email, ''), 'staff'), 'regla', fila.id::text,
    jsonb_build_object('activa', fila.activa));
  return fila;
end;
$$;

revoke all on function public.barbara_guardar_nodo(uuid, text, text, text, uuid) from public;
grant execute on function public.barbara_guardar_nodo(uuid, text, text, text, uuid) to authenticated;
revoke all on function public.barbara_establecer_nodo_activo(uuid, boolean) from public;
grant execute on function public.barbara_establecer_nodo_activo(uuid, boolean) to authenticated;
revoke all on function public.barbara_establecer_regla_activa(uuid, boolean) from public;
grant execute on function public.barbara_establecer_regla_activa(uuid, boolean) to authenticated;

comment on table public.barbara_memoria_versiones is
  'Historial inmutable de cada estado de una nota privada de Bárbara.';
comment on table public.barbara_memoria_propuestas is
  'Inferencias y conflictos que requieren aprobación antes de cambiar el cerebro del cliente.';
comment on table public.barbara_memoria_relaciones is
  'Aristas privadas del grafo; el trigger impide por construcción cruzar clientes.';
comment on table public.barbara_eventos is
  'Ledger de decisiones y eventos reales de Bárbara, aislado por cliente.';
