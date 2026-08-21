-- Portal Cóndor · quiénes son los suscriptores de Rat.IA.
--
-- POR QUÉ UNA TABLA APARTE Y NO `clientes` (21-ago-2026)
-- ---------------------------------------------------------------------------
-- Es la misma razón que ya está escrita en `ingresos_ratia.sql`: Rat.IA es un
-- producto propio, cobrado por Flow.cl, y sus suscriptores NO son clientes de
-- la agencia. Meterlos en `clientes` mezclaría cientos de suscripciones de
-- $2.990 con las fichas de la cartera B2B —setup, mensualidad, notas internas,
-- reuniones— y taparía a los clientes reales en la misma lista. Ninguno de
-- esos campos les aplica.
--
-- QUÉ RELACIÓN TIENE CON `ingresos_ratia`
-- ---------------------------------------------------------------------------
-- `ingresos_ratia` es LA PLATA que entró (la escribe el Worker de Cloudflare,
-- sin identidad, para que Nicolás sume el IVA). Esta tabla es QUIÉN está
-- suscrito. Se cruzan por `flow_subscription_id` cuando existe, pero cada una
-- se sostiene sola: un ingreso sin suscriptor sigue contando para el F29, y un
-- suscriptor sin ingreso registrado sigue siendo alguien a quien atender.

create table if not exists public.suscriptores_ratia (
  id           uuid primary key default gen_random_uuid(),

  -- Datos básicos. Ninguno obligatorio salvo el nombre: a veces solo se sabe
  -- el Telegram, y exigir correo obligaría a inventarlo.
  nombre       text not null,
  email        text,
  telegram     text,
  telefono     text,
  notas        text,

  -- La suscripción. `plan` es texto libre con los valores que usa el Worker
  -- ('fundador' / 'regular'), no un enum: si mañana sale un plan nuevo, no se
  -- puede quedar la migración a medio aplicar por un CHECK.
  plan         text,
  monto        int not null default 0,
  moneda       text not null default 'CLP',
  estado       text not null default 'activa'
               check (estado in ('activa', 'pausada', 'cancelada')),
  inicio       date,
  proximo_cobro date,

  flow_subscription_id text unique,

  creado_por   text,
  creado_en    timestamptz not null default now()
);

create index if not exists suscriptores_ratia_estado_idx
  on public.suscriptores_ratia (estado);

alter table public.suscriptores_ratia enable row level security;

-- Solo el equipo. Un suscriptor de Rat.IA no entra al portal: su producto es
-- el bot de Telegram, no esta aplicación.
drop policy if exists "admin_all_suscriptores_ratia" on public.suscriptores_ratia;
create policy "admin_all_suscriptores_ratia" on public.suscriptores_ratia
  for all using ( public.es_admin() ) with check ( public.es_admin() );
