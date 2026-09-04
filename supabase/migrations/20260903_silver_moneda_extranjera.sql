-- ════════════════════════════════════════════════════════════════════
-- Silver & Co: comisión de un cliente que factura en OTRA moneda.
--
-- Hasta ahora `ingresos_clientes` asumía CLP en silencio: Tecnobox
-- factura en pesos y nadie lo notó. Silver & Co es una joyería paraguaya
-- que factura en guaraníes, así que la venta que reporta Shopify viene en
-- PYG y la contabilidad de Cóndor va en CLP.
--
-- DECISIÓN: se guardan LAS DOS cifras y se convierte AL SINCRONIZAR, no
-- al mostrar. El PYG/CLP se movió 15,3% en el último año (rango
-- 0,1269-0,1570, Wise): si se convirtiera al mostrar, la comisión de
-- agosto cambiaría sola cada vez que alguien abre el Portal. Convertida
-- al momento del devengo, el histórico queda firme — mismo criterio que
-- `contabilizar_gasto_meta` usa para los USD de Meta Ads.
--
-- Los TRAMOS de cada cliente están en SU moneda: los de Silver en
-- guaraníes, los de Tecnobox en pesos. Por eso el % se calcula sobre la
-- venta original y recién después se convierte el resultado.
-- ════════════════════════════════════════════════════════════════════

-- ── Columnas nuevas, todas opcionales ────────────────────────────────
-- `moneda` con default 'CLP' deja a Tecnobox exactamente como estaba: sus
-- filas viejas quedan marcadas CLP y su tasa es 1.
alter table public.ingresos_clientes
  add column if not exists moneda text not null default 'CLP',
  add column if not exists tasa_a_clp numeric,
  add column if not exists venta_neta_clp bigint,
  add column if not exists comision_clp bigint;

comment on column public.ingresos_clientes.venta_neta_mes is
  'Venta neta del mes en la moneda del cliente (ver columna `moneda`).';
comment on column public.ingresos_clientes.venta_neta_clp is
  'La misma venta convertida a CLP con la tasa del día en que se sincronizó.';

-- Relleno de las filas que ya existían (Tecnobox, todas en CLP).
update public.ingresos_clientes
   set tasa_a_clp = 1,
       venta_neta_clp = venta_neta_mes,
       comision_clp = comision_calculada
 where tasa_a_clp is null;

-- ── El guaraní en la tabla de cambios ────────────────────────────────
-- 1 PYG = 0,1537 CLP (Wise, 3-sept-2026). Es una tasa de referencia
-- para conversión contable, no un precio de mercado en vivo: se
-- actualiza a mano igual que el resto de la tabla.
insert into public.tipos_cambio (moneda, a_clp, fuente)
values ('PYG', 0.1537, 'Wise 3-sept-2026')
on conflict (moneda) do update
  set a_clp = excluded.a_clp,
      fuente = excluded.fuente,
      actualizado_en = now();

-- ── Tramos de Silver & Co, en GUARANÍES ──────────────────────────────
-- Propuesta del 3-sept-2026, calibrada al ticket real de joyería en
-- plata en Paraguay (₲110.000-300.000 según el mercado local; se tomó
-- ₲180.000 de promedio). El 6% que pidió Joaquín queda como tramo de
-- ENTRADA y escala hasta 7,5%, mismo criterio que el resto de Cóndor
-- Ecommerce: más venta = más carga operativa.
--
-- `borrador = true` hasta que el cliente lo firme: mientras tanto, cada
-- asiento sale con la glosa "(provisional, tramos sin confirmar)".
insert into public.comision_tramos (cliente, minimo, maximo, porcentaje, piso_minimo, borrador)
select * from (values
  ('silver', 0::bigint,          15000000::bigint, 0.060, 350000::bigint, true),
  ('silver', 15000001::bigint,   35000000::bigint, 0.065, 350000::bigint, true),
  ('silver', 35000001::bigint,   60000000::bigint, 0.070, 350000::bigint, true),
  ('silver', 60000001::bigint,   null,             0.075, 350000::bigint, true)
) as t(cliente, minimo, maximo, porcentaje, piso_minimo, borrador)
where not exists (select 1 from public.comision_tramos where cliente = 'silver');

-- ── El RPC ahora acepta moneda ───────────────────────────────────────
-- Firma nueva con `p_moneda` al final y default 'CLP': las llamadas que
-- ya existen (el script de Tecnobox) siguen funcionando sin tocarlas.
--
-- ⚠️ Se BORRA primero la versión de 4 argumentos. `create or replace` con
-- un parámetro extra NO reemplaza: crea una segunda función sobrecargada,
-- y entonces una llamada con 4 argumentos queda ambigua entre las dos
-- (la vieja, y la nueva usando su default). Postgres responde
-- "function is not unique" y la sincronización de Tecnobox se cae.
drop function if exists public.contabilizar_comision_cliente(text, text, bigint, jsonb);

create or replace function public.contabilizar_comision_cliente(
  p_cliente text,
  p_mes text,
  p_venta_neta bigint,
  p_datos jsonb default '{}'::jsonb,
  p_moneda text default 'CLP'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ingreso_id uuid;
  v_asiento_id uuid;
  v_ingreso_cuenta uuid;
  v_cobrar_cuenta uuid;
  v_pct numeric;
  v_borrador boolean;
  v_piso bigint;
  v_calculado bigint;
  v_comision bigint;
  v_aplico_piso boolean;
  v_referencia text;
  v_nombre_cliente text;
  v_moneda text;
  v_tasa numeric;
  v_venta_clp bigint;
  v_comision_clp bigint;
  v_glosa_moneda text;
begin
  if nullif(trim(coalesce(p_cliente, '')), '') is null
     or p_mes !~ '^\d{4}-\d{2}$'
     or coalesce(p_venta_neta, 0) < 0 then
    raise exception 'Datos incompletos para contabilizar comisión de cliente';
  end if;

  v_moneda := upper(nullif(trim(coalesce(p_moneda, '')), ''));
  if v_moneda is null then
    v_moneda := 'CLP';
  end if;

  if v_moneda = 'CLP' then
    v_tasa := 1;
  else
    select tc.a_clp into v_tasa from public.tipos_cambio tc where tc.moneda = v_moneda;
  end if;
  if v_tasa is null then
    raise exception 'No existe tipo de cambio a CLP para %', v_moneda;
  end if;

  -- El tramo se busca contra la venta EN SU MONEDA: los tramos de Silver
  -- están en guaraníes. Convertir antes de buscar el tramo daría siempre
  -- el tramo más bajo.
  select porcentaje, piso_minimo, borrador
    into v_pct, v_piso, v_borrador
    from public.comision_tramos
   where cliente = p_cliente
     and vigente_desde <= current_date
     and p_venta_neta >= minimo
     and (maximo is null or p_venta_neta <= maximo)
   order by vigente_desde desc, minimo desc
   limit 1;

  if v_pct is null then
    raise exception 'No hay un tramo de comisión definido para % con venta neta %', p_cliente, p_venta_neta;
  end if;

  v_calculado := round(p_venta_neta * v_pct)::bigint;
  v_aplico_piso := v_calculado < v_piso;
  v_comision := greatest(v_calculado, v_piso);

  v_venta_clp := round(p_venta_neta * v_tasa)::bigint;
  v_comision_clp := round(v_comision * v_tasa)::bigint;

  select id into v_ingreso_cuenta from public.cuentas where codigo = '4103';
  select id into v_cobrar_cuenta from public.cuentas where codigo = '1201';
  if v_ingreso_cuenta is null or v_cobrar_cuenta is null then
    raise exception 'Faltan las cuentas contables 4103 o 1201';
  end if;

  v_nombre_cliente := initcap(replace(p_cliente, '_', ' '));

  insert into public.ingresos_clientes (
    cliente, mes, venta_neta_mes, tramo_pct, comision_calculada,
    aplico_piso, borrador, datos, moneda, tasa_a_clp, venta_neta_clp, comision_clp
  ) values (
    p_cliente, p_mes, p_venta_neta, v_pct, v_comision,
    v_aplico_piso, v_borrador, coalesce(p_datos, '{}'::jsonb),
    v_moneda, v_tasa, v_venta_clp, v_comision_clp
  )
  on conflict (cliente, mes) do update set
    venta_neta_mes = excluded.venta_neta_mes,
    tramo_pct = excluded.tramo_pct,
    comision_calculada = excluded.comision_calculada,
    aplico_piso = excluded.aplico_piso,
    borrador = excluded.borrador,
    datos = excluded.datos,
    moneda = excluded.moneda,
    tasa_a_clp = excluded.tasa_a_clp,
    venta_neta_clp = excluded.venta_neta_clp,
    comision_clp = excluded.comision_clp,
    sincronizado_en = now()
  returning id, asiento_id into v_ingreso_id, v_asiento_id;

  v_referencia := 'ingreso_cliente:' || p_cliente || ':' || p_mes;

  if v_asiento_id is null then
    insert into public.asientos (
      fecha, glosa, origen, referencia, documento, creado_por
    ) values (
      (p_mes || '-01')::date,
      'Comisión ' || v_nombre_cliente ||
        case when v_borrador then ' (provisional, tramos sin confirmar)' else '' end,
      'ingreso_cliente',
      v_referencia,
      p_mes,
      'sincronizacion_ecommerce'
    )
    on conflict (referencia) where referencia is not null do update set
      glosa = excluded.glosa
    returning id into v_asiento_id;

    update public.ingresos_clientes set asiento_id = v_asiento_id where id = v_ingreso_id;
  else
    update public.asientos set
      glosa = 'Comisión ' || v_nombre_cliente ||
        case when v_borrador then ' (provisional, tramos sin confirmar)' else '' end
    where id = v_asiento_id;
  end if;

  -- La glosa deja la moneda original a la vista: un asiento en CLP que
  -- salió de una venta en guaraníes tiene que poder auditarse sin abrir
  -- la tabla.
  v_glosa_moneda := case when v_moneda = 'CLP' then ''
    else ' · ' || v_moneda || ' ' || p_venta_neta::text ||
         ' @ ' || v_tasa::text || ' CLP' end;

  -- Se reemplazan las líneas cada vez: el mes en curso se revisa a
  -- diario mientras la venta neta sigue subiendo, igual que Meta Ads.
  delete from public.asiento_lineas where asiento_id = v_asiento_id;
  insert into public.asiento_lineas (
    asiento_id, cuenta_id, debe, haber, detalle
  ) values
    (v_asiento_id, v_cobrar_cuenta, v_comision_clp, 0,
      v_nombre_cliente || ' · venta neta ' || v_venta_clp::text || ' CLP' ||
        ' · ' || round(v_pct * 100, 2)::text || '%' ||
        case when v_aplico_piso then ' (aplicó piso mínimo)' else '' end ||
        v_glosa_moneda),
    (v_asiento_id, v_ingreso_cuenta, 0, v_comision_clp,
      'Comisión devengada, ' || v_nombre_cliente || ' ' || p_mes);

  return v_ingreso_id;
end;
$$;

revoke all on function public.contabilizar_comision_cliente(text, text, bigint, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.contabilizar_comision_cliente(text, text, bigint, jsonb, text)
  to service_role;
