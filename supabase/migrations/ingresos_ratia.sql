-- condor.ai · Ingresos de Rat.IA (Flow.cl), para que Nicolás calcule el IVA
-- Pega y ejecuta en: Supabase -> SQL Editor -> New query -> Run
--
-- Rat.IA es un producto propio cobrado por Flow.cl a nombre de Cóndor.ai
-- (ver vigia-precios/docs/superpowers/specs/2026-08-08-ratia-cobro-onboarding-design.md).
-- Sus suscriptores NO son clientes de la agencia, así que no se mezclan con
-- `clientes`/`pagos` — esa tabla es el CRM de clientes B2B. Esta es solo el
-- registro de ingresos que Nicolás necesita para sumar el IVA débito total
-- del RUT de Cóndor.ai (el F29 es por RUT, no por producto).

create table if not exists public.ingresos_ratia (
  id                    uuid primary key default gen_random_uuid(),
  monto_bruto           int not null,             -- CLP, incluye IVA (lo que Flow cobró)
  tipo                  text not null,            -- 'alta' / 'renovacion'
  plan                  text,                     -- 'fundador' ($2.990) / 'regular' ($4.990)
  flow_subscription_id  text,
  creado_en             timestamptz default now()
);

create index if not exists idx_ingresos_ratia_creado_en on public.ingresos_ratia (creado_en desc);

alter table public.ingresos_ratia enable row level security;

-- El Worker de Cloudflare escribe con la anon key (sin login, sin service
-- role) — por eso la política de insert es la única que se le abre, y
-- solo puede insertar (nunca leer ni borrar), y solo con un monto real.
drop policy if exists "worker_inserta_ingreso" on public.ingresos_ratia;
create policy "worker_inserta_ingreso" on public.ingresos_ratia
  for insert to anon with check ( monto_bruto > 0 );

-- Nicolás lee con SUPABASE_SERVICE_ROLE_KEY (ya lo usa hoy para `pagos`),
-- que ignora RLS — no necesita política de select. Esta queda solo para
-- que un admin logueado en el portal pueda mirarla si hiciera falta.
drop policy if exists "admin_all_ingresos_ratia" on public.ingresos_ratia;
create policy "admin_all_ingresos_ratia" on public.ingresos_ratia
  for select using ( public.es_admin() );
