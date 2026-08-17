-- Portal Cóndor · Suscripciones masivas con link compartido de Mercado Pago.
--
-- EL PROBLEMA QUE RESUELVE
-- ---------------------------------------------------------------------------
-- `crear-pago` genera un cobro para UNA persona concreta: hay que conocer su
-- correo antes y crear su ficha a mano. Para vender Rat.IA a $2.990/mes eso no
-- escala: se necesita UN link que se manda a cualquiera, y que cada quien se
-- registre solo al pagar.
--
-- Mercado Pago lo llama "plan de suscripción" (`/preapproval_plan`): se crea
-- el plan una vez y devuelve un `init_point` reutilizable
-- (mercadopago.cl/subscriptions/checkout?preapproval_plan_id=...). Cada
-- suscriptor genera su propio `preapproval` colgando de ese plan.
--
-- POR QUÉ NO VAN A `clientes`
-- ---------------------------------------------------------------------------
-- `clientes` es la cartera de la agencia: nueve fichas con setup, mensualidad,
-- links de pago y notas internas. Cientos de suscriptores de $2.990 ahí dentro
-- taparían a Howden y al resto en la misma lista, y ninguno de esos campos les
-- aplica. Viven aparte y se administran en su propio módulo.

-- ───────────────────────────────────────────────────────────────────────────
-- 1) Planes. `grupo` es la carpeta del módulo (ej. "Rat.IA").
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.planes_suscripcion (
  id            uuid primary key default gen_random_uuid(),
  grupo         text not null default 'General',
  nombre        text not null,
  descripcion   text,
  monto         integer not null,
  moneda        text not null default 'CLP',
  frecuencia_meses integer not null default 1,
  -- Lo que devuelve Mercado Pago al crear el plan.
  mp_plan_id    text,
  init_point    text,
  activo        boolean not null default true,
  creado_en     timestamptz not null default now()
);

create index if not exists planes_suscripcion_grupo_idx on public.planes_suscripcion(grupo);
-- Buscar el plan por su id de MP es lo que hace el webhook en cada aviso.
create unique index if not exists planes_suscripcion_mp_idx
  on public.planes_suscripcion(mp_plan_id) where mp_plan_id is not null;

alter table public.planes_suscripcion enable row level security;

drop policy if exists "admin_all_planes_suscripcion" on public.planes_suscripcion;
create policy "admin_all_planes_suscripcion" on public.planes_suscripcion
  for all using ( public.es_admin() ) with check ( public.es_admin() );

-- ───────────────────────────────────────────────────────────────────────────
-- 2) Suscriptores. Los crea el webhook solo, cuando alguien paga.
--
-- `mp_preapproval_id` es único: Mercado Pago reintenta las notificaciones y
-- cualquiera puede reenviar una real, así que sin esto un mismo pago crearía
-- suscriptores duplicados en cada reintento.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.suscriptores (
  id                uuid primary key default gen_random_uuid(),
  plan_id           uuid references public.planes_suscripcion(id) on delete set null,
  email             text not null,
  nombre            text,
  telegram          text,
  mp_preapproval_id text unique,
  estado            text not null default 'activa',
  monto             integer,
  moneda            text,
  ultimo_pago       timestamptz,
  proximo_cobro     date,
  creado_en         timestamptz not null default now()
);

create index if not exists suscriptores_plan_idx on public.suscriptores(plan_id);
create index if not exists suscriptores_email_idx on public.suscriptores(lower(email));

alter table public.suscriptores enable row level security;

-- El equipo gestiona todo.
drop policy if exists "admin_all_suscriptores" on public.suscriptores;
create policy "admin_all_suscriptores" on public.suscriptores
  for all using ( public.es_admin() ) with check ( public.es_admin() );

-- El suscriptor ve SOLO su propia fila, igual que `cliente_ve_lo_suyo`.
drop policy if exists "suscriptor_ve_lo_suyo" on public.suscriptores;
create policy "suscriptor_ve_lo_suyo" on public.suscriptores
  for select using ( lower(email) = lower((select auth.jwt() ->> 'email')) );

-- ───────────────────────────────────────────────────────────────────────────
-- 3) Los suscriptores pueden entrar al portal
--
-- `solicitar-acceso` solo manda el código a correos que esta función apruebe.
-- Sin este cambio, alguien que acaba de pagar no podría entrar nunca — y el
-- correo de bienvenida lo estaría invitando a una puerta cerrada.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.correo_autorizado(p_email text)
returns boolean
language sql
stable security definer
as $function$
  select exists(select 1 from public.admins   where lower(email) = lower(p_email))
      or exists(select 1 from public.clientes where lower(email) = lower(p_email) and archivado is not true)
      or exists(select 1 from public.suscriptores where lower(email) = lower(p_email) and estado = 'activa');
$function$;
