-- Bárbara aprende: memoria individual (reglas) y global (patrones).
--
-- EL PROBLEMA (17-ago-2026)
-- ---------------------------------------------------------------------------
-- Hoy Bárbara recuerda lo que HIZO (`barbara_memoria`: fecha, tipo, ángulo)
-- pero nada le dice si estuvo BUENA. No puede mejorar porque no tiene señal.
--
-- Y la señal más valiosa ya se está capturando y botando: cuando el cliente
-- responde "el verde no, usa el azul", ese texto entra a `barbara_chats` y el
-- motor jamás lee esa tabla. Si el cliente corrige lo mismo cinco veces, a la
-- sexta Bárbara vuelve a equivocarse.

-- ═══════════════════════════════════════════════════════════════════════
-- 1) MEMORIA INDIVIDUAL · las reglas de cada marca
--
-- No guarda la corrección cruda sino la REGLA DURADERA que se destila de
-- ella. "Cambia esta foto" es puntual y no se guarda; "nunca uses fotos de
-- stock" es una preferencia y sí. Si se guardara todo, el archivo de reglas
-- se llena de ruido y la generación empeora en vez de mejorar.
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists public.barbara_reglas (
  id                 uuid primary key default gen_random_uuid(),
  barbara_cliente_id uuid not null references public.barbara_clientes(id) on delete cascade,
  regla              text not null,
  categoria          text,           -- copy / diseno / producto / tono / formato
  origen             text,           -- el mensaje textual del que salió
  -- Cuántas veces el cliente volvió a pedir lo mismo. No se crea una regla
  -- duplicada: se sube el contador. Que lo repita ES la señal de que importa,
  -- y así el prompt puede priorizar las que más pesan.
  veces_reforzada    integer not null default 1,
  activa             boolean not null default true,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now()
);

create index if not exists barbara_reglas_cliente_idx
  on public.barbara_reglas (barbara_cliente_id, activa, veces_reforzada desc);

alter table public.barbara_reglas enable row level security;

drop policy if exists "admin_all_barbara_reglas" on public.barbara_reglas;
create policy "admin_all_barbara_reglas" on public.barbara_reglas
  for all using ( public.es_admin() ) with check ( public.es_admin() );

-- El cliente VE lo que Bárbara aprendió de su marca. Es su marca: esconderlo
-- sería raro, y verlo es parte de por qué el producto se siente propio.
drop policy if exists "cliente_ve_sus_reglas" on public.barbara_reglas;
create policy "cliente_ve_sus_reglas" on public.barbara_reglas
  for select using ( exists (
    select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
    where bc.id = barbara_reglas.barbara_cliente_id
      and lower(c.email) = lower((select auth.jwt() ->> 'email'))
  ));

-- ═══════════════════════════════════════════════════════════════════════
-- 2) MEMORIA GLOBAL · patrones entre todos los clientes
--
-- LA LÍNEA QUE NO SE CRUZA: acá van SOLO patrones de rendimiento, nunca
-- contenido ni identidad de ninguna marca. "Los carruseles que cierran con
-- pregunta se guardan más" es un patrón. "El cliente X publicó Y" no entra
-- jamás. No es solo ética: está publicado como promesa en la landing de
-- Bárbara, así que romperlo sería mentirle al público.
--
-- `activo` arranca en FALSE a propósito. Con 2-3 clientes un patrón cruzado
-- no significa nada: hacer que influya sería aprender de ruido, que es peor
-- que no aprender. La tabla acumula desde ya —eso no se puede recuperar
-- después— pero no toca la generación hasta que alguien lo encienda con
-- muestras suficientes.
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists public.barbara_patrones (
  id             uuid primary key default gen_random_uuid(),
  patron         text not null,
  tipo           text,             -- carrusel / historia / ugc / general
  muestras       integer not null default 0,
  activo         boolean not null default false,
  nota           text,             -- de dónde salió, para poder auditarlo
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table public.barbara_patrones enable row level security;

-- Solo el equipo. Los patrones globales son de Cóndor, no de un cliente.
drop policy if exists "admin_all_barbara_patrones" on public.barbara_patrones;
create policy "admin_all_barbara_patrones" on public.barbara_patrones
  for all using ( public.es_admin() ) with check ( public.es_admin() );

-- ═══════════════════════════════════════════════════════════════════════
-- 3) RESULTADO DE CADA PIEZA
--
-- La señal gratis que hoy no se guarda: ¿la aprobó a la primera o hubo que
-- rehacerla? Es peor dato que el alcance real de Instagram, pero existe
-- desde el primer cliente y no depende de conectar ninguna cuenta.
-- ═══════════════════════════════════════════════════════════════════════
alter table public.barbara_memoria
  add column if not exists correcciones_pedidas integer not null default 0;
alter table public.barbara_memoria
  add column if not exists aprobada_sin_cambios boolean;
