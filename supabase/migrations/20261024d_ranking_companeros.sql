-- 24-oct-2026 · Ranking del equipo + «compañeros» en los cursos.
-- 1. `admins.apodo`: cómo se llama cada uno en el día a día (Max, Ale…). Es el mismo nombre que usan
--    `leads.responsable` y `tareas.asignados`, así el ranking cruza las tres cosas.
-- 2. `curso_avance`: en qué segundo de cada lección va cada persona (antes vivía solo en el navegador).
-- 3. El equipo ve el avance de todos en los cursos (`curso_progreso` y `curso_avance`); cada cliente, solo el suyo.
-- 4. `ranking_equipo(desde)`: puntos por persona desde una fecha. Solo lo puede pedir el equipo.
-- 5. Canal privado de Realtime `cursos-equipo` para saber quién está viendo qué lección en este momento.

alter table public.admins add column if not exists apodo text;
update public.admins set apodo = case lower(email)
  when 'maximilianopinocv@gmail.com' then 'Max'
  when 'alejandrotobarq@gmail.com' then 'Ale'
  when 'klfuvega@gmail.com' then 'Kalfu'
  when 'ahu3rta8888@gmail.com' then 'Alberto'
  when 'joaquinsolopc@gmail.com' then 'Joaquín'
  else apodo end
where apodo is null;

create table if not exists public.curso_avance (
  email text not null,
  leccion_id uuid not null references public.lecciones(id) on delete cascade,
  segundo integer not null default 0,
  total integer not null default 0,
  actualizado_en timestamptz not null default now(),
  primary key (email, leccion_id)
);
create index if not exists curso_avance_reciente on public.curso_avance (actualizado_en desc);
alter table public.curso_avance enable row level security;

drop policy if exists avance_propio on public.curso_avance;
create policy avance_propio on public.curso_avance for all to authenticated
  using (lower(email) = lower((select auth.jwt() ->> 'email')))
  with check (lower(email) = lower((select auth.jwt() ->> 'email')));
drop policy if exists avance_equipo_ve on public.curso_avance;
create policy avance_equipo_ve on public.curso_avance for select to authenticated using ((select public.es_admin()));

drop policy if exists progreso_equipo_ve on public.curso_progreso;
create policy progreso_equipo_ve on public.curso_progreso for select to authenticated using ((select public.es_admin()));

create or replace function public.ranking_equipo(desde timestamptz default '-infinity')
returns table (
  email text, nombre text,
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
    select lower(a.email) as email, coalesce(nullif(a.apodo, ''), nullif(a.nombre, ''), split_part(a.email, '@', 1)) as nombre
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
    from tareas t join eq on eq.nombre = any(t.asignados) or eq.email = lower(t.creado_por) and coalesce(cardinality(t.asignados), 0) = 0
    where t.estado = 'hecha' and t.hecha_en >= desde
    group by eq.email
  ),
  le as (
    select lower(p.email) as email, count(*)::int as vistas from curso_progreso p where p.hecha_en >= desde group by 1
  ),
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
  select eq.email, eq.nombre,
    coalesce(av.avanzados, 0), coalesce(av.ganados, 0), coalesce(av.contactos, 0), coalesce(ta.hechas, 0),
    coalesce(le.vistas, 0), coalesce(cu.completos, 0), coalesce(mi.minutos, 0), coalesce(di.dias, 0),
    ( coalesce(av.ganados, 0) * 50 + coalesce(av.avanzados, 0) * 10 + coalesce(av.contactos, 0) * 3
    + coalesce(ta.hechas, 0) * 5 + coalesce(le.vistas, 0) * 4 + coalesce(cu.completos, 0) * 25 + coalesce(di.dias, 0) * 2 )::int
  from eq
  left join av on av.email = eq.email left join ta on ta.email = eq.email left join le on le.email = eq.email
  left join cu on cu.email = eq.email left join mi on mi.email = eq.email left join di on di.email = eq.email
  order by 11 desc, 2;
end $$;
revoke execute on function public.ranking_equipo(timestamptz) from public, anon;
grant execute on function public.ranking_equipo(timestamptz) to authenticated;

-- Presencia en los cursos: solo el equipo entra al canal privado `cursos-equipo`.
drop policy if exists cursos_equipo_lee on realtime.messages;
create policy cursos_equipo_lee on realtime.messages for select to authenticated
  using ((select realtime.topic()) = 'cursos-equipo' and (select public.es_admin()));
drop policy if exists cursos_equipo_escribe on realtime.messages;
create policy cursos_equipo_escribe on realtime.messages for insert to authenticated
  with check ((select realtime.topic()) = 'cursos-equipo' and (select public.es_admin()));
