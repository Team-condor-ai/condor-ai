-- Memoria de Bárbara por cliente, estilo Obsidian: gustos, datos, patrones
-- aplicados y el perfil sintetizado. Las CORRECCIONES siguen viviendo en
-- `barbara_reglas` (no se toca, ya funciona y el webhook de Telegram escribe
-- ahí) — esta tabla es para los tipos de nodo que todavía no tenían casa.
--
-- POR QUE UNA TABLA NUEVA Y NO METERLO TODO EN `barbara_reglas`
-- ---------------------------------------------------------------------------
-- `barbara_reglas` esta diseñada para UNA cosa: una regla destilada de una
-- correccion, con "cuantas veces la repitieron" como su dato central. Un
-- "dato del usuario" (ej. "el dueño se llama Ricardo") o un "perfil"
-- (un parrafo sintetizado, no una regla puntual) no encajan en esa forma.
-- Forzarlos ahi ensuciaria la tabla que ya funciona en produccion.
create table if not exists public.barbara_memoria_nodos (
  id                 uuid primary key default gen_random_uuid(),
  barbara_cliente_id uuid not null references public.barbara_clientes(id) on delete cascade,
  tipo               text not null check (tipo in ('gusto', 'dato', 'perfil')),
  titulo             text not null,   -- la etiqueta corta que se ve en el grafo
  contenido          text not null,   -- el detalle completo
  peso               integer not null default 1,  -- refuerzo: mas grande en el grafo
  activo             boolean not null default true,
  origen             text,            -- de que conversacion/momento salio
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now()
);

create index if not exists barbara_memoria_nodos_cliente_idx
  on public.barbara_memoria_nodos (barbara_cliente_id, activo);

alter table public.barbara_memoria_nodos enable row level security;

drop policy if exists "admin_all_barbara_memoria_nodos" on public.barbara_memoria_nodos;
create policy "admin_all_barbara_memoria_nodos" on public.barbara_memoria_nodos
  for all using ( public.es_admin() ) with check ( public.es_admin() );

-- El cliente ve sus propios nodos, igual que ya ve sus reglas — es su marca,
-- esconderselo seria raro. El "perfil" (analisis de estilo) tambien lo ve:
-- es sobre como trabaja con Barbara, no un dato oculto de vigilancia.
drop policy if exists "cliente_ve_sus_nodos" on public.barbara_memoria_nodos;
create policy "cliente_ve_sus_nodos" on public.barbara_memoria_nodos
  for select using ( exists (
    select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
    where bc.id = barbara_memoria_nodos.barbara_cliente_id
      and lower(c.email) = lower((select auth.jwt() ->> 'email'))
  ));
