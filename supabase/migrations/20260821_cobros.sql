-- Portal Cóndor · los cobros dejan de vivir dentro de la ficha del cliente.
--
-- POR QUÉ (21-ago-2026)
-- ---------------------------------------------------------------------------
-- Hasta hoy un cliente ERA su cobro: `setup_monto`/`setup_estado` y
-- `mensual_monto`/`mensual_estado`/`proximo_cobro` son columnas de `clientes`.
-- Eso alcanza para un solo trato por cliente y para nada más:
--
--   · No se puede dar de alta a un cliente sin inventarle montos en 0.
--   · No se le pueden cobrar dos trabajos distintos: el segundo pisa al primero.
--   · No hay historial POR COBRO. `pagos` cuelga del cliente, así que
--     "cuánto se pagó de la landing de septiembre" no se puede responder.
--
-- El modelo pasa a tres niveles:
--
--   clientes (quién es) → cobros (qué se le cobra) → pagos (qué pasó)
--
-- LAS COLUMNAS VIEJAS NO SE BORRAN ACÁ, Y ES DELIBERADO
-- ---------------------------------------------------------------------------
-- Si algo de esta migración sale mal, `clientes.setup_monto` y compañía son el
-- único lugar donde quedan esos datos. Se eliminan en una segunda migración,
-- cuando el portal lleve unos días corriendo sobre `cobros`. Mientras tanto el
-- código deja de LEERLAS — dos fuentes de verdad vivas es peor que una vieja.

-- ───────────────────────────────────────────────────────────────────────────
-- 1) La tabla
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.cobros (
  id                uuid primary key default gen_random_uuid(),
  cliente_id        uuid not null references public.clientes(id) on delete cascade,

  -- Número estable dentro del cliente. Es lo que se muestra cuando el título
  -- va vacío ("Cobro 3"). Se guarda en vez de calcularse por posición porque
  -- al anular uno, los demás no pueden cambiar de nombre: un cobro es un
  -- documento de plata y su identidad no se renumera.
  numero            int  not null,

  tipo              text not null check (tipo in ('unico', 'mensual')),

  -- Libre y opcional. Sin título se muestra "Cobro N": no queremos obligar a
  -- elegir entre tres planes fijos que nunca calzaron con la realidad.
  titulo            text,

  monto             int  not null default 0,
  moneda            text not null default 'CLP',

  -- Un único va pendiente → pagado (o anulado).
  -- Un mensual va pendiente (creado, el cliente todavía no autoriza en Mercado
  -- Pago) → activa (autorizada, MP cobra solo) → pausada / cancelada.
  estado            text not null default 'pendiente',

  -- Solo mensual: cuándo toca el próximo cobro.
  proximo_cobro     date,

  -- Solo mensual: la suscripción real en Mercado Pago. HOY ESTO NO SE GUARDABA
  -- EN NINGUNA PARTE, y sin el id no hay forma de pausar, cancelar ni conciliar
  -- una suscripción desde el portal.
  mp_preapproval_id text unique,

  -- `init_point` de MP, para reenviar el mismo link sin generar un cobro nuevo.
  link              text,

  -- El recordatorio del día de cobro se marcaba en `clientes`. Con varios
  -- cobros mensuales por cliente eso se pisa: el primero que avisa deja al
  -- resto sin recordatorio ese día. Va por cobro.
  ultimo_recordatorio_en date,

  creado_por        text,
  creado_en         timestamptz not null default now(),

  constraint cobros_numero_por_cliente unique (cliente_id, numero),

  -- Los estados no son intercambiables entre tipos: un pago único no puede
  -- estar "pausado" ni una suscripción "pagada" (se paga todos los meses).
  constraint cobros_estado_segun_tipo check (
    (tipo = 'unico'   and estado in ('pendiente', 'pagado', 'anulado')) or
    (tipo = 'mensual' and estado in ('pendiente', 'activa', 'pausada', 'cancelada'))
  )
);

create index if not exists cobros_cliente_idx on public.cobros (cliente_id);
create index if not exists cobros_proximo_idx on public.cobros (proximo_cobro)
  where tipo = 'mensual';

-- ───────────────────────────────────────────────────────────────────────────
-- 2) Cada pago pertenece a un cobro
--
-- `cliente_id` SE MANTIENE en `pagos` aunque ahora sea derivable: lo usa la
-- policy `cliente_ve_sus_pagos` tal cual está, y evita un join en cada consulta
-- de la ficha. Es denormalización a propósito, no un olvido.
--
-- `on delete set null` y no cascade: borrar un cobro nunca puede borrar plata
-- que de verdad entró. El pago sobrevive colgando del cliente.
-- ───────────────────────────────────────────────────────────────────────────
alter table public.pagos
  add column if not exists cobro_id uuid references public.cobros(id) on delete set null;

create index if not exists pagos_cobro_idx on public.pagos (cobro_id);

-- Un cobro mensual genera un pago por mes, y MP puede reintentar la
-- notificación del mismo. Sin esto, un reintento duplica la fila del mes.
alter table public.pagos add column if not exists periodo date;

create unique index if not exists pagos_cobro_periodo_idx
  on public.pagos (cobro_id, periodo)
  where cobro_id is not null and periodo is not null;

-- ───────────────────────────────────────────────────────────────────────────
-- 3) Seguridad — mismo criterio que el resto del portal
-- ───────────────────────────────────────────────────────────────────────────
alter table public.cobros enable row level security;

drop policy if exists "admin_all_cobros" on public.cobros;
create policy "admin_all_cobros" on public.cobros
  for all using ( public.es_admin() ) with check ( public.es_admin() );

-- El cliente ve sus cobros, pero NO los toca: los montos son del equipo.
drop policy if exists "cliente_ve_sus_cobros" on public.cobros;
create policy "cliente_ve_sus_cobros" on public.cobros
  for select using ( exists (
    select 1 from public.clientes c
    where c.id = cobros.cliente_id and c.email = (select auth.jwt() ->> 'email')
  ));

-- ───────────────────────────────────────────────────────────────────────────
-- 4) Migrar lo que ya existe
--
-- Idempotente: si ya se corrió, no vuelve a crear nada (se reconoce por
-- `pagos.cobro_id` ya asignado y por los cobros existentes del cliente).
--
-- REGLA DE ORO: al terminar, TODO pago tiene un cobro. Lo que no calce con el
-- setup ni con la mensualidad se convierte en su propio cobro único — es la
-- forma de no perder de vista un peso que ya entró.
-- ───────────────────────────────────────────────────────────────────────────
do $migrar$
declare
  c            record;
  p            record;
  n            int;
  id_setup     uuid;
  id_mensual   uuid;
  id_nuevo     uuid;
begin
  for c in select * from public.clientes loop

    -- Se retoma la numeración donde haya quedado, por si esto corre dos veces.
    select coalesce(max(numero), 0) into n from public.cobros where cliente_id = c.id;

    id_setup   := null;
    id_mensual := null;

    -- 4.1 · El setup de la ficha → un cobro único.
    if coalesce(c.cobra_setup, true) and coalesce(c.setup_monto, 0) > 0
       and not exists (select 1 from public.cobros
                       where cliente_id = c.id and tipo = 'unico' and titulo = 'Setup') then
      n := n + 1;
      insert into public.cobros (cliente_id, numero, tipo, titulo, monto, moneda, estado, link, creado_en)
      values (
        c.id, n, 'unico', 'Setup',
        c.setup_monto, coalesce(c.moneda, 'CLP'),
        case when c.setup_estado = 'pagado' then 'pagado' else 'pendiente' end,
        c.link_setup, coalesce(c.creado_en, now())
      )
      returning id into id_setup;
    else
      select id into id_setup from public.cobros
        where cliente_id = c.id and tipo = 'unico' and titulo = 'Setup' limit 1;
    end if;

    -- 4.2 · La mensualidad de la ficha → un cobro mensual.
    --
    -- Nace en 'pendiente' y no en 'activa' a propósito: hoy NO hay ninguna
    -- suscripción autorizada en Mercado Pago (confirmado con el equipo el
    -- 21-ago), así que `mp_preapproval_id` queda nulo y marcarlas activas
    -- diría que MP está cobrando solo cuando no lo está.
    if coalesce(c.cobra_mensual, true) and coalesce(c.mensual_monto, 0) > 0
       and not exists (select 1 from public.cobros
                       where cliente_id = c.id and tipo = 'mensual') then
      n := n + 1;
      insert into public.cobros (cliente_id, numero, tipo, titulo, monto, moneda, estado, proximo_cobro, link, creado_en)
      values (
        c.id, n, 'mensual', 'Mensualidad',
        c.mensual_monto, coalesce(c.moneda, 'CLP'),
        'pendiente', c.proximo_cobro, c.link_mensual,
        coalesce(c.creado_en, now())
      )
      returning id into id_mensual;
    else
      select id into id_mensual from public.cobros
        where cliente_id = c.id and tipo = 'mensual' limit 1;
    end if;

    -- 4.3 · Los pagos existentes se enganchan por tipo.
    if id_setup is not null then
      update public.pagos set cobro_id = id_setup
        where cliente_id = c.id and cobro_id is null and tipo = 'setup';
    end if;

    if id_mensual is not null then
      update public.pagos set cobro_id = id_mensual
        where cliente_id = c.id and cobro_id is null and tipo = 'mensual';
    end if;

    -- 4.4 · Todo lo que quedó suelto (puntual, unico, o un 'setup' de un
    -- cliente que ya no cobra setup) se vuelve su propio cobro único.
    for p in select * from public.pagos
             where cliente_id = c.id and cobro_id is null
             order by coalesce(creado_en, now()) loop
      n := n + 1;
      insert into public.cobros (cliente_id, numero, tipo, titulo, monto, moneda, estado, link, creado_en)
      values (
        c.id, n, 'unico',
        nullif(trim(coalesce(p.detalle, '')), ''),
        coalesce(p.monto, 0), coalesce(c.moneda, 'CLP'),
        case when p.estado = 'pagado' then 'pagado'
             when p.estado = 'rechazado' then 'anulado'
             else 'pendiente' end,
        p.link, coalesce(p.creado_en, now())
      )
      returning id into id_nuevo;

      update public.pagos set cobro_id = id_nuevo where id = p.id;
    end loop;

  end loop;
end
$migrar$;
