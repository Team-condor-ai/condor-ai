-- 24-oct-2026 · Nombres completos + apodos (pedido de Max).
-- · `admins.nombre` = nombre y apellido: es lo que ven los clientes (chat) y el equipo en todo el portal.
-- · `admins.apodo`  = el usuario informal, que cada uno elige en «Mi cuenta».
-- · Las tareas y los leads se asignan por el NOMBRE DE PILA (primera palabra de `nombre`), no por el apodo:
--   el apodo cambia cuando cada uno quiera y no puede descolgar lo asignado.
update public.admins set nombre = v.nombre, apodo = v.apodo
from (values
  ('joaquinsolopc@gmail.com', 'Joaquín Bustamante', 'orkut'),
  ('maximilianopinocv@gmail.com', 'Maximiliano Pino', 'oso'),
  ('klfuvega@gmail.com', 'Kalfu Vega', 'kalfu'),
  ('ahu3rta8888@gmail.com', 'Alberto Huerta', 'shadowblade'),
  ('alejandrotobarq@gmail.com', 'Alejandro Tobar', 'Xanax_gamer')
) as v(email, nombre, apodo)
where lower(public.admins.email) = v.email;

-- Cada persona del equipo puede cambiar su propio apodo (las demás columnas siguen igual).
create or replace function public.cambiar_mi_apodo(nuevo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'solo el equipo'; end if;
  update admins set apodo = nullif(btrim(left(nuevo, 40)), '') where lower(email) = lower((select auth.jwt() ->> 'email'));
end $$;
revoke execute on function public.cambiar_mi_apodo(text) from public, anon;
grant execute on function public.cambiar_mi_apodo(text) to authenticated;

-- El ranking devuelve nombre completo + apodo, y cruza las tareas por nombre de pila.
drop function if exists public.ranking_equipo(timestamptz);
create function public.ranking_equipo(desde timestamptz default '-infinity')
returns table (
  email text, nombre text, apodo text,
  leads_avanzados int, leads_ganados int, contactos int, tareas int,
  lecciones int, cursos int, minutos int, dias int, puntos int
)
language plpgsql stable security definer set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.es_admin() then raise exception 'solo el equipo'; end if;
  return query
  with eq as (
    select lower(a.email) as email, coalesce(nullif(a.nombre, ''), split_part(a.email, '@', 1)) as nombre, a.apodo,
           split_part(coalesce(nullif(a.nombre, ''), a.email), ' ', 1) as pila
    from admins a
  ),
  ev as (
    select lower(e.autor) as email, e.lead_id, e.tipo, e.a_etapa, e.creado_en
    from lead_eventos e where e.creado_en >= desde and e.autor like '%@%'
  ),
  av as (
    select ev.email,
      count(*) filter (where ev.tipo = 'etapa' and ev.a_etapa in ('contactado', 'reunion', 'propuesta', 'ganado'))::int as avanzados,
      count(distinct ev.lead_id) filter (where ev.tipo = 'etapa' and ev.a_etapa = 'ganado')::int as ganados,
      count(*) filter (where ev.tipo in ('nota', 'llamada', 'whatsapp', 'correo', 'reunion'))::int as contactos
    from ev group by ev.email
  ),
  ta as (
    select eq.email, count(*)::int as hechas
    from tareas t join eq on eq.pila = any(t.asignados) or eq.email = lower(t.creado_por) and coalesce(cardinality(t.asignados), 0) = 0
    where t.estado = 'hecha' and t.hecha_en >= desde
    group by eq.email
  ),
  le as (select lower(p.email) as email, count(*)::int as vistas from curso_progreso p where p.hecha_en >= desde group by 1),
  cu as (
    select x.email, count(*)::int as completos from (
      select lower(p.email) as email, l.curso_id, max(p.hecha_en) as fin, count(*) as n
      from curso_progreso p join lecciones l on l.id = p.leccion_id group by 1, 2
    ) x join (select curso_id, count(*) as total from lecciones group by 1) t on t.curso_id = x.curso_id
    where x.n >= t.total and x.fin >= desde group by x.email
  ),
  mi as (
    select lower(a.email) as email, (sum(least(a.segundo, greatest(a.total, a.segundo))) / 60)::int as minutos
    from curso_avance a where a.actualizado_en >= desde group by 1
  ),
  di as (
    select y.email, count(distinct y.dia)::int as dias from (
      select ev.email, (ev.creado_en at time zone 'America/Santiago')::date as dia from ev
      union all select lower(p.email), (p.hecha_en at time zone 'America/Santiago')::date from curso_progreso p where p.hecha_en >= desde
      union all select lower(a.email), (a.actualizado_en at time zone 'America/Santiago')::date from curso_avance a where a.actualizado_en >= desde
    ) y group by y.email
  )
  select eq.email, eq.nombre, eq.apodo,
    coalesce(av.avanzados, 0), coalesce(av.ganados, 0), coalesce(av.contactos, 0), coalesce(ta.hechas, 0),
    coalesce(le.vistas, 0), coalesce(cu.completos, 0), coalesce(mi.minutos, 0), coalesce(di.dias, 0),
    ( coalesce(av.ganados, 0) * 50 + coalesce(av.avanzados, 0) * 10 + coalesce(av.contactos, 0) * 3
    + coalesce(ta.hechas, 0) * 5 + coalesce(le.vistas, 0) * 4 + coalesce(cu.completos, 0) * 25 + coalesce(di.dias, 0) * 2 )::int
  from eq
  left join av on av.email = eq.email left join ta on ta.email = eq.email left join le on le.email = eq.email
  left join cu on cu.email = eq.email left join mi on mi.email = eq.email left join di on di.email = eq.email
  order by 12 desc, 2;
end $$;
revoke execute on function public.ranking_equipo(timestamptz) from public, anon;
grant execute on function public.ranking_equipo(timestamptz) to authenticated;

-- Insignias: las tareas se cruzan por nombre de pila (la columna se sigue llamando `apodo` dentro de la consulta).
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
  with eq as (select lower(a.email) as email, split_part(coalesce(nullif(a.nombre, ''), a.email), ' ', 1) as apodo from admins a),
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
