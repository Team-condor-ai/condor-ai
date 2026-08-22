-- Cóndor AI · una tarea puede vivir solo en el tablero.
--
-- `inicio` y `vence` ya eran anulables. Esta migración completa las columnas
-- horarias que producción todavía no tenía y deja explícita la regla: una
-- hora nunca existe sin alguna fecha a la cual pertenecer.

alter table public.tareas
  add column if not exists inicio_hora time,
  add column if not exists vence_hora time;

update public.tareas
set inicio_hora = null,
    vence_hora = null
where inicio is null and vence is null
  and (inicio_hora is not null or vence_hora is not null);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.tareas'::regclass
      and conname = 'tareas_horas_requieren_fecha'
  ) then
    alter table public.tareas
      add constraint tareas_horas_requieren_fecha
      check (
        (inicio is not null or vence is not null)
        or (inicio_hora is null and vence_hora is null)
      ) not valid;
  end if;
end $$;

alter table public.tareas validate constraint tareas_horas_requieren_fecha;

comment on column public.tareas.inicio_hora is
  'Hora opcional. Sin inicio/vence la tarea pertenece únicamente al tablero.';
comment on column public.tareas.vence_hora is
  'Hora opcional de término de una tarea agendada.';

-- PostgREST conserva un caché de columnas. El NOTIFY evita que el formulario
-- siga respondiendo “column not found in schema cache” después del ALTER.
notify pgrst, 'reload schema';
