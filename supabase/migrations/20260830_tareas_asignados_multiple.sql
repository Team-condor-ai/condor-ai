-- Cóndor AI · una tarea puede tener más de un responsable.
--
-- `asignado_a` era texto libre de una sola persona. Sigue siendo texto libre
-- (no hay tabla de usuarios que ligar — se pidió así a propósito), pero ahora
-- puede haber varios.

alter table public.tareas add column if not exists asignados text[] not null default '{}';

update public.tareas
set asignados = array[asignado_a]
where asignado_a is not null and btrim(asignado_a) <> '' and asignados = '{}';

alter table public.tareas drop column if exists asignado_a;

comment on column public.tareas.asignados is
  'Responsables como texto libre (nombre o equipo), uno o varios. Sin tabla de usuarios detrás.';

notify pgrst, 'reload schema';
