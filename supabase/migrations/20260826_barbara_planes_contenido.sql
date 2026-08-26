-- Bárbara · planificación editorial creada desde el portal.
--
-- Una programación puede nacer de Bárbara (con una pieza ya generada) o de
-- una intención humana todavía sin contenido. Estas columnas guardan esa
-- intención sin fingir que el contenido ya existe. El motor enlaza la pieza
-- cuando la genera y conserva el mismo id/calendario.

alter table public.barbara_programaciones
  add column if not exists titulo text,
  add column if not exists brief text,
  add column if not exists configuracion jsonb not null default '{}'::jsonb,
  add column if not exists serie_id uuid,
  add column if not exists recurrencia_reglas jsonb,
  add column if not exists recurrencia_desde date,
  add column if not exists recurrencia_hasta date;

create index if not exists barbara_programaciones_serie_idx
  on public.barbara_programaciones (serie_id, programada_para)
  where serie_id is not null;

comment on column public.barbara_programaciones.configuracion is
  'Brief estructurado del formato: slides/plantilla, sticker de historia o tomas y ajustes UGC.';
comment on column public.barbara_programaciones.serie_id is
  'Agrupa las ocurrencias de una planificación semanal creada en el portal.';

create or replace function public.barbara_crear_planes(
  p_barbara_cliente_id uuid,
  p_tipo text,
  p_plataforma text,
  p_ocurrencias jsonb,
  p_zona_horaria text,
  p_titulo text,
  p_brief text default null,
  p_configuracion jsonb default '{}'::jsonb,
  p_recurrencia_reglas jsonb default null,
  p_recurrencia_desde date default null,
  p_recurrencia_hasta date default null
) returns setof public.barbara_programaciones
language plpgsql security definer set search_path = public
as $$
declare
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  instante text;
  fecha_programada timestamptz;
  cantidad integer;
  id_serie uuid;
  creada public.barbara_programaciones;
begin
  if p_tipo not in ('carrusel', 'historia', 'ugc') then
    raise exception 'Formato de contenido no válido';
  end if;
  if p_plataforma not in ('instagram', 'tiktok', 'facebook', 'linkedin') then
    raise exception 'Canal no válido';
  end if;
  if jsonb_typeof(coalesce(p_ocurrencias, 'null'::jsonb)) <> 'array' then
    raise exception 'Las fechas deben ser una lista';
  end if;
  cantidad := jsonb_array_length(p_ocurrencias);
  if cantidad < 1 or cantidad > 64 then
    raise exception 'Un plan debe contener entre 1 y 64 publicaciones';
  end if;
  if length(trim(coalesce(p_titulo, ''))) < 3 then
    raise exception 'Escribe un nombre para el plan';
  end if;
  if jsonb_typeof(coalesce(p_configuracion, '{}'::jsonb)) <> 'object'
     or octet_length(coalesce(p_configuracion, '{}'::jsonb)::text) > 16000 then
    raise exception 'La personalización del contenido no es válida';
  end if;
  if not public.es_admin() and not exists (
    select 1 from public.barbara_clientes bc
    join public.clientes c on c.id = bc.cliente_id
    where bc.id = p_barbara_cliente_id and lower(c.email) = actor_email
  ) then
    raise exception 'Sin acceso a esta Bárbara';
  end if;

  id_serie := case when cantidad > 1 then gen_random_uuid() else null end;

  for instante in select jsonb_array_elements_text(p_ocurrencias)
  loop
    begin
      fecha_programada := instante::timestamptz;
    exception when others then
      raise exception 'Una fecha del plan no es válida';
    end;
    if fecha_programada <= now() + interval '5 minutes' then
      raise exception 'Todas las publicaciones deben quedar en el futuro';
    end if;
    if exists (
      select 1 from public.barbara_programaciones p
      where p.barbara_cliente_id = p_barbara_cliente_id
        and p.estado in ('borrador', 'programada', 'publicando')
        and abs(extract(epoch from (p.programada_para - fecha_programada))) < 3600
    ) then
      raise exception 'Ya existe otra pieza a menos de una hora de %', fecha_programada;
    end if;

    insert into public.barbara_programaciones (
      barbara_cliente_id, tipo, plataforma, programada_para, estado,
      zona_horaria, razon_planificacion, creado_por, titulo, brief,
      configuracion, serie_id, recurrencia_reglas, recurrencia_desde,
      recurrencia_hasta
    ) values (
      p_barbara_cliente_id, p_tipo, p_plataforma, fecha_programada, 'borrador',
      coalesce(nullif(trim(p_zona_horaria), ''), 'America/Santiago'),
      case when cantidad > 1 then 'Serie semanal creada en el portal' else 'Plan creado en el portal' end,
      coalesce(nullif(actor_email, ''), 'staff'), left(trim(p_titulo), 180),
      nullif(left(trim(coalesce(p_brief, '')), 4000), ''), coalesce(p_configuracion, '{}'::jsonb),
      id_serie, case when cantidad > 1 then p_recurrencia_reglas else null end,
      case when cantidad > 1 then p_recurrencia_desde else null end,
      case when cantidad > 1 then p_recurrencia_hasta else null end
    ) returning * into creada;
    return next creada;
  end loop;
end;
$$;

create or replace function public.barbara_actualizar_plan(
  p_programacion_id uuid,
  p_plataforma text,
  p_titulo text,
  p_brief text default null,
  p_configuracion jsonb default '{}'::jsonb
) returns public.barbara_programaciones
language plpgsql security definer set search_path = public
as $$
declare
  fila public.barbara_programaciones;
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if p_plataforma not in ('instagram', 'tiktok', 'facebook', 'linkedin') then
    raise exception 'Canal no válido';
  end if;
  if length(trim(coalesce(p_titulo, ''))) < 3 then
    raise exception 'Escribe un nombre para el plan';
  end if;
  if jsonb_typeof(coalesce(p_configuracion, '{}'::jsonb)) <> 'object'
     or octet_length(coalesce(p_configuracion, '{}'::jsonb)::text) > 16000 then
    raise exception 'La personalización del contenido no es válida';
  end if;

  select * into fila from public.barbara_programaciones
  where id = p_programacion_id for update;
  if not found then raise exception 'Plan no encontrado'; end if;
  if fila.estado not in ('borrador', 'programada') then
    raise exception 'Este plan ya no se puede editar';
  end if;
  if not public.es_admin() and not exists (
    select 1 from public.barbara_clientes bc
    join public.clientes c on c.id = bc.cliente_id
    where bc.id = fila.barbara_cliente_id and lower(c.email) = actor_email
  ) then
    raise exception 'Sin acceso a este plan';
  end if;

  update public.barbara_programaciones set
    plataforma = p_plataforma,
    titulo = left(trim(p_titulo), 180),
    brief = nullif(left(trim(coalesce(p_brief, '')), 4000), ''),
    configuracion = coalesce(p_configuracion, '{}'::jsonb),
    actualizado_en = now()
  where id = fila.id returning * into fila;
  return fila;
end;
$$;

revoke all on function public.barbara_crear_planes(uuid,text,text,jsonb,text,text,text,jsonb,jsonb,date,date) from public;
grant execute on function public.barbara_crear_planes(uuid,text,text,jsonb,text,text,text,jsonb,jsonb,date,date) to authenticated;
revoke all on function public.barbara_actualizar_plan(uuid,text,text,text,jsonb) from public;
grant execute on function public.barbara_actualizar_plan(uuid,text,text,text,jsonb) to authenticated;
