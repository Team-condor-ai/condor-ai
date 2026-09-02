-- ════════════════════════════════════════════════════════════════════
-- Ingreso por comisión de clientes de ecommerce (Tecnobox, y los que se
-- sumen después — ej. Silver and Co, sin datos todavía).
--
-- Calca la arquitectura de gastos_meta / contabilizar_gasto_meta
-- (20260824_meta_ads_egresos.sql): un asiento por período, revisado cada
-- vez que se vuelve a sincronizar, nunca duplicado.
--
-- Diferencia clave: acá el % NO es fijo, es por TRAMOS de venta neta
-- mensual — así que el tramo vive en su propia tabla, editable sin tocar
-- código, y el cálculo lo hace el RPC (mismo criterio que usa
-- contabilizar_gasto_meta para el tipo de cambio: la regla de negocio
-- vive en la base, el script solo trae el dato externo).
-- ════════════════════════════════════════════════════════════════════

-- ── Cuenta contable nueva ────────────────────────────────────────────
insert into public.cuentas (codigo, nombre, tipo, corriente, liquida, activa, orden)
select '4103', 'Comisión por gestión de ecommerce', 'ingreso', true, false, true,
  (select coalesce(max(orden), 0) + 1 from public.cuentas)
where not exists (select 1 from public.cuentas where codigo = '4103');

-- ── Tramos de comisión, por cliente ──────────────────────────────────
-- `borrador = true` significa "todavía no lo confirmó el cliente" — se
-- refleja en la glosa de cada asiento para que nadie lea la contabilidad
-- y piense que es un número cerrado.
create table if not exists public.comision_tramos (
  id uuid primary key default gen_random_uuid(),
  cliente text not null,
  minimo bigint not null default 0,
  maximo bigint,                          -- null = sin techo (el tramo más alto)
  porcentaje numeric not null,            -- 0.045 = 4,5%
  piso_minimo bigint not null default 0,  -- comisión mínima del mes, aunque no se llegue al %
  borrador boolean not null default true,
  vigente_desde date not null default current_date,
  creado_en timestamptz not null default now(),
  check (porcentaje > 0 and porcentaje < 1),
  check (maximo is null or maximo > minimo)
);
create index if not exists comision_tramos_cliente on public.comision_tramos (cliente, minimo);

-- Tramos de Tecnobox: borrador recibido el 1-sept-2026 (planilla de
-- Joaquín). Verificado a mano que cada máximo × porcentaje da la
-- comisión de la planilla.
insert into public.comision_tramos (cliente, minimo, maximo, porcentaje, piso_minimo, borrador)
select * from (values
  ('tecnobox', 0::bigint,        11500000::bigint, 0.045, 50000::bigint, true),
  ('tecnobox', 11500001::bigint, 17500000::bigint, 0.050, 50000::bigint, true),
  ('tecnobox', 17500001::bigint, 25000000::bigint, 0.052, 50000::bigint, true),
  ('tecnobox', 25000001::bigint, 30500000::bigint, 0.055, 50000::bigint, true),
  ('tecnobox', 30500001::bigint, null,             0.057, 50000::bigint, true)
) as t(cliente, minimo, maximo, porcentaje, piso_minimo, borrador)
where not exists (select 1 from public.comision_tramos where cliente = 'tecnobox');

-- ── El ingreso mensual por cliente ───────────────────────────────────
create table if not exists public.ingresos_clientes (
  id uuid primary key default gen_random_uuid(),
  cliente text not null,
  mes text not null,                      -- 'YYYY-MM'
  venta_neta_mes bigint not null,
  tramo_pct numeric,
  comision_calculada bigint not null,
  aplico_piso boolean not null default false,
  borrador boolean not null default true,
  asiento_id uuid references public.asientos(id),
  datos jsonb default '{}'::jsonb,
  sincronizado_en timestamptz not null default now(),
  unique (cliente, mes)
);
create index if not exists ingresos_clientes_mes on public.ingresos_clientes (mes desc);

alter table public.comision_tramos enable row level security;
alter table public.ingresos_clientes enable row level security;
create policy comision_tramos_staff on public.comision_tramos
  for select using (auth.role() = 'authenticated');
create policy ingresos_clientes_staff on public.ingresos_clientes
  for select using (auth.role() = 'authenticated');

-- ── El RPC: recibe la venta neta del mes, calcula el tramo, contabiliza ──
create or replace function public.contabilizar_comision_cliente(
  p_cliente text,
  p_mes text,
  p_venta_neta bigint,
  p_datos jsonb default '{}'::jsonb
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
begin
  if nullif(trim(coalesce(p_cliente, '')), '') is null
     or p_mes !~ '^\d{4}-\d{2}$'
     or coalesce(p_venta_neta, 0) < 0 then
    raise exception 'Datos incompletos para contabilizar comisión de cliente';
  end if;

  -- El tramo se busca por el MÁXIMO de venta neta: minimo <= venta y
  -- (maximo is null o venta <= maximo). El más reciente vigente_desde
  -- que ya empezó, por si algún día cambian los tramos.
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

  select id into v_ingreso_cuenta from public.cuentas where codigo = '4103';
  select id into v_cobrar_cuenta from public.cuentas where codigo = '1201';
  if v_ingreso_cuenta is null or v_cobrar_cuenta is null then
    raise exception 'Faltan las cuentas contables 4103 o 1201';
  end if;

  v_nombre_cliente := initcap(replace(p_cliente, '_', ' '));

  insert into public.ingresos_clientes (
    cliente, mes, venta_neta_mes, tramo_pct, comision_calculada,
    aplico_piso, borrador, datos
  ) values (
    p_cliente, p_mes, p_venta_neta, v_pct, v_comision,
    v_aplico_piso, v_borrador, coalesce(p_datos, '{}'::jsonb)
  )
  on conflict (cliente, mes) do update set
    venta_neta_mes = excluded.venta_neta_mes,
    tramo_pct = excluded.tramo_pct,
    comision_calculada = excluded.comision_calculada,
    aplico_piso = excluded.aplico_piso,
    borrador = excluded.borrador,
    datos = excluded.datos,
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

  -- Se reemplazan las líneas cada vez: el mes en curso se revisa a
  -- diario mientras la venta neta sigue subiendo, igual que Meta Ads.
  delete from public.asiento_lineas where asiento_id = v_asiento_id;
  insert into public.asiento_lineas (
    asiento_id, cuenta_id, debe, haber, detalle
  ) values
    (v_asiento_id, v_cobrar_cuenta, v_comision, 0,
      v_nombre_cliente || ' · venta neta ' || p_venta_neta::text ||
        ' · ' || round(v_pct * 100, 2)::text || '%' ||
        case when v_aplico_piso then ' (aplicó piso mínimo)' else '' end),
    (v_asiento_id, v_ingreso_cuenta, 0, v_comision,
      'Comisión devengada, ' || v_nombre_cliente || ' ' || p_mes);

  return v_ingreso_id;
end;
$$;

revoke all on function public.contabilizar_comision_cliente(text, text, bigint, jsonb)
  from public, anon, authenticated;
grant execute on function public.contabilizar_comision_cliente(text, text, bigint, jsonb)
  to service_role;
