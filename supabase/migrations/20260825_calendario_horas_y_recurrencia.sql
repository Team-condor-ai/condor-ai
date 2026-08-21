-- Portal Cóndor · horas de tareas y series de reuniones.
--
-- Las tareas conservan fechas separadas para poder estirarlas por días en el
-- calendario. Las horas son opcionales y no interfieren con ese gesto.
alter table public.tareas
  add column if not exists inicio_hora time,
  add column if not exists vence_hora time;

-- Cada ocurrencia sigue siendo una reunión normal: así el calendario, RLS y
-- participantes funcionan igual. Las columnas de serie permiten reconocer y
-- administrar en conjunto reuniones creadas con varias reglas semanales.
alter table public.reuniones
  add column if not exists serie_id uuid,
  add column if not exists recurrencia_reglas jsonb,
  add column if not exists recurrencia_desde date,
  add column if not exists recurrencia_hasta date;

create index if not exists reuniones_serie_idx
  on public.reuniones (serie_id)
  where serie_id is not null;

comment on column public.reuniones.recurrencia_reglas is
  'Array de reglas {dia: 0..6, hora: HH:MM}; 0 es domingo.';
