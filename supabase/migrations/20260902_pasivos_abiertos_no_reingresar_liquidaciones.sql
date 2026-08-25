-- CÃ³ndor AI Â· un asiento que liquida un pasivo no es un pasivo nuevo.
--
-- "Marcar pagado" debita el pasivo original y acredita la tarjeta corporativa
-- para mantener el balance. Como la vista miraba cualquier haber en una cuenta
-- de pasivo, mostraba ese asiento de liquidaciÃ³n como una deuda nueva y ofrecÃ­a
-- marcarlo pagado de nuevo. Un asiento con `salda_asiento_id` solo liquida: no
-- puede volver a la bandeja de pasivos abiertos.

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
where a.salda_asiento_id is null
  and not exists (
    select 1 from public.asientos s where s.salda_asiento_id = a.id
  )
order by a.fecha desc;

notify pgrst, 'reload schema';
