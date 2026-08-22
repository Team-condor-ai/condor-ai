-- Cóndor AI · cuentas por cobrar reales y traspasos internos.
--
-- Antes, el trigger de pagos saltaba directo desde Banco/Mercado Pago a una
-- cuenta de ingreso. Eso reconocía bien una venta cobrada, pero hacía
-- imposible ver lo que los clientes todavía deben. Desde acá hay dos hechos:
--
--   Cobro emitido  · Debe 1201 Clientes por cobrar / Haber 4101 o 4102
--   Pago recibido  · Debe cuenta líquida (+ 5105 comisión) / Haber 1201
--
-- Un traspaso entre Mercado Pago y Banco solo mueve activo: no toca ingresos
-- ni gastos y se escribe completo dentro de una única transacción.

-- Registra o sincroniza la cuenta por cobrar de un cobro único. Los asientos
-- antiguos de pagos reconocían el ingreso de inmediato; su monto se descuenta
-- al migrar para no reconocer dos veces ventas históricas.
create or replace function public.contabilizar_cobro(p_cobro_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  c record;
  v_asiento uuid;
  v_cxc uuid;
  v_ingreso uuid;
  v_monto bigint;
  v_legado bigint;
begin
  select * into c from public.cobros where id = p_cobro_id;
  if c.id is null or c.tipo <> 'unico' or upper(coalesce(c.moneda, 'CLP')) <> 'CLP' then
    return;
  end if;

  select id into v_cxc from public.cuentas where codigo = '1201';
  select id into v_ingreso from public.cuentas where codigo = '4101';
  if v_cxc is null or v_ingreso is null then
    raise exception 'Faltan las cuentas contables 1201 o 4101';
  end if;

  select a.id into v_asiento
  from public.asientos a
  where a.referencia = 'cobro:' || c.id;

  -- Anular conserva el documento original y agrega su reversa. Así el libro
  -- explica qué pasó y 1201 deja de mostrar una deuda que ya no se cobrará.
  if c.estado = 'anulado' then
    if v_asiento is null or exists (
      select 1 from public.asientos where referencia = 'cobro-anulacion:' || c.id
    ) then return; end if;

    select coalesce(sum(al.debe), 0)::bigint into v_monto
    from public.asiento_lineas al
    where al.asiento_id = v_asiento and al.cuenta_id = v_cxc;
    if v_monto <= 0 then return; end if;

    insert into public.asientos (fecha, glosa, origen, referencia)
    values (current_date, 'Anulación · ' || coalesce(c.titulo, 'Cobro ' || c.numero),
      'cobro', 'cobro-anulacion:' || c.id)
    returning id into v_asiento;
    insert into public.asiento_lineas (asiento_id, cuenta_id, debe, haber) values
      (v_asiento, v_ingreso, v_monto, 0),
      (v_asiento, v_cxc, 0, v_monto);
    return;
  end if;

  if c.estado not in ('pendiente', 'pagado') or coalesce(c.monto, 0) <= 0 then
    return;
  end if;

  select coalesce(sum(p.monto), 0)::bigint into v_legado
  from public.pagos p
  where p.cobro_id = c.id
    and p.estado = 'pagado'
    and exists (
      select 1
      from public.asientos a
      join public.asiento_lineas al on al.asiento_id = a.id
      join public.cuentas cu on cu.id = al.cuenta_id
      where a.referencia = 'pago:' || p.id
        and cu.tipo = 'ingreso'
        and al.haber > 0
    );
  v_monto := greatest(c.monto::bigint - v_legado, 0);
  if v_monto <= 0 then return; end if;

  if v_asiento is null then
    insert into public.asientos (fecha, glosa, origen, referencia)
    values (coalesce(c.creado_en::date, current_date), coalesce(c.titulo, 'Cobro ' || c.numero),
      'cobro', 'cobro:' || c.id)
    returning id into v_asiento;
    insert into public.asiento_lineas (asiento_id, cuenta_id, debe, haber) values
      (v_asiento, v_cxc, v_monto, 0),
      (v_asiento, v_ingreso, 0, v_monto);
  else
    update public.asientos
      set glosa = coalesce(c.titulo, 'Cobro ' || c.numero)
      where id = v_asiento;
    update public.asiento_lineas
      set debe = v_monto, haber = 0
      where asiento_id = v_asiento and cuenta_id = v_cxc;
    update public.asiento_lineas
      set debe = 0, haber = v_monto
      where asiento_id = v_asiento and cuenta_id = v_ingreso;
  end if;
end $$;

revoke all on function public.contabilizar_cobro(uuid)
  from public, anon, authenticated;
grant execute on function public.contabilizar_cobro(uuid) to service_role;

create or replace function public.trg_contabilizar_cobro()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.contabilizar_cobro(new.id);
  return new;
end $$;

revoke all on function public.trg_contabilizar_cobro()
  from public, anon, authenticated;
drop trigger if exists cobro_a_contabilidad on public.cobros;
create trigger cobro_a_contabilidad
  after insert or update of monto, moneda, titulo, estado on public.cobros
  for each row execute function public.trg_contabilizar_cobro();

-- Reemplaza la versión original: ahora el pago cancela 1201 y registra en
-- Mercado Pago solo el neto que realmente quedó disponible. La diferencia va
-- a 5105 Comisiones de pago.
create or replace function public.contabilizar_pago(p_pago_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  p record;
  c record;
  v_asiento uuid;
  v_liquida uuid;
  v_cxc uuid;
  v_ingreso uuid;
  v_comision uuid;
  v_bruto bigint;
  v_neto bigint;
  v_costo bigint;
  v_es_mp boolean;
begin
  select * into p from public.pagos where id = p_pago_id;
  if p.id is null or p.estado <> 'pagado' or coalesce(p.monto, 0) <= 0 then return; end if;
  -- También hace idempotente al webhook y conserva intactos los asientos
  -- históricos creados por la versión anterior de esta función.
  if exists (select 1 from public.asientos where referencia = 'pago:' || p.id) then return; end if;

  select * into c from public.cobros where id = p.cobro_id;
  if c.id is null or upper(coalesce(c.moneda, 'CLP')) <> 'CLP' then return; end if;

  select id into v_cxc from public.cuentas where codigo = '1201';
  select id into v_comision from public.cuentas where codigo = '5105';
  v_es_mp := lower(coalesce(p.metodo, '')) like '%mercado%'
    or p.mp_id is not null or p.mp_net_received is not null;
  select id into v_liquida from public.cuentas where codigo = case
    when v_es_mp then '1103'
    when lower(coalesce(p.metodo, '')) like '%efectivo%' then '1101'
    else '1102' end;
  if v_cxc is null or v_liquida is null or v_comision is null then
    raise exception 'Faltan las cuentas contables 1201, 5105 o la cuenta líquida del pago';
  end if;

  v_bruto := round(p.monto)::bigint;
  if v_es_mp then
    v_neto := round(coalesce(
      p.mp_net_received,
      p.monto - coalesce(p.mp_fee_amount, 0),
      p.monto
    ))::bigint;
    v_neto := greatest(0, least(v_bruto, v_neto));
  else
    v_neto := v_bruto;
  end if;
  -- Usar bruto - neto incluye cualquier retención real de MP, no solo las
  -- filas que haya decidido detallar en fee_details.
  v_costo := v_bruto - v_neto;

  if c.tipo = 'mensual' then
    -- Cada mensualidad es una venta nueva. Se emite y cancela su propia cuenta
    -- por cobrar, identificada por el pago/periodo.
    select id into v_ingreso from public.cuentas where codigo = '4102';
    if v_ingreso is null then raise exception 'Falta la cuenta contable 4102'; end if;
    insert into public.asientos (fecha, glosa, origen, referencia, documento)
    values (coalesce(p.fecha, p.creado_en::date, current_date),
      coalesce(p.detalle, c.titulo, 'Mensualidad'), 'cobro',
      'pago-cxc:' || p.id, p.mp_id)
    returning id into v_asiento;
    insert into public.asiento_lineas (asiento_id, cuenta_id, debe, haber) values
      (v_asiento, v_cxc, v_bruto, 0),
      (v_asiento, v_ingreso, 0, v_bruto);
  else
    perform public.contabilizar_cobro(c.id);
  end if;

  insert into public.asientos (fecha, glosa, origen, referencia, documento)
  values (coalesce(p.fecha, p.creado_en::date, current_date),
    'Pago recibido · ' || coalesce(p.detalle, c.titulo, 'Cobro ' || c.numero),
    case when v_es_mp then 'mercadopago' else 'cobro' end,
    'pago:' || p.id, p.mp_id)
  returning id into v_asiento;

  if v_neto > 0 then
    insert into public.asiento_lineas (asiento_id, cuenta_id, debe, haber)
    values (v_asiento, v_liquida, v_neto, 0);
  end if;
  if v_costo > 0 then
    insert into public.asiento_lineas (asiento_id, cuenta_id, debe, haber)
    values (v_asiento, v_comision, v_costo, 0);
  end if;
  insert into public.asiento_lineas (asiento_id, cuenta_id, debe, haber)
  values (v_asiento, v_cxc, 0, v_bruto);
end $$;

revoke all on function public.contabilizar_pago(uuid)
  from public, anon, authenticated;
grant execute on function public.contabilizar_pago(uuid) to service_role;

-- Si MP devuelve el pago o informa un contracargo, la plata sale de la cuenta
-- líquida y vuelve a quedar como deuda del cliente. Solo se aplica a asientos
-- nuevos que efectivamente cancelaron 1201; no reescribe historia antigua.
create or replace function public.contabilizar_reembolso(p_pago_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  p record;
  v_asiento uuid;
  v_liquida uuid;
  v_cxc uuid;
  v_monto bigint;
begin
  select * into p from public.pagos where id = p_pago_id;
  if p.id is null then return; end if;
  v_monto := round(case
    when p.estado = 'contracargo' then p.monto
    else coalesce(p.mp_refunded_amount, 0)
  end)::bigint;
  v_monto := greatest(0, least(round(coalesce(p.monto, 0))::bigint, v_monto));
  if v_monto <= 0 then return; end if;

  select id into v_cxc from public.cuentas where codigo = '1201';
  if not exists (
    select 1 from public.asientos a
    join public.asiento_lineas al on al.asiento_id = a.id
    where a.referencia = 'pago:' || p.id
      and al.cuenta_id = v_cxc and al.haber > 0
  ) then return; end if;

  select id into v_liquida from public.cuentas where codigo = case
    when lower(coalesce(p.metodo, '')) like '%mercado%' or p.mp_id is not null then '1103'
    when lower(coalesce(p.metodo, '')) like '%efectivo%' then '1101'
    else '1102' end;
  select id into v_asiento from public.asientos where referencia = 'reembolso:' || p.id;

  if v_asiento is null then
    insert into public.asientos (fecha, glosa, origen, referencia, documento)
    values (current_date, 'Reembolso o contracargo · ' || coalesce(p.detalle, 'Pago'),
      'mercadopago', 'reembolso:' || p.id, p.mp_id)
    returning id into v_asiento;
    insert into public.asiento_lineas (asiento_id, cuenta_id, debe, haber) values
      (v_asiento, v_cxc, v_monto, 0),
      (v_asiento, v_liquida, 0, v_monto);
  else
    update public.asiento_lineas set debe = v_monto, haber = 0
      where asiento_id = v_asiento and cuenta_id = v_cxc;
    update public.asiento_lineas set debe = 0, haber = v_monto
      where asiento_id = v_asiento and cuenta_id = v_liquida;
  end if;
end $$;

revoke all on function public.contabilizar_reembolso(uuid)
  from public, anon, authenticated;
grant execute on function public.contabilizar_reembolso(uuid) to service_role;

create or replace function public.trg_contabilizar_pago()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'pagado' then
    perform public.contabilizar_pago(new.id);
  end if;
  if new.estado in ('reembolsado', 'reembolso_parcial', 'contracargo')
    or coalesce(new.mp_refunded_amount, 0) > 0 then
    perform public.contabilizar_reembolso(new.id);
  end if;
  return new;
end $$;

revoke all on function public.trg_contabilizar_pago()
  from public, anon, authenticated;
drop trigger if exists pago_a_contabilidad on public.pagos;
create trigger pago_a_contabilidad
  after insert or update of estado, mp_fee_amount, mp_net_received, mp_refunded_amount on public.pagos
  for each row execute function public.trg_contabilizar_pago();

-- Operación atómica para el popup "Mover fondos".
create or replace function public.registrar_traspaso_fondos(
  p_origen uuid,
  p_destino uuid,
  p_monto bigint,
  p_fecha date,
  p_glosa text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_asiento uuid;
  v_nombre_origen text;
  v_nombre_destino text;
begin
  if not public.es_admin() then raise exception 'No autorizado'; end if;
  if p_origen is null or p_destino is null or p_origen = p_destino then
    raise exception 'El origen y el destino deben ser cuentas distintas';
  end if;
  if coalesce(p_monto, 0) <= 0 then raise exception 'El monto debe ser mayor que cero'; end if;

  select nombre into v_nombre_origen from public.cuentas
    where id = p_origen and liquida and activa;
  select nombre into v_nombre_destino from public.cuentas
    where id = p_destino and liquida and activa;
  if v_nombre_origen is null or v_nombre_destino is null then
    raise exception 'Las dos cuentas deben ser líquidas y estar activas';
  end if;

  insert into public.asientos (fecha, glosa, origen, creado_por)
  values (
    coalesce(p_fecha, current_date),
    coalesce(nullif(trim(p_glosa), ''), 'Traspaso · ' || v_nombre_origen || ' → ' || v_nombre_destino),
    'traspaso',
    auth.jwt() ->> 'email'
  ) returning id into v_asiento;

  insert into public.asiento_lineas (asiento_id, cuenta_id, debe, haber) values
    (v_asiento, p_destino, p_monto, 0),
    (v_asiento, p_origen, 0, p_monto);
  return v_asiento;
end $$;

revoke all on function public.registrar_traspaso_fondos(uuid, uuid, bigint, date, text)
  from public, anon;
grant execute on function public.registrar_traspaso_fondos(uuid, uuid, bigint, date, text)
  to authenticated, service_role;

-- Lo pendiente al momento del despliegue aparece de inmediato en 1201. La
-- función descuenta lo que ya fue reconocido por el esquema anterior.
do $$ declare c record; begin
  for c in
    select id from public.cobros
    where tipo = 'unico' and estado in ('pendiente', 'pagado')
  loop
    perform public.contabilizar_cobro(c.id);
  end loop;
end $$;
