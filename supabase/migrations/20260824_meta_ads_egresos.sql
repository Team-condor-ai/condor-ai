-- Condor AI - gastos de Meta Ads dentro de la contabilidad.
--
-- El gasto se reconoce cuando Meta lo devenga, no cuando cobra la tarjeta:
--   Debe  5104 Publicidad y campanas
--   Haber 2104 Meta Ads por pagar
--
-- Esto hace visible el costo real de las campanas sin reducir Banco dos veces.
-- Cuando llegue el cargo, el contador cancela 2104 contra Banco/Tarjeta.

insert into public.cuentas (codigo, nombre, tipo, corriente, liquida, orden)
values ('2104', 'Meta Ads por pagar', 'pasivo', true, false, 85)
on conflict (codigo) do update set
  nombre = excluded.nombre,
  tipo = excluded.tipo,
  corriente = excluded.corriente,
  liquida = excluded.liquida;

insert into public.cuentas (codigo, nombre, tipo, corriente, liquida, orden)
values ('5104', 'Publicidad y campanas', 'gasto', true, false, 170)
on conflict (codigo) do nothing;

create table if not exists public.gastos_meta (
  id                    uuid primary key default gen_random_uuid(),
  fecha                 date not null,
  cuenta_publicitaria   text not null,
  nombre_cuenta         text,
  campana_id            text not null,
  campana_nombre        text not null,
  monto_original        numeric(18, 4) not null check (monto_original >= 0),
  moneda_original       text not null,
  tasa_a_clp            numeric(18, 6) not null check (tasa_a_clp > 0),
  monto_clp             bigint not null check (monto_clp >= 0),
  asiento_id            uuid unique references public.asientos(id) on delete set null,
  datos                 jsonb not null default '{}'::jsonb,
  sincronizado_en       timestamptz not null default now(),
  unique (cuenta_publicitaria, campana_id, fecha)
);

create index if not exists gastos_meta_fecha_idx
  on public.gastos_meta (fecha desc);

alter table public.gastos_meta enable row level security;

drop policy if exists "admin_all_gastos_meta" on public.gastos_meta;
create policy "admin_all_gastos_meta" on public.gastos_meta
  for all using (public.es_admin()) with check (public.es_admin());

-- PostgREST tambien exige privilegio de tabla. RLS sigue limitando la lectura
-- al equipo mediante es_admin(); los clientes autenticados no ven estos datos.
grant select on public.gastos_meta to authenticated;

-- La llama exclusivamente el workflow con service_role. Hace el upsert y el
-- asiento en una sola transaccion, de modo que no puede quedar media partida.
create or replace function public.contabilizar_gasto_meta(
  p_fecha date,
  p_cuenta_publicitaria text,
  p_nombre_cuenta text,
  p_campana_id text,
  p_campana_nombre text,
  p_monto numeric,
  p_moneda text,
  p_datos jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gasto_id uuid;
  v_asiento_id uuid;
  v_gasto_cuenta uuid;
  v_por_pagar_cuenta uuid;
  v_moneda text := upper(trim(coalesce(p_moneda, '')));
  v_tasa numeric;
  v_monto_clp bigint;
  v_referencia text;
begin
  if p_fecha is null
     or nullif(trim(coalesce(p_cuenta_publicitaria, '')), '') is null
     or nullif(trim(coalesce(p_campana_id, '')), '') is null
     or coalesce(p_monto, 0) <= 0 then
    raise exception 'Datos incompletos para contabilizar gasto Meta';
  end if;

  if v_moneda = 'CLP' then
    v_tasa := 1;
  else
    select tc.a_clp into v_tasa
      from public.tipos_cambio tc
     where tc.moneda = v_moneda;
  end if;

  if v_tasa is null then
    raise exception 'No existe tipo de cambio a CLP para %', v_moneda;
  end if;

  v_monto_clp := round(p_monto * v_tasa)::bigint;
  if v_monto_clp <= 0 then
    raise exception 'El gasto convertido a CLP debe ser mayor que cero';
  end if;

  select id into v_gasto_cuenta from public.cuentas where codigo = '5104';
  select id into v_por_pagar_cuenta from public.cuentas where codigo = '2104';
  if v_gasto_cuenta is null or v_por_pagar_cuenta is null then
    raise exception 'Faltan las cuentas contables 5104 o 2104';
  end if;

  insert into public.gastos_meta (
    fecha, cuenta_publicitaria, nombre_cuenta, campana_id, campana_nombre,
    monto_original, moneda_original, tasa_a_clp, monto_clp, datos
  ) values (
    p_fecha, trim(p_cuenta_publicitaria), nullif(trim(coalesce(p_nombre_cuenta, '')), ''),
    trim(p_campana_id), trim(p_campana_nombre), p_monto, v_moneda,
    v_tasa, v_monto_clp, coalesce(p_datos, '{}'::jsonb)
  )
  on conflict (cuenta_publicitaria, campana_id, fecha) do update set
    nombre_cuenta = excluded.nombre_cuenta,
    campana_nombre = excluded.campana_nombre,
    monto_original = excluded.monto_original,
    moneda_original = excluded.moneda_original,
    tasa_a_clp = excluded.tasa_a_clp,
    monto_clp = excluded.monto_clp,
    datos = excluded.datos,
    sincronizado_en = now()
  returning id, asiento_id into v_gasto_id, v_asiento_id;

  v_referencia := 'meta:' || trim(p_cuenta_publicitaria) || ':' ||
    trim(p_campana_id) || ':' || p_fecha::text;

  if v_asiento_id is null then
    insert into public.asientos (
      fecha, glosa, origen, referencia, documento, creado_por
    ) values (
      p_fecha,
      'Meta Ads - ' || trim(p_campana_nombre),
      'meta_ads',
      v_referencia,
      trim(p_campana_id),
      'sincronizacion_meta'
    )
    on conflict (referencia) where referencia is not null do update set
      fecha = excluded.fecha,
      glosa = excluded.glosa,
      documento = excluded.documento
    returning id into v_asiento_id;

    update public.gastos_meta set asiento_id = v_asiento_id where id = v_gasto_id;
  else
    update public.asientos set
      fecha = p_fecha,
      glosa = 'Meta Ads - ' || trim(p_campana_nombre),
      documento = trim(p_campana_id)
    where id = v_asiento_id;
  end if;

  -- Meta puede ajustar el gasto del dia durante las horas siguientes. Se
  -- reemplazan ambas lineas para que el asiento conserve el valor definitivo.
  delete from public.asiento_lineas where asiento_id = v_asiento_id;
  insert into public.asiento_lineas (
    asiento_id, cuenta_id, debe, haber, detalle
  ) values
    (v_asiento_id, v_gasto_cuenta, v_monto_clp, 0,
      trim(p_campana_nombre) || ' (' || v_moneda || ' ' || p_monto::text || ')'),
    (v_asiento_id, v_por_pagar_cuenta, 0, v_monto_clp,
      'Gasto devengado por Meta Ads');

  return v_gasto_id;
end;
$$;

revoke all on function public.contabilizar_gasto_meta(
  date, text, text, text, text, numeric, text, jsonb
) from public, anon, authenticated;
grant execute on function public.contabilizar_gasto_meta(
  date, text, text, text, text, numeric, text, jsonb
) to service_role;
