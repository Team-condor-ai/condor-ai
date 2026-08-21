-- Portal Cóndor · bloques de trabajo movibles y redimensionables.
--
-- `vence` ya era la fecha límite. `inicio` completa el intervalo: una tarea de
-- un solo día tiene inicio = vence; al estirarla solo cambia el final. Mantener
-- ambas fechas permite mover el bloque entero sin perder su duración.

alter table public.tareas add column if not exists inicio date;

update public.tareas
set inicio = vence
where inicio is null and vence is not null;

alter table public.tareas add constraint tareas_intervalo_ok
  check (inicio is null or vence is null or vence >= inicio)
  not valid;

alter table public.tareas validate constraint tareas_intervalo_ok;

create index if not exists tareas_inicio_idx
  on public.tareas (inicio) where estado <> 'hecha';
