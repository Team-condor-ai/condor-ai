-- Portal Cóndor · el catálogo de productos, a la altura de lo que se vende.
--
-- QUÉ LE FALTABA
-- ---------------------------------------------------------------------------
-- `productos` tenía nombre, descripción, características y dos precios
-- sugeridos. Con eso no se puede: decir si algo sigue a la venta, saber qué
-- margen deja, agrupar por familia, ni —lo más importante— saber quién lo está
-- pagando. Cada vez que alguien preguntaba "¿cuánto nos deja Bárbara Go?" había
-- que contarlo a mano.
--
-- LA PIEZA QUE FALTABA ERA EL VÍNCULO
-- ---------------------------------------------------------------------------
-- Un cobro ahora puede apuntar a un producto. Eso convierte al catálogo en algo
-- vivo: cuántos clientes lo pagan, cuánto recurrente sostiene, qué margen deja.
-- Sin ese vínculo el catálogo es un folleto.

-- ── 1) Estado real, no solo "activo" ──────────────────────────────────────
-- Un producto en borrador todavía no se vende; uno descontinuado no se vende
-- MÁS, pero sus clientes siguen pagándolo y no puede desaparecer del portal.
-- `activo` no distinguía esos dos casos.
alter table public.productos add column if not exists estado text not null default 'activo';
do $$ begin
  alter table public.productos add constraint productos_estado_ok
    check (estado in ('borrador','activo','descontinuado'));
exception when duplicate_object then null; end $$;

update public.productos set estado = case when activo is false then 'descontinuado' else 'activo' end
where estado is null or estado = '';

-- ── 2) Cómo se vende ──────────────────────────────────────────────────────
alter table public.productos add column if not exists familia   text;
alter table public.productos add column if not exists codigo    text;
alter table public.productos add column if not exists resumen   text;
-- Con qué frecuencia se cobra lo recurrente. 0 = es un pago único.
alter table public.productos add column if not exists frecuencia_meses int not null default 1;
-- Lo que cuesta entregarlo cada mes (licencias, créditos de IA, horas). Es lo
-- único que permite calcular margen, y sin margen el precio es una corazonada.
alter table public.productos add column if not exists costo_mensual int not null default 0;
alter table public.productos add column if not exists costo_setup   int not null default 0;
alter table public.productos add column if not exists orden int not null default 0;
alter table public.productos add column if not exists notas text;

create unique index if not exists productos_codigo_idx
  on public.productos (lower(codigo)) where codigo is not null;

-- ── 3) El vínculo con lo que se cobra ─────────────────────────────────────
-- `on delete set null`: borrar un producto del catálogo no puede borrar el
-- cobro de un cliente ni su historial de pagos.
alter table public.cobros
  add column if not exists producto_id uuid references public.productos(id) on delete set null;

create index if not exists cobros_producto_idx on public.cobros (producto_id);

-- ── 4) Qué rinde cada producto ────────────────────────────────────────────
-- Se calcula sobre los cobros VIVOS, no sobre los históricos: la pregunta es
-- "qué sostiene hoy", no "qué se vendió alguna vez".
create or replace view public.productos_rendimiento as
select
  p.id,
  p.nombre,
  p.estado,
  p.familia,
  count(distinct c.cliente_id) filter (
    where c.estado in ('activa','pendiente','pagado')
  ) as clientes,
  coalesce(sum(c.monto) filter (
    where c.tipo = 'mensual' and c.estado = 'activa'
  ), 0) as recurrente,
  coalesce(sum(pg.monto) filter (where pg.estado = 'pagado'), 0) as cobrado_historico
from public.productos p
left join public.cobros c on c.producto_id = p.id
left join public.pagos  pg on pg.cobro_id = c.id
group by p.id;
