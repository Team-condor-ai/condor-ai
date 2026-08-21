-- Portal Cóndor · contabilidad de verdad, con partida doble.
--
-- POR QUÉ PARTIDA DOBLE Y NO UNA LISTA DE GASTOS
-- ---------------------------------------------------------------------------
-- Una lista de entradas y salidas responde "cuánto me queda" y nada más. No
-- sabe qué se debe, qué nos deben, ni cuánto vale la empresa. En cuanto
-- alguien pregunta por el patrimonio hay que rehacerlo todo.
--
-- Con partida doble cada movimiento toca DOS cuentas y siempre se cumple:
--
--     Activo = Pasivo + Patrimonio
--     Patrimonio = Capital + Resultados acumulados + Resultado del ejercicio
--     Resultado = Ingresos − Gastos
--
-- Eso no es un adorno académico: es lo que hace que los números cuadren solos
-- y que un contador pueda leerlos sin traducirlos.
--
-- LA COMPLEJIDAD NO SE LE PASA A QUIEN CARGA EL GASTO
-- ---------------------------------------------------------------------------
-- El portal ofrece "registrar un egreso" con dos campos, y arma el asiento por
-- detrás (Gasto al debe, Caja al haber). La partida doble está abajo, donde
-- tiene que estar; arriba se ve una salida de plata.

-- ───────────────────────────────────────────────────────────────────────────
-- 1) Plan de cuentas
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.cuentas (
  id        uuid primary key default gen_random_uuid(),
  codigo    text not null unique,
  nombre    text not null,
  -- Los cinco tipos de siempre. De acá salen todos los informes.
  tipo      text not null check (tipo in ('activo','pasivo','patrimonio','ingreso','gasto')),
  -- Corriente = se convierte en plata (o se paga) dentro del año. Es lo que
  -- separa el capital de trabajo del resto y lo que pide cualquier balance.
  corriente boolean not null default true,
  -- Marca las cuentas que SON plata disponible. El "cuánto tengo líquido" sale
  -- de sumar estas, no de adivinar por el nombre.
  liquida   boolean not null default false,
  activa    boolean not null default true,
  orden     int not null default 0
);

-- ───────────────────────────────────────────────────────────────────────────
-- 2) Asientos y sus líneas
--
-- El asiento es el hecho ("pagué el arriendo"); las líneas son a qué cuentas
-- fue. La regla de oro —la suma del debe iguala la del haber— se comprueba en
-- la vista `asientos_descuadrados`: si algo no cuadra, tiene que poder verse,
-- no quedar escondido.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.asientos (
  id          uuid primary key default gen_random_uuid(),
  fecha       date not null default current_date,
  glosa       text not null,
  -- De dónde salió: 'manual', 'cobro' (lo generó un pago del CRM), 'ratia'…
  origen      text not null default 'manual',
  referencia  text,
  documento   text,
  creado_por  text,
  creado_en   timestamptz not null default now()
);

create table if not exists public.asiento_lineas (
  id         uuid primary key default gen_random_uuid(),
  asiento_id uuid not null references public.asientos(id) on delete cascade,
  cuenta_id  uuid not null references public.cuentas(id),
  -- En pesos. Una línea es debe O haber, nunca las dos.
  debe       int not null default 0 check (debe >= 0),
  haber      int not null default 0 check (haber >= 0),
  detalle    text,
  constraint linea_debe_o_haber check ((debe = 0) <> (haber = 0))
);

create index if not exists asiento_lineas_asiento_idx on public.asiento_lineas (asiento_id);
create index if not exists asiento_lineas_cuenta_idx  on public.asiento_lineas (cuenta_id);
create index if not exists asientos_fecha_idx on public.asientos (fecha desc);

-- ───────────────────────────────────────────────────────────────────────────
-- 3) Gastos que se repiten
--
-- Sueldos, arriendo, herramientas. Se anotan una vez y el portal recuerda
-- cuáles del mes ya se registraron y cuáles no — que es la pregunta real de
-- fin de mes, no "cuánto gasté".
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.gastos_fijos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  monto       int not null default 0,
  moneda      text not null default 'CLP',
  cuenta_id   uuid references public.cuentas(id),
  dia_del_mes int check (dia_del_mes between 1 and 31),
  activo      boolean not null default true,
  notas       text,
  creado_en   timestamptz not null default now()
);

-- ───────────────────────────────────────────────────────────────────────────
-- 4) Saldos por cuenta — la base de todos los informes
--
-- El signo depende del tipo, y esto es contabilidad básica pero es justo lo
-- que se equivoca al hacerlo a mano: activos y gastos aumentan por el DEBE;
-- pasivos, patrimonio e ingresos aumentan por el HABER.
-- ───────────────────────────────────────────────────────────────────────────
create or replace view public.saldos_cuentas as
select
  c.id, c.codigo, c.nombre, c.tipo, c.corriente, c.liquida,
  coalesce(sum(l.debe), 0)  as total_debe,
  coalesce(sum(l.haber), 0) as total_haber,
  case
    when c.tipo in ('activo', 'gasto')
      then coalesce(sum(l.debe), 0) - coalesce(sum(l.haber), 0)
    else coalesce(sum(l.haber), 0) - coalesce(sum(l.debe), 0)
  end as saldo
from public.cuentas c
left join public.asiento_lineas l on l.cuenta_id = c.id
group by c.id;

-- Un asiento cuyo debe no iguala su haber está mal. Que se vea.
create or replace view public.asientos_descuadrados as
select a.id, a.fecha, a.glosa,
       sum(l.debe) as debe, sum(l.haber) as haber
from public.asientos a
join public.asiento_lineas l on l.asiento_id = a.id
group by a.id
having sum(l.debe) <> sum(l.haber);

-- ───────────────────────────────────────────────────────────────────────────
-- 5) Seguridad — solo el equipo
-- ───────────────────────────────────────────────────────────────────────────
alter table public.cuentas        enable row level security;
alter table public.asientos       enable row level security;
alter table public.asiento_lineas enable row level security;
alter table public.gastos_fijos   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['cuentas','asientos','asiento_lineas','gastos_fijos'] loop
    execute format('drop policy if exists "admin_all_%1$s" on public.%1$I', t);
    execute format(
      'create policy "admin_all_%1$s" on public.%1$I for all using (public.es_admin()) with check (public.es_admin())',
      t);
  end loop;
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 6) Un plan de cuentas para empezar
--
-- Chico a propósito: veinte cuentas que cubren una agencia. Se agregan más
-- desde el portal. Los códigos siguen la convención de siempre (1 activo,
-- 2 pasivo, 3 patrimonio, 4 ingreso, 5 gasto).
-- ───────────────────────────────────────────────────────────────────────────
insert into public.cuentas (codigo, nombre, tipo, corriente, liquida, orden) values
  ('1101', 'Caja',                        'activo',     true,  true,  10),
  ('1102', 'Banco',                       'activo',     true,  true,  20),
  ('1103', 'Mercado Pago',                'activo',     true,  true,  30),
  ('1201', 'Clientes por cobrar',         'activo',     true,  false, 40),
  ('1301', 'Equipos y computadores',      'activo',     false, false, 50),
  ('2101', 'Proveedores por pagar',       'pasivo',     true,  false, 60),
  ('2102', 'IVA débito por pagar',        'pasivo',     true,  false, 70),
  ('2103', 'Impuestos por pagar',         'pasivo',     true,  false, 80),
  ('2201', 'Préstamos de largo plazo',    'pasivo',     false, false, 90),
  ('3101', 'Capital',                     'patrimonio', false, false, 100),
  ('3201', 'Resultados acumulados',       'patrimonio', false, false, 110),
  ('4101', 'Ventas de servicios',         'ingreso',    true,  false, 120),
  ('4102', 'Suscripciones',               'ingreso',    true,  false, 130),
  ('5101', 'Sueldos y honorarios',        'gasto',      true,  false, 140),
  ('5102', 'Arriendo',                    'gasto',      true,  false, 150),
  ('5103', 'Herramientas y software',     'gasto',      true,  false, 160),
  ('5104', 'Publicidad y campañas',       'gasto',      true,  false, 170),
  ('5105', 'Comisiones de pago',          'gasto',      true,  false, 180),
  ('5106', 'Servicios básicos',           'gasto',      true,  false, 190),
  ('5199', 'Otros gastos',                'gasto',      true,  false, 200)
on conflict (codigo) do nothing;

-- 7) Integración automática con pagos del CRM.
-- Solo se contabiliza automáticamente CLP: convertir una venta extranjera con
-- la tasa de hoy falsearía el libro. Esos pagos quedan visibles en Cobros y el
-- contador registra el asiento con el tipo de cambio efectivo del documento.
create unique index if not exists asientos_referencia_idx
  on public.asientos (referencia) where referencia is not null;

create or replace function public.contabilizar_pago(p_pago_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  p record; c record; asiento_id uuid; debe_id uuid; haber_id uuid;
begin
  select * into p from public.pagos where id = p_pago_id;
  if p.id is null or p.estado <> 'pagado' or coalesce(p.monto,0) <= 0 then return; end if;
  if exists (select 1 from public.asientos where referencia = 'pago:' || p.id) then return; end if;
  select * into c from public.cobros where id = p.cobro_id;
  if c.id is null or coalesce(c.moneda,'CLP') <> 'CLP' then return; end if;

  select id into debe_id from public.cuentas where codigo = case
    when lower(coalesce(p.metodo,'')) like '%mercado%' then '1103'
    when lower(coalesce(p.metodo,'')) like '%efectivo%' then '1101'
    else '1102' end;
  select id into haber_id from public.cuentas where codigo = case when c.tipo = 'mensual' then '4102' else '4101' end;
  if debe_id is null or haber_id is null then return; end if;

  insert into public.asientos (fecha, glosa, origen, referencia, documento)
  values (coalesce(p.fecha, p.creado_en::date, current_date), coalesce(p.detalle,c.titulo,'Pago recibido'), 'cobro', 'pago:' || p.id, p.mp_id)
  returning id into asiento_id;
  insert into public.asiento_lineas (asiento_id, cuenta_id, debe, haber) values
    (asiento_id, debe_id, p.monto, 0),
    (asiento_id, haber_id, 0, p.monto);
end $$;

-- Es una rutina interna del trigger. No debe quedar expuesta como RPC a los
-- roles del navegador, porque escribe en el libro con privilegios del dueño.
revoke all on function public.contabilizar_pago(uuid)
  from public, anon, authenticated;
grant execute on function public.contabilizar_pago(uuid) to service_role;

create or replace function public.trg_contabilizar_pago()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'pagado' and (tg_op = 'INSERT' or old.estado is distinct from 'pagado') then
    perform public.contabilizar_pago(new.id);
  end if;
  return new;
end $$;

revoke all on function public.trg_contabilizar_pago()
  from public, anon, authenticated;
drop trigger if exists pago_a_contabilidad on public.pagos;
create trigger pago_a_contabilidad after insert or update of estado on public.pagos
  for each row execute function public.trg_contabilizar_pago();

do $$ declare p record; begin
  for p in select id from public.pagos where estado = 'pagado' loop
    perform public.contabilizar_pago(p.id);
  end loop;
end $$;
