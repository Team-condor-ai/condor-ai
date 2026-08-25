-- Cóndor AI · trazabilidad del cobro en otra moneda.
--
-- `cobros.monto`/`cobros.moneda` siguen siendo lo que se negoció con el
-- cliente (puede ser USD, COP...). Mercado Pago Chile solo cobra en CLP, así
-- que `crear-pago` convierte con el tipo de cambio del momento (misma tabla
-- que usa la función `tipo-cambio`) y deja acá el registro de a cuánto CLP
-- se cobró realmente y con qué tasa, para que quede trazable.

alter table public.cobros
  add column if not exists monto_clp_cobrado bigint,
  add column if not exists tasa_cambio_aplicada numeric,
  add column if not exists tasa_cambio_en timestamptz;

comment on column public.cobros.monto_clp_cobrado is
  'Lo que Mercado Pago cobró de verdad en CLP, cuando cobros.moneda no es CLP.';
comment on column public.cobros.tasa_cambio_aplicada is
  'Tipo de cambio (a CLP) usado en el último checkout generado para este cobro.';
comment on column public.cobros.tasa_cambio_en is
  'Cuándo se calculó esa conversión.';

notify pgrst, 'reload schema';
