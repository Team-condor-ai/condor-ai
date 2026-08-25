-- La cuenta usada para Meta Ads es una TARJETA DE DÉBITO, no una deuda.
--
-- Los asientos ya marcados como pagados acreditaban esta cuenta; al pasarla
-- de pasivo a activo no líquido representan correctamente la salida desde el
-- débito corporativo y dejan de inflar el total de pasivos. No se borra ni se
-- reescribe ningún asiento: se conserva toda la trazabilidad.

update public.cuentas
set
  codigo = '1104',
  nombre = 'Tarjeta de débito corporativa',
  tipo = 'activo',
  corriente = true,
  liquida = false,
  orden = 35
where codigo = '2105';

insert into public.cuentas (codigo, nombre, tipo, corriente, liquida, orden)
values ('1104', 'Tarjeta de débito corporativa', 'activo', true, false, 35)
on conflict (codigo) do nothing;

notify pgrst, 'reload schema';
