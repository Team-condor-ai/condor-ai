-- Bárbara · calendario editable, auditable y consciente de zona horaria.

alter table public.barbara_clientes
  add column if not exists zona_horaria text not null default 'America/Santiago';

alter table public.barbara_programaciones
  add column if not exists razon_planificacion text;

create table if not exists public.barbara_programacion_historial (
  id                    uuid primary key default gen_random_uuid(),
  programacion_id       uuid not null references public.barbara_programaciones(id) on delete cascade,
  barbara_cliente_id    uuid not null references public.barbara_clientes(id) on delete cascade,
  accion                text not null check (accion in ('creada', 'reprogramada', 'estado_cambiado')),
  programada_antes      timestamptz,
  programada_despues    timestamptz,
  estado_antes          text,
  estado_despues        text,
  motivo                text,
  actor                 text not null,
  creado_en             timestamptz not null default now()
);

create index if not exists barbara_programacion_historial_idx
  on public.barbara_programacion_historial (barbara_cliente_id, creado_en desc);
alter table public.barbara_programacion_historial enable row level security;

create or replace function public.barbara_registrar_programacion_creada()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.barbara_programacion_historial (
    programacion_id, barbara_cliente_id, accion, programada_despues,
    estado_despues, motivo, actor
  ) values (
    new.id, new.barbara_cliente_id, 'creada', new.programada_para,
    new.estado, new.razon_planificacion, coalesce(new.creado_por, 'barbara')
  );
  return new;
end;
$$;

drop trigger if exists barbara_programacion_creada on public.barbara_programaciones;
create trigger barbara_programacion_creada
after insert on public.barbara_programaciones
for each row execute function public.barbara_registrar_programacion_creada();

drop policy if exists "admin_barbara_programacion_historial" on public.barbara_programacion_historial;
create policy "admin_barbara_programacion_historial" on public.barbara_programacion_historial
  for all using (public.es_admin()) with check (public.es_admin());
drop policy if exists "cliente_ve_historial_programacion" on public.barbara_programacion_historial;
create policy "cliente_ve_historial_programacion" on public.barbara_programacion_historial
  for select using (exists (
    select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
    where bc.id = barbara_programacion_historial.barbara_cliente_id
      and lower(c.email) = lower((select auth.jwt() ->> 'email'))
  ));

-- Reemplaza la versión inicial: además de propiedad/estado, valida futuro,
-- evita choques accidentales y deja el antes/después para deshacer o auditar.
create or replace function public.barbara_reprogramar(
  p_programacion_id uuid,
  p_programada_para timestamptz,
  p_motivo text default null
) returns public.barbara_programaciones
language plpgsql security definer set search_path = public
as $$
declare
  fila public.barbara_programaciones;
  antes timestamptz;
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  select * into fila from public.barbara_programaciones where id = p_programacion_id for update;
  if not found then raise exception 'Programación no encontrada'; end if;
  if fila.estado not in ('borrador', 'programada') then
    raise exception 'Sólo se puede mover una pieza en borrador o programada';
  end if;
  if p_programada_para <= now() + interval '5 minutes' then
    raise exception 'La nueva hora debe quedar al menos 5 minutos en el futuro';
  end if;
  if not public.es_admin() and not exists (
    select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
    where bc.id = fila.barbara_cliente_id and lower(c.email) = actor_email
  ) then raise exception 'Sin acceso a esta programación'; end if;
  if exists (
    select 1 from public.barbara_programaciones otra
    where otra.barbara_cliente_id = fila.barbara_cliente_id
      and otra.id <> fila.id
      and otra.estado in ('borrador', 'programada', 'publicando')
      and abs(extract(epoch from (otra.programada_para - p_programada_para))) < 3600
  ) then raise exception 'Ya existe otra pieza a menos de una hora'; end if;

  antes := fila.programada_para;
  update public.barbara_programaciones set
    programada_para = p_programada_para,
    motivo_reprogramacion = nullif(trim(coalesce(p_motivo, '')), ''),
    actualizado_en = now()
  where id = fila.id returning * into fila;

  insert into public.barbara_programacion_historial (
    programacion_id, barbara_cliente_id, accion, programada_antes,
    programada_despues, estado_antes, estado_despues, motivo, actor
  ) values (
    fila.id, fila.barbara_cliente_id, 'reprogramada', antes,
    fila.programada_para, fila.estado, fila.estado,
    nullif(trim(coalesce(p_motivo, '')), ''),
    coalesce(nullif(actor_email, ''), 'staff')
  );
  return fila;
end;
$$;

create or replace function public.barbara_cambiar_estado_programacion(
  p_programacion_id uuid,
  p_estado text
) returns public.barbara_programaciones
language plpgsql security definer set search_path = public
as $$
declare
  fila public.barbara_programaciones;
  estado_anterior text;
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if p_estado not in ('programada', 'cancelada') then
    raise exception 'El cliente sólo puede programar o cancelar';
  end if;
  select * into fila from public.barbara_programaciones where id = p_programacion_id for update;
  if not found then raise exception 'Programación no encontrada'; end if;
  if fila.estado not in ('borrador', 'programada') then
    raise exception 'La pieza ya está en un estado irreversible desde el portal';
  end if;
  if p_estado = 'programada' and fila.programada_para <= now() + interval '5 minutes' then
    raise exception 'No se puede aprobar una hora vencida';
  end if;
  if not public.es_admin() and not exists (
    select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
    where bc.id = fila.barbara_cliente_id and lower(c.email) = actor_email
  ) then raise exception 'Sin acceso a esta programación'; end if;

  estado_anterior := fila.estado;
  update public.barbara_programaciones set estado = p_estado, actualizado_en = now()
  where id = fila.id returning * into fila;
  insert into public.barbara_programacion_historial (
    programacion_id, barbara_cliente_id, accion, programada_antes,
    programada_despues, estado_antes, estado_despues, actor
  ) values (
    fila.id, fila.barbara_cliente_id, 'estado_cambiado', fila.programada_para,
    fila.programada_para, estado_anterior, fila.estado,
    coalesce(nullif(actor_email, ''), 'staff')
  );
  return fila;
end;
$$;

revoke all on function public.barbara_reprogramar(uuid, timestamptz, text) from public;
grant execute on function public.barbara_reprogramar(uuid, timestamptz, text) to authenticated;
revoke all on function public.barbara_cambiar_estado_programacion(uuid, text) from public;
grant execute on function public.barbara_cambiar_estado_programacion(uuid, text) to authenticated;

comment on table public.barbara_programacion_historial is
  'Antes/después de cada movimiento o aprobación del calendario de Bárbara.';
