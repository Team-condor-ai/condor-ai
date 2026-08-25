-- Cóndor AI · saldar pasivos ítem por ítem, con o sin tocar el líquido.
--
-- Antes un pasivo (ej. "Meta Ads por pagar") solo se cancelaba importando la
-- cartola bancaria a mano — si nadie lo hacía, quedaba inflado para siempre.
-- Esto agrega:
--
--  1) Una cuenta de pasivo nueva para la plata que ya se pagó por un medio
--     que el portal no rastrea como líquido (ej. tarjeta corporativa): así
--     "marcar pagado sin afectar el líquido" no le resta nada a la plata
--     disponible, y el Balance sigue cuadrado (el pasivo se reclasifica, no
--     desaparece).
--  2) Un puntero en `asientos` para saber qué asiento saldó a cuál: así
--     cualquier pasivo (no solo Meta Ads) se puede listar uno por uno,
--     abierto o saldado, en vez de solo ver un saldo acumulado.

insert into public.cuentas (codigo, nombre, tipo, corriente, liquida, orden)
values ('2105', 'Tarjeta de crédito corporativa', 'pasivo', true, false, 87)
on conflict (codigo) do nothing;

alter table public.asientos
  add column if not exists salda_asiento_id uuid references public.asientos(id);

create index if not exists asientos_salda_asiento_idx
  on public.asientos (salda_asiento_id) where salda_asiento_id is not null;

comment on column public.asientos.salda_asiento_id is
  'Si no es null, este asiento salda al asiento que originó un pasivo (ver vista pasivos_abiertos).';

-- Pasivos abiertos: cualquier asiento que subió el saldo de una cuenta de
-- pasivo (línea al haber) y que ningún otro asiento todavía referencia como
-- saldado. Es la fuente de la pestaña "Pasivos".
create or replace view public.pasivos_abiertos as
select
  a.id as asiento_id,
  a.fecha,
  a.glosa,
  c.id as cuenta_id,
  c.codigo as cuenta_codigo,
  c.nombre as cuenta_nombre,
  l.haber as monto
from public.asientos a
join public.asiento_lineas l on l.asiento_id = a.id and l.haber > 0
join public.cuentas c on c.id = l.cuenta_id and c.tipo = 'pasivo'
where not exists (
  select 1 from public.asientos s where s.salda_asiento_id = a.id
)
order by a.fecha desc;

notify pgrst, 'reload schema';
