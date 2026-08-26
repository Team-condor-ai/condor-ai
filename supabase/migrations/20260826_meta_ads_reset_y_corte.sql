-- Condor AI - reset del gasto de Meta Ads y fecha de corte.
--
-- POR QUE EXISTE ESTA MIGRACION
-- ---------------------------------------------------------------------------
-- El sync de Meta trajo agosto-2026 completo (23 dias, 3 campanas, 219.744
-- CLP) y ademas alguien liquido 21 de esos devengos con asientos manuales
-- "Pagado sin afectar el liquido" contra 1104 Tarjeta de debito corporativa.
-- Esa tarjeta nunca recibio un abono, asi que quedo en -202.536: un activo
-- negativo que arrastraba el balance. Resultado: el gasto se descontaba dos
-- veces de la lectura del mes (una por 5104 y otra por la tarjeta en rojo).
--
-- Decision de Max (26-ago-2026): agosto queda en CERO y la contabilidad de
-- Meta parte de nuevo el 1 de septiembre.
--
-- POR QUE BORRAR Y NO REVERSAR
-- ---------------------------------------------------------------------------
-- Un contra-asiento dejaria +219.744 y -219.744 conviviendo en el Desglose:
-- la cifra neta seria cero pero la pantalla mostraria ruido en ambas columnas,
-- que es justo lo que se pidio quitar. Estos asientos son devengo automatico,
-- no un pago real: no hay ningun movimiento de banco colgando de ellos (se
-- verifico antes de aplicar). Y son reconstruibles: basta bajar la fecha de
-- corte y volver a correr el sync.
--
-- LA FECHA DE CORTE NO ES DECORATIVA
-- ---------------------------------------------------------------------------
-- El workflow `meta-egresos.yml` relee 35 dias hacia atras todos los dias. Sin
-- una barrera en el propio RPC, agosto volveria a entrar manana por la manana
-- y el reset duraria menos de 24 horas. Por eso el corte vive en la base y lo
-- respeta `contabilizar_gasto_meta`, no un flag del script: cualquiera que
-- corra el sync a mano con --dias 90 choca igual contra el muro.

create table if not exists public.meta_ads_ajustes (
  -- Fila unica: el `check` sobre una PK booleana es la forma mas barata de
  -- garantizar que nunca existan dos configuraciones compitiendo.
  id                  boolean primary key default true check (id),
  contabilizar_desde  date not null,
  motivo              text,
  actualizado_en      timestamptz not null default now()
);

comment on table public.meta_ads_ajustes is
  'Configuracion unica del sync de Meta Ads. `contabilizar_desde` es la fecha a partir de la cual el gasto entra al libro; todo lo anterior se ignora.';

insert into public.meta_ads_ajustes (id, contabilizar_desde, motivo)
values (
  true,
  date '2026-09-01',
  'Reset 26-ago-2026: agosto queda en cero y Meta Ads parte limpio en septiembre.'
)
on conflict (id) do update set
  contabilizar_desde = excluded.contabilizar_desde,
  motivo = excluded.motivo,
  actualizado_en = now();

alter table public.meta_ads_ajustes enable row level security;

drop policy if exists "admin_all_meta_ads_ajustes" on public.meta_ads_ajustes;
create policy "admin_all_meta_ads_ajustes" on public.meta_ads_ajustes
  for all using (public.es_admin()) with check (public.es_admin());

grant select on public.meta_ads_ajustes to authenticated;

-- ---------------------------------------------------------------------------
-- EL RPC APRENDE A DECIR QUE NO
-- ---------------------------------------------------------------------------
-- Devuelve null (no lanza) cuando la fecha queda antes del corte: el sync
-- recorre cientos de filas y una excepcion abortaria la corrida entera por
-- dias viejos que justamente queremos ignorar. El script cuenta los saltados.

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
  v_corte date;
begin
  if p_fecha is null
     or nullif(trim(coalesce(p_cuenta_publicitaria, '')), '') is null
     or nullif(trim(coalesce(p_campana_id, '')), '') is null
     or coalesce(p_monto, 0) <= 0 then
    raise exception 'Datos incompletos para contabilizar gasto Meta';
  end if;

  select a.contabilizar_desde into v_corte from public.meta_ads_ajustes a where a.id;
  if v_corte is not null and p_fecha < v_corte then
    return null;
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

-- ---------------------------------------------------------------------------
-- LA LIMPIEZA
-- ---------------------------------------------------------------------------
-- Se borran los devengos anteriores al corte Y sus liquidaciones manuales. Sin
-- la segunda parte 1104 se quedaria con el haber de 202.536 y sin la
-- contrapartida: la tarjeta seguiria en rojo, que es el sintoma que se venia a
-- arreglar. `asiento_lineas` cae por cascada.

with corte as (
  select contabilizar_desde as desde from public.meta_ads_ajustes where id
), devengo as (
  select a.id
    from public.asientos a, corte
   where a.origen = 'meta_ads' and a.fecha < corte.desde
), liquidacion as (
  select a.id from public.asientos a where a.salda_asiento_id in (select id from devengo)
)
delete from public.asientos
 where id in (select id from liquidacion)
    or id in (select id from devengo);

delete from public.gastos_meta g
 using public.meta_ads_ajustes a
 where a.id and g.fecha < a.contabilizar_desde;
