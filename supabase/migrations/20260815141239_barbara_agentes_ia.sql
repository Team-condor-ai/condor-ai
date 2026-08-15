-- condor.ai · Módulo "Agentes IA > Bárbara" (staff) y "Bárbara" (portal cliente)
-- Mismo patrón de RLS que portal_schema.sql / portal_admin.sql: es_admin() para
-- staff, email = auth.jwt()->>'email' (via clientes) para el cliente dueño.
--
-- El backend/motor de Bárbara vive en un repo aparte (joaquinmunozs/barbara),
-- pero los datos viven ACÁ, en el mismo Supabase que ya usa el portal — un
-- solo origen de verdad, sin duplicar login ni sincronizar dos bases.

-- 1) Ficha de Bárbara por cliente. Un cliente de `clientes` puede tener a lo
--    más UNA fila acá (unique) — es lo que impide agregar al mismo cliente
--    dos veces por accidente ("agregar cliente existente" vs "agregar desde
--    cero" apuntan siempre a esta tabla, nunca se duplica).
create table if not exists public.barbara_clientes (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid not null references public.clientes(id) on delete cascade,
  plan         text not null default 'barbara',   -- barbara / go / plus
  rubro        text,
  activo       boolean default true,
  creado_en    timestamptz default now(),
  unique (cliente_id)
);

-- 2) Brand book. Lo llena el staff al dar de alta al cliente.
create table if not exists public.barbara_brand_book (
  id                 uuid primary key default gen_random_uuid(),
  barbara_cliente_id uuid not null references public.barbara_clientes(id) on delete cascade,
  paleta_colores     jsonb default '[]',   -- [{"hex":"#C6FF00","uso":"acento"}, ...]
  tipografia         text,
  logo_url           text,
  detalles           text,                 -- restricciones, gustos del dueño, qué NO usar
  actualizado_en     timestamptz default now(),
  unique (barbara_cliente_id)
);

-- 3) Formulario de entrada. Lo llena/edita el propio CLIENTE desde su portal
--    ("Bárbara" → "Editar formulario de entrada").
create table if not exists public.barbara_formulario (
  id                 uuid primary key default gen_random_uuid(),
  barbara_cliente_id uuid not null references public.barbara_clientes(id) on delete cascade,
  tipo_contenido     jsonb default '[]',   -- ["ugc","informativo","educativo",...]
  publico_objetivo   text,
  tono               text,
  restricciones      text,
  ejemplos_referencia text,
  producto_destacar  text,
  actualizado_en     timestamptz default now(),
  unique (barbara_cliente_id)
);

-- 4) Espejo del chat de Telegram. El bot de Bárbara inserta acá cada mensaje
--    (usa la service key, ignora RLS); esta tabla es solo para que staff y
--    cliente puedan REVISAR la conversación desde el portal, no es el canal
--    real de comunicación (ese sigue siendo Telegram).
create table if not exists public.barbara_chats (
  id                 uuid primary key default gen_random_uuid(),
  barbara_cliente_id uuid not null references public.barbara_clientes(id) on delete cascade,
  remitente          text not null check (remitente in ('cliente','barbara','staff')),
  mensaje            text not null,
  telegram_message_id text,
  creado_en          timestamptz default now()
);
create index if not exists barbara_chats_cliente_idx on public.barbara_chats (barbara_cliente_id, creado_en);

-- 5) Bloqueo de reintentos de corrección (máximo 3, según lo acordado con
--    Joaquín). Solo staff puede desbloquear.
create table if not exists public.barbara_correcciones (
  id                 uuid primary key default gen_random_uuid(),
  barbara_cliente_id uuid not null references public.barbara_clientes(id) on delete cascade,
  intentos_usados    int default 0,
  bloqueado          boolean default false,
  desbloqueado_por   text,          -- correo del admin que reseteó
  actualizado_en     timestamptz default now(),
  unique (barbara_cliente_id)
);

-- RLS
alter table public.barbara_clientes     enable row level security;
alter table public.barbara_brand_book   enable row level security;
alter table public.barbara_formulario   enable row level security;
alter table public.barbara_chats        enable row level security;
alter table public.barbara_correcciones enable row level security;

-- Staff: control total en las 5 tablas
drop policy if exists "admin_all_barbara_clientes" on public.barbara_clientes;
create policy "admin_all_barbara_clientes" on public.barbara_clientes
  for all using ( public.es_admin() ) with check ( public.es_admin() );

drop policy if exists "admin_all_barbara_brand_book" on public.barbara_brand_book;
create policy "admin_all_barbara_brand_book" on public.barbara_brand_book
  for all using ( public.es_admin() ) with check ( public.es_admin() );

drop policy if exists "admin_all_barbara_formulario" on public.barbara_formulario;
create policy "admin_all_barbara_formulario" on public.barbara_formulario
  for all using ( public.es_admin() ) with check ( public.es_admin() );

drop policy if exists "admin_all_barbara_chats" on public.barbara_chats;
create policy "admin_all_barbara_chats" on public.barbara_chats
  for all using ( public.es_admin() ) with check ( public.es_admin() );

drop policy if exists "admin_all_barbara_correcciones" on public.barbara_correcciones;
create policy "admin_all_barbara_correcciones" on public.barbara_correcciones
  for all using ( public.es_admin() ) with check ( public.es_admin() );

-- Cliente: solo ve lo suyo (join por email, igual que en portal_schema.sql).
-- Nunca ve la ficha de otro cliente ni el brand book de nadie (el brand book
-- lo gestiona el staff, no se expone al cliente por ahora).
drop policy if exists "cliente_ve_su_barbara" on public.barbara_clientes;
create policy "cliente_ve_su_barbara" on public.barbara_clientes
  for select using ( exists (
    select 1 from public.clientes c
    where c.id = barbara_clientes.cliente_id and c.email = (select auth.jwt() ->> 'email')
  ));

drop policy if exists "cliente_ve_edita_su_formulario" on public.barbara_formulario;
create policy "cliente_ve_edita_su_formulario" on public.barbara_formulario
  for select using ( exists (
    select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
    where bc.id = barbara_formulario.barbara_cliente_id and c.email = (select auth.jwt() ->> 'email')
  ));
drop policy if exists "cliente_actualiza_su_formulario" on public.barbara_formulario;
create policy "cliente_actualiza_su_formulario" on public.barbara_formulario
  for update using ( exists (
    select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
    where bc.id = barbara_formulario.barbara_cliente_id and c.email = (select auth.jwt() ->> 'email')
  ));

drop policy if exists "cliente_ve_su_chat" on public.barbara_chats;
create policy "cliente_ve_su_chat" on public.barbara_chats
  for select using ( exists (
    select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
    where bc.id = barbara_chats.barbara_cliente_id and c.email = (select auth.jwt() ->> 'email')
  ));

drop policy if exists "cliente_ve_su_bloqueo" on public.barbara_correcciones;
create policy "cliente_ve_su_bloqueo" on public.barbara_correcciones
  for select using ( exists (
    select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
    where bc.id = barbara_correcciones.barbara_cliente_id and c.email = (select auth.jwt() ->> 'email')
  ));
-- Nota: el cliente NO puede editar barbara_correcciones (sin policy de
-- update) — solo lectura de su propio estado de bloqueo. Desbloquear es
-- exclusivo de staff, vía la policy "admin_all" de arriba.
