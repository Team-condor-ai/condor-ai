-- Bárbara · publicación programada con claim atómico e idempotencia.
-- Una fila sólo entra al worker si el cliente aprobó `programada`, el canal
-- está activo y `auto_publicar` fue habilitado explícitamente.

create table if not exists public.barbara_canales (
  id                   uuid primary key default gen_random_uuid(),
  barbara_cliente_id   uuid not null references public.barbara_clientes(id) on delete cascade,
  plataforma           text not null check (plataforma in ('instagram', 'tiktok', 'facebook', 'linkedin')),
  proveedor            text not null default 'blotato' check (proveedor in ('blotato')),
  account_ref          text not null,
  target               jsonb not null default '{}',
  activo               boolean not null default true,
  auto_publicar        boolean not null default false,
  aprobado_por         text,
  aprobado_en          timestamptz,
  creado_en            timestamptz not null default now(),
  actualizado_en       timestamptz not null default now(),
  unique (barbara_cliente_id, plataforma, proveedor)
);

alter table public.barbara_programaciones
  add column if not exists canal_id uuid references public.barbara_canales(id) on delete set null,
  add column if not exists claim_token uuid,
  add column if not exists claimed_at timestamptz,
  add column if not exists intentos_publicacion integer not null default 0,
  add column if not exists external_id text,
  add column if not exists ultimo_error text,
  add column if not exists publicada_en timestamptz;

create index if not exists barbara_programaciones_worker_idx
  on public.barbara_programaciones (estado, programada_para)
  where estado in ('programada', 'publicando');

alter table public.barbara_canales enable row level security;
drop policy if exists "admin_barbara_canales" on public.barbara_canales;
create policy "admin_barbara_canales" on public.barbara_canales
  for all using (public.es_admin()) with check (public.es_admin());
drop policy if exists "cliente_ve_sus_canales_barbara" on public.barbara_canales;
create policy "cliente_ve_sus_canales_barbara" on public.barbara_canales
  for select using (exists (
    select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
    where bc.id = barbara_canales.barbara_cliente_id
      and lower(c.email) = lower((select auth.jwt() ->> 'email'))
  ));

-- Vincula el canal de esa plataforma al aprobar. Si no existe o la
-- automatización está apagada, la pieza sigue visible/programada pero ningún
-- worker puede tomarla: programar no concede permisos por accidente.
create or replace function public.barbara_cambiar_estado_programacion(
  p_programacion_id uuid,
  p_estado text
) returns public.barbara_programaciones
language plpgsql security definer set search_path = public
as $$
declare
  fila public.barbara_programaciones;
  estado_anterior text;
  canal uuid;
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if p_estado not in ('programada', 'cancelada') then raise exception 'El cliente sólo puede programar o cancelar'; end if;
  select * into fila from public.barbara_programaciones where id = p_programacion_id for update;
  if not found then raise exception 'Programación no encontrada'; end if;
  if fila.estado not in ('borrador', 'programada') then raise exception 'La pieza ya está en un estado irreversible desde el portal'; end if;
  if p_estado = 'programada' and fila.programada_para <= now() + interval '5 minutes' then raise exception 'No se puede aprobar una hora vencida'; end if;
  if not public.es_admin() and not exists (
    select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
    where bc.id = fila.barbara_cliente_id and lower(c.email) = actor_email
  ) then raise exception 'Sin acceso a esta programación'; end if;

  if p_estado = 'programada' then
    select id into canal from public.barbara_canales
    where barbara_cliente_id = fila.barbara_cliente_id
      and plataforma = fila.plataforma and activo = true
    limit 1;
  end if;
  estado_anterior := fila.estado;
  update public.barbara_programaciones set
    estado = p_estado,
    canal_id = case when p_estado = 'programada' then canal else canal_id end,
    actualizado_en = now()
  where id = fila.id returning * into fila;
  insert into public.barbara_programacion_historial (
    programacion_id, barbara_cliente_id, accion, programada_antes,
    programada_despues, estado_antes, estado_despues, actor, motivo
  ) values (
    fila.id, fila.barbara_cliente_id, 'estado_cambiado', fila.programada_para,
    fila.programada_para, estado_anterior, fila.estado,
    coalesce(nullif(actor_email, ''), 'staff'),
    case when p_estado = 'programada' and canal is null then 'Programada sin canal activo: no se publicará automáticamente' end
  );
  return fila;
end;
$$;

-- Claim atómico con SKIP LOCKED: dos workers simultáneos jamás reciben la
-- misma pieza. Sólo service_role puede ejecutarlo.
create or replace function public.barbara_reclamar_publicaciones(p_limite integer default 10)
returns setof public.barbara_programaciones
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then raise exception 'Sólo servicio interno'; end if;
  return query
  with candidatas as (
    select p.id
    from public.barbara_programaciones p
    join public.barbara_canales c on c.id = p.canal_id
    where p.estado = 'programada'
      and p.programada_para <= now()
      and c.activo = true and c.auto_publicar = true
      and p.intentos_publicacion < 3
    order by p.programada_para
    for update of p skip locked
    limit greatest(1, least(coalesce(p_limite, 10), 50))
  )
  update public.barbara_programaciones p set
    estado = 'publicando', claim_token = gen_random_uuid(), claimed_at = now(),
    intentos_publicacion = p.intentos_publicacion + 1,
    ultimo_error = null, actualizado_en = now()
  from candidatas c where p.id = c.id
  returning p.*;
end;
$$;

create or replace function public.barbara_finalizar_publicacion(
  p_programacion_id uuid,
  p_claim_token uuid,
  p_publicada boolean,
  p_external_id text default null,
  p_error text default null
) returns public.barbara_programaciones
language plpgsql security definer set search_path = public
as $$
declare
  fila public.barbara_programaciones;
  nuevo_estado text;
  programada_antes timestamptz;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then raise exception 'Sólo servicio interno'; end if;
  select * into fila from public.barbara_programaciones
  where id = p_programacion_id and estado = 'publicando' and claim_token = p_claim_token for update;
  if not found then raise exception 'Claim inválido o ya finalizado'; end if;
  if p_publicada and nullif(trim(coalesce(p_external_id, '')), '') is null then
    raise exception 'Una publicación confirmada requiere id externo';
  end if;
  programada_antes := fila.programada_para;
  nuevo_estado := case
    when p_publicada then 'publicada'
    when fila.intentos_publicacion >= 3 then 'fallida'
    else 'programada'
  end;
  update public.barbara_programaciones set
    estado = nuevo_estado,
    external_id = case
      when p_publicada then nullif(trim(coalesce(p_external_id, '')), '')
      when nullif(trim(coalesce(p_external_id, '')), '') is not null then external_id
      else null
    end,
    ultimo_error = case when p_publicada then null else left(coalesce(p_error, 'Error de publicación sin detalle'), 1000) end,
    publicada_en = case when p_publicada then now() else publicada_en end,
    programada_para = case
      when not p_publicada and fila.intentos_publicacion < 3
        then now() + make_interval(mins => (5 * power(2, fila.intentos_publicacion - 1))::integer)
      else fila.programada_para end,
    claim_token = null, claimed_at = null, actualizado_en = now()
  where id = fila.id returning * into fila;
  insert into public.barbara_programacion_historial (
    programacion_id, barbara_cliente_id, accion, programada_antes,
    programada_despues, estado_antes, estado_despues, motivo, actor
  ) values (
    fila.id, fila.barbara_cliente_id, 'estado_cambiado', programada_antes,
    fila.programada_para, 'publicando', fila.estado,
    case when p_publicada then 'Respuesta publicada confirmada por el proveedor' else left(coalesce(p_error, 'Error sin detalle'), 1000) end,
    'barbara-worker'
  );
  return fila;
end;
$$;

-- Persiste el submission id ANTES de esperar el resultado. Si el polling se
-- corta o el runner cae, el siguiente intento consulta esa misma publicación
-- en vez de crear otra y arriesgar un duplicado externo.
create or replace function public.barbara_registrar_submission(
  p_programacion_id uuid,
  p_claim_token uuid,
  p_external_id text
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then raise exception 'Sólo servicio interno'; end if;
  if nullif(trim(coalesce(p_external_id, '')), '') is null then raise exception 'ID externo vacío'; end if;
  update public.barbara_programaciones set external_id = p_external_id, actualizado_en = now()
  where id = p_programacion_id and estado = 'publicando' and claim_token = p_claim_token;
  if not found then raise exception 'Claim inválido al registrar submission'; end if;
end;
$$;

-- Rescata claims abandonados por caída del runner. No publica nada: sólo los
-- devuelve a cola o los marca fallidos según el mismo máximo de intentos.
create or replace function public.barbara_recuperar_publicaciones_colgadas()
returns integer language plpgsql security definer set search_path = public as $$
declare total integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then raise exception 'Sólo servicio interno'; end if;
  update public.barbara_programaciones set
    estado = case when intentos_publicacion >= 3 then 'fallida' else 'programada' end,
    programada_para = case when intentos_publicacion < 3 then now() + interval '10 minutes' else programada_para end,
    ultimo_error = 'Claim recuperado tras 20 minutos sin finalización',
    claim_token = null, claimed_at = null, actualizado_en = now()
  where estado = 'publicando' and claimed_at < now() - interval '20 minutes';
  get diagnostics total = row_count;
  return total;
end;
$$;

revoke all on function public.barbara_reclamar_publicaciones(integer) from public, anon, authenticated;
grant execute on function public.barbara_reclamar_publicaciones(integer) to service_role;
revoke all on function public.barbara_finalizar_publicacion(uuid, uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.barbara_finalizar_publicacion(uuid, uuid, boolean, text, text) to service_role;
revoke all on function public.barbara_registrar_submission(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.barbara_registrar_submission(uuid, uuid, text) to service_role;
revoke all on function public.barbara_recuperar_publicaciones_colgadas() from public, anon, authenticated;
grant execute on function public.barbara_recuperar_publicaciones_colgadas() to service_role;

create or replace function public.barbara_configurar_auto_publicar(
  p_canal_id uuid,
  p_auto_publicar boolean
) returns public.barbara_canales
language plpgsql security definer set search_path = public
as $$
declare
  fila public.barbara_canales;
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  select * into fila from public.barbara_canales where id = p_canal_id for update;
  if not found then raise exception 'Canal no encontrado'; end if;
  if not public.es_admin() and not exists (
    select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
    where bc.id = fila.barbara_cliente_id and lower(c.email) = actor_email
  ) then raise exception 'Sin acceso a este canal'; end if;
  if p_auto_publicar and not fila.activo then raise exception 'No se puede automatizar un canal inactivo'; end if;
  update public.barbara_canales set
    auto_publicar = p_auto_publicar,
    aprobado_por = case when p_auto_publicar then coalesce(nullif(actor_email, ''), 'staff') else aprobado_por end,
    aprobado_en = case when p_auto_publicar then now() else aprobado_en end,
    actualizado_en = now()
  where id = fila.id returning * into fila;
  if fila.auto_publicar then
    update public.barbara_programaciones set canal_id = fila.id, actualizado_en = now()
    where barbara_cliente_id = fila.barbara_cliente_id
      and plataforma = fila.plataforma and estado = 'programada'
      and canal_id is null;
  end if;
  insert into public.barbara_eventos (barbara_cliente_id, tipo, actor, fuente_tipo, fuente_id, payload)
  values (fila.barbara_cliente_id, 'auto_publicar_configurado',
    coalesce(nullif(actor_email, ''), 'staff'), 'canal', fila.id::text,
    jsonb_build_object('plataforma', fila.plataforma, 'auto_publicar', fila.auto_publicar));
  return fila;
end;
$$;

create or replace function public.barbara_configurar_zona_horaria(
  p_barbara_cliente_id uuid,
  p_zona_horaria text
) returns text
language plpgsql security definer set search_path = public
as $$
declare actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if not exists (select 1 from pg_timezone_names where name = p_zona_horaria) then
    raise exception 'Zona horaria no válida';
  end if;
  if not public.es_admin() and not exists (
    select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
    where bc.id = p_barbara_cliente_id and lower(c.email) = actor_email
  ) then raise exception 'Sin acceso a esta configuración'; end if;
  update public.barbara_clientes set zona_horaria = p_zona_horaria where id = p_barbara_cliente_id;
  return p_zona_horaria;
end;
$$;

revoke all on function public.barbara_configurar_auto_publicar(uuid, boolean) from public;
grant execute on function public.barbara_configurar_auto_publicar(uuid, boolean) to authenticated;
revoke all on function public.barbara_configurar_zona_horaria(uuid, text) from public;
grant execute on function public.barbara_configurar_zona_horaria(uuid, text) to authenticated;

comment on table public.barbara_canales is
  'Mapeo de canales por cliente. auto_publicar nace false y requiere activación explícita.';
