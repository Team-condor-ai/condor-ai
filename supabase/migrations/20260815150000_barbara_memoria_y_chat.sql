-- condor.ai · Extiende el módulo Bárbara para que el motor multi-cliente
-- pueda mandar a Telegram y guardar memoria particular por cliente.

alter table public.barbara_clientes
  add column if not exists telegram_chat_id text;

-- Memoria particular por cliente (reemplaza el content-log.json local, que
-- solo servía para un tenant). Mismo propósito: que el director no repita
-- ángulos ya usados. También es la fuente para el proceso de memoria
-- GLOBAL (lee entre todos los clientes, solo patrones de rendimiento).
create table if not exists public.barbara_memoria (
  id                 uuid primary key default gen_random_uuid(),
  barbara_cliente_id uuid not null references public.barbara_clientes(id) on delete cascade,
  fecha              date not null default current_date,
  tipo               text not null,      -- carrusel / historia / reel-ugc
  angulo             text,
  titulo             text,
  creado_en          timestamptz default now()
);
create index if not exists barbara_memoria_cliente_idx on public.barbara_memoria (barbara_cliente_id, creado_en);

alter table public.barbara_memoria enable row level security;

drop policy if exists "admin_all_barbara_memoria" on public.barbara_memoria;
create policy "admin_all_barbara_memoria" on public.barbara_memoria
  for all using ( public.es_admin() ) with check ( public.es_admin() );

drop policy if exists "cliente_ve_su_memoria" on public.barbara_memoria;
create policy "cliente_ve_su_memoria" on public.barbara_memoria
  for select using ( exists (
    select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
    where bc.id = barbara_memoria.barbara_cliente_id and c.email = (select auth.jwt() ->> 'email')
  ));
