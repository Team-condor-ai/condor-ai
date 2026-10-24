-- 24-oct-2026 · Ronda de mejoras del portal (pedido de Max).
-- 1. Solicitudes con seguimiento: quién la toma, qué se le respondió al cliente y cuándo cambió de estado.
-- 2. Cursos para clientes según su línea (Sites / Ecommerce / CRM): `cursos.lineas` vacío = todos los clientes.
-- 3. Insignias del ranking, calculadas en la base igual que los puntos.

-- 1 ───────────────────────────────────────────────────────────────────────────────────────────────
alter table public.solicitudes add column if not exists respuesta text;
alter table public.solicitudes add column if not exists responsable text;
alter table public.solicitudes add column if not exists en_curso_en timestamptz;
alter table public.solicitudes add column if not exists lista_en timestamptz;

create or replace function public.solicitudes_fechas() returns trigger
language plpgsql set search_path = public as $$
begin
  new.actualizado_en := now();
  if new.estado is distinct from old.estado then
    if new.estado = 'en_curso' and new.en_curso_en is null then new.en_curso_en := now(); end if;
    if new.estado = 'lista' then new.lista_en := now(); end if;
    if new.estado = 'nueva' then new.en_curso_en := null; new.lista_en := null; end if;
    if new.estado = 'en_curso' then new.lista_en := null; end if;
  end if;
  return new;
end $$;
drop trigger if exists solicitudes_fechas on public.solicitudes;
create trigger solicitudes_fechas before update on public.solicitudes for each row execute function public.solicitudes_fechas();

-- 2 ───────────────────────────────────────────────────────────────────────────────────────────────
alter table public.cursos add column if not exists lineas text[] not null default '{}';

-- ¿Este cliente (por su correo) puede ver este curso? Activo, curso para clientes y de su línea (o de todas).
-- Recibe texto: en Storage el id sale de la ruta del archivo y un cast a uuid fallaría con rutas raras.
create or replace function public.cliente_ve_curso(curso text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from cursos c join clientes cl on lower(cl.email) = lower((select auth.jwt() ->> 'email'))
    where c.id::text = curso and c.para_clientes and c.publicado and cl.archivado is not true
      and (cardinality(c.lineas) = 0 or cl.linea = any(c.lineas))
  )
$$;
revoke execute on function public.cliente_ve_curso(text) from public, anon;
grant execute on function public.cliente_ve_curso(text) to authenticated;

drop policy if exists cursos_clientes on public.cursos;
create policy cursos_clientes on public.cursos for select to authenticated using (public.cliente_ve_curso(id::text));
drop policy if exists lecciones_clientes on public.lecciones;
create policy lecciones_clientes on public.lecciones for select to authenticated using (public.cliente_ve_curso(curso_id::text));
drop policy if exists cursos_obj_clientes on storage.objects;
create policy cursos_obj_clientes on storage.objects for select to authenticated
  using (bucket_id = 'cursos' and public.cliente_ve_curso(split_part(name, '/', 1)));

drop policy if exists curso_fases_clientes on public.curso_fases;
create policy curso_fases_clientes on public.curso_fases for select to authenticated using (public.cliente_ve_curso(curso_id::text));

-- 3 ───────────────────────────────────────────────────────────────────────────────────────────────
-- Insignias por persona. `ganada_en` = cuándo se cumplió (para ordenar). Solo el equipo puede pedirlas.
create or replace function public.insignias_equipo()
returns table (email text, clave text, titulo text, detalle text, ganada_en timestamptz)
language plpgsql stable security definer set search_path = public
as $$
#variable_conflict use_column
declare
  inicio_mes timestamptz := date_trunc('month', now() at time zone 'America/Santiago') at time zone 'America/Santiago';
  inicio_semana timestamptz := date_trunc('week', now() at time zone 'America/Santiago') at time zone 'America/Santiago';
begin
  if not public.es_admin() then raise exception 'solo el equipo'; end if;
  return query
  with eq as (select lower(a.email) as email, coalesce(nullif(a.apodo, ''), a.nombre) as apodo from admins a),
  dias as (  -- días con actividad (hora de Chile)
    select distinct x.email, x.dia from (
      select lower(e.autor) as email, (e.creado_en at time zone 'America/Santiago')::date as dia from lead_eventos e where e.autor like '%@%'
      union all select lower(p.email), (p.hecha_en at time zone 'America/Santiago')::date from curso_progreso p
      union all select lower(v.email), (v.actualizado_en at time zone 'America/Santiago')::date from curso_avance v
      union all select eq.email, (t.hecha_en at time zone 'America/Santiago')::date from tareas t join eq on eq.apodo = any(t.asignados) where t.estado = 'hecha' and t.hecha_en is not null
    ) x where x.email in (select eq.email from eq)
  ),
  rachas as (  -- islas de días consecutivos
    select d.email, count(*) as largo, max(d.dia) as fin
    from (select dias.email, dias.dia, dias.dia - (row_number() over (partition by dias.email order by dias.dia))::int as grupo from dias) d
    group by d.email, d.grupo
  ),
  ganados as (
    select lower(e.autor) as email, e.lead_id, min(e.creado_en) as en
    from lead_eventos e where e.tipo = 'etapa' and e.a_etapa = 'ganado' and e.autor like '%@%' group by 1, 2
  ),
  cursos_ok as (
    select x.email, max(x.fin) as en from (
      select lower(p.email) as email, l.curso_id, max(p.hecha_en) as fin, count(*) as n
      from curso_progreso p join lecciones l on l.id = p.leccion_id group by 1, 2
    ) x join (select curso_id, count(*) as total from lecciones group by 1) t on t.curso_id = x.curso_id
    where x.n >= t.total group by x.email
  )
  -- Racha: 5 días seguidos con actividad, alguna vez
  select r.email, 'racha'::text, 'Racha de 5 días'::text, format('%s días seguidos con actividad', max(r.largo)),
         (max(r.fin)::timestamp at time zone 'America/Santiago')
  from rachas r where r.largo >= 5 group by r.email
  union all
  -- Primer cierre del mes: quien ganó el primer lead del mes
  select g.email, 'primer_cierre', 'Primer cierre del mes', 'Ganó el primer lead del mes', g.en
  from (select ganados.*, row_number() over (order by ganados.en) as n from ganados where ganados.en >= inicio_mes) g where g.n = 1
  union all
  -- Cerrador: 3 o más leads ganados en el mes
  select g.email, 'cerrador', 'Cerrador', format('%s leads ganados este mes', count(*)), max(g.en)
  from ganados g where g.en >= inicio_mes group by g.email having count(*) >= 3
  union all
  -- Motor: 15 o más avances de etapa en la semana
  select lower(e.autor), 'motor', 'Motor de la semana', format('%s leads movidos esta semana', count(*)), max(e.creado_en)
  from lead_eventos e where e.tipo = 'etapa' and e.a_etapa in ('contactado', 'reunion', 'propuesta', 'ganado') and e.creado_en >= inicio_semana and e.autor like '%@%'
  group by 1 having count(*) >= 15
  union all
  -- Estudioso: 10 lecciones en la semana
  select lower(p.email), 'estudioso', 'Estudioso', format('%s lecciones esta semana', count(*)), max(p.hecha_en)
  from curso_progreso p where p.hecha_en >= inicio_semana and lower(p.email) in (select eq.email from eq) group by 1 having count(*) >= 10
  union all
  -- Curso completo: terminó al menos un curso
  select c.email, 'curso_completo', 'Curso completo', 'Terminó un curso entero', c.en
  from cursos_ok c where c.email in (select eq.email from eq)
  union all
  -- Ejecutor: 10 tareas hechas en el mes
  select eq.email, 'ejecutor', 'Ejecutor', format('%s tareas hechas este mes', count(*)), max(t.hecha_en)
  from tareas t join eq on eq.apodo = any(t.asignados) where t.estado = 'hecha' and t.hecha_en >= inicio_mes
  group by eq.email having count(*) >= 10;
end $$;
revoke execute on function public.insignias_equipo() from public, anon;
grant execute on function public.insignias_equipo() to authenticated;
