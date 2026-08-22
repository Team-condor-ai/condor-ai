-- Cóndor AI · importar la cartola del banco a la contabilidad.
--
-- POR QUÉ LAS LÍNEAS DEL BANCO SE GUARDAN, Y NO SOLO SUS ASIENTOS
-- ---------------------------------------------------------------------------
-- El asiento dice lo que decidimos anotar; la cartola dice lo que el banco
-- hizo. Son dos cosas distintas y hay que poder compararlas. Guardar la línea
-- cruda permite tres cosas que un asiento suelto no permite: reimportar el
-- mismo archivo sin duplicar nada, mostrar qué movimiento del banco todavía no
-- está contabilizado, y detectar que un gasto se anotó a mano por un monto
-- distinto al que el banco cobró de verdad.

-- La comisión por compra en el extranjero llega días después del cargo y sin
-- decir a cuál corresponde, así que no se puede repartir entre las compras.
-- Vive en su propia cuenta: ahí se ve cuánto cuesta pagar en dólares.
-- (5106 ya estaba tomado por Servicios básicos.)
insert into public.cuentas (codigo, nombre, tipo, corriente, liquida, orden)
values ('5107', 'Gastos bancarios y cambio internacional', 'gasto', true, false, 195)
on conflict (codigo) do nothing;

create table if not exists public.movimientos_banco (
  id                uuid primary key default gen_random_uuid(),
  cuenta_banco_id   uuid not null references public.cuentas(id),
  fecha             date not null,
  detalle           text not null,
  cargo             bigint not null default 0 check (cargo >= 0),
  abono             bigint not null default 0 check (abono >= 0),
  -- El saldo que imprime la cartola en esa fila, cuando lo trae. Es el testigo
  -- que usa el importador: si el saldo recalculado no coincide, el PDF se leyó
  -- mal y no se importa nada.
  saldo_cartola     bigint,
  -- Desempata dos líneas idénticas el mismo día (dos cargos iguales existen).
  orden_en_dia      integer not null default 0,
  archivo           text,
  periodo_desde     date,
  periodo_hasta     date,
  asiento_id        uuid references public.asientos(id) on delete set null,
  estado            text not null default 'pendiente'
                      check (estado in ('pendiente','contabilizado','conciliado','ignorado')),
  nota              text,
  importado_en      timestamptz not null default now(),

  -- Un movimiento es un cargo o un abono, nunca los dos.
  constraint movimientos_banco_una_pata check (cargo = 0 or abono = 0),
  constraint movimientos_banco_tiene_monto check (cargo > 0 or abono > 0)
);

-- LA IDENTIDAD DE UNA LÍNEA DE CARTOLA
-- ---------------------------------------------------------------------------
-- La cartola del Banco de Chile no trae número de documento (esa columna viene
-- vacía), así que no hay un id que venga del banco. La identidad se arma con
-- lo que sí hay: fecha, glosa, monto y la posición dentro del día, que es lo
-- único que distingue dos cargos idénticos del mismo día. Esto es lo que hace
-- que reimportar el mismo archivo no duplique nada.
--
-- Va como índice y no como columna generada a propósito: `fecha::text` no es
-- inmutable —depende de DateStyle— y Postgres rechaza generarla.
create unique index if not exists movimientos_banco_identidad_idx
  on public.movimientos_banco (cuenta_banco_id, fecha, detalle, cargo, abono, orden_en_dia);

create index if not exists movimientos_banco_fecha_idx
  on public.movimientos_banco (fecha desc);

create index if not exists movimientos_banco_estado_idx
  on public.movimientos_banco (estado) where estado = 'pendiente';

alter table public.movimientos_banco enable row level security;
drop policy if exists "admin_all_movimientos_banco" on public.movimientos_banco;
create policy "admin_all_movimientos_banco" on public.movimientos_banco
  for all using (public.es_admin()) with check (public.es_admin());

comment on table public.movimientos_banco is
  'Líneas crudas de la cartola del banco, para conciliar contra los asientos.';

-- CÓMO SE ADIVINA LA CUENTA DE CADA LÍNEA
-- ---------------------------------------------------------------------------
-- Una cartola dice "PAGO:ANTHROPIC* CLAUDE", no dice "Herramientas y
-- software". La traducción se aprende una vez y se reusa: cada regla es un
-- texto que, si aparece en el detalle, propone una cuenta. El importador
-- propone; la persona confirma. Nunca se contabiliza sola.
--
-- El caso de Meta cae acá sin código especial: su regla apunta a 2104 (el
-- pasivo), así que el cargo del banco CANCELA la deuda que dejó el sync de
-- Meta en vez de crear un gasto nuevo. Sin eso, la misma publicidad quedaría
-- contada dos veces: una por la API de Meta y otra por la cartola.
create table if not exists public.reglas_banco (
  id           uuid primary key default gen_random_uuid(),
  patron       text not null unique,
  cuenta_id    uuid not null references public.cuentas(id),
  nota         text,
  veces_usada  integer not null default 0,
  creada_en    timestamptz not null default now()
);

alter table public.reglas_banco enable row level security;
drop policy if exists "admin_all_reglas_banco" on public.reglas_banco;
create policy "admin_all_reglas_banco" on public.reglas_banco
  for all using (public.es_admin()) with check (public.es_admin());

insert into public.reglas_banco (patron, cuenta_id, nota)
select v.patron, c.id, v.nota
from (values
  ('COMISION COMPRAS EN EL EXTRANJERO', '5107', 'Recargo del banco por pagar en moneda extranjera.'),
  ('ANTHROPIC',  '5103', 'Claude.'),
  ('HIGGSFIELD', '5103', 'Generación de video.'),
  ('OPENAI',     '5103', null),
  ('GOOGLE',     '5103', null),
  ('FACEBK',     '2104', 'Cancela el pasivo que dejó el sync de Meta: no es un gasto nuevo.'),
  ('FACEBOOK',   '2104', 'Cancela el pasivo que dejó el sync de Meta: no es un gasto nuevo.'),
  ('META PLATFORMS', '2104', 'Cancela el pasivo que dejó el sync de Meta: no es un gasto nuevo.')
) as v(patron, codigo, nota)
join public.cuentas c on c.codigo = v.codigo
on conflict (patron) do nothing;
