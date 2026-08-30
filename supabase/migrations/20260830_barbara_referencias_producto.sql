-- Bárbara · fotos de referencia del producto real de cada cliente.
--
-- Proyecto VIVO: ylsqvmggycfijzfvguzq.
--
-- QUÉ PROBLEMA RESUELVE (medido, no teórico)
-- ---------------------------------------------------------------------------
-- El 30-ago-2026 se generó un carrusel real para Silver Roots. El modelo de
-- imagen, con `text-to-image` puro y con la instrucción explícita de NO
-- escribir texto, igual dibujó envases con etiquetas legibles — y en un slide
-- se inventó una marca de aceite llamada "TAPIHUE" y la puso nítida sobre la
-- pieza. Publicar eso en la cuenta de un cliente es inventarle un producto que
-- no vende.
--
-- No se arregla desde el prompt: el modelo no tiene idea de cómo es el envase
-- real, así que lo aproxima. La única salida es MOSTRÁRSELO —
-- `generarConReferencia()` en `openai-imagen.mjs`, que existe desde el 29-ago
-- y no se podía usar porque no había de dónde sacar las fotos.
--
-- POR QUÉ CADA FOTO LLEVA DESCRIPCIÓN
-- ---------------------------------------------------------------------------
-- Un cliente sube ocho fotos: la sal, la miel, el tocino, el aceite. Un slide
-- que habla de la sal tiene que recibir la foto de la sal, no una cualquiera.
-- Sin saber qué hay en cada imagen, el sistema sólo puede mandar la primera —
-- y una escena de miel ilustrando un texto sobre sal es el mismo error de
-- coherencia que esto viene a arreglar, con otra cara.

begin;

-- ── bucket ─────────────────────────────────────────────────────────────────
--
-- Público de lectura como `barbara-logos`: la URL viaja a la API de OpenAI y
-- se muestra en el portal. No hay nada sensible — son fotos de producto que el
-- cliente publica en su propio Instagram.

insert into storage.buckets (id, name, public)
values ('barbara-referencias', 'barbara-referencias', true)
on conflict (id) do nothing;

drop policy if exists "admin_manage_barbara_referencias" on storage.objects;
create policy "admin_manage_barbara_referencias" on storage.objects
  for all
  using ( bucket_id = 'barbara-referencias' and public.es_admin() )
  with check ( bucket_id = 'barbara-referencias' and public.es_admin() );

-- El CLIENTE también sube: es quien tiene las fotos de su producto, y el
-- onboarding lo llena él. Los logos son sólo-admin porque los carga el equipo
-- al dar de alta la marca; acá es al revés.
drop policy if exists "cliente_sube_sus_referencias" on storage.objects;
create policy "cliente_sube_sus_referencias" on storage.objects
  for insert
  with check (
    bucket_id = 'barbara-referencias'
    and (storage.foldername(name))[1] in (
      select bc.id::text from public.barbara_clientes bc
        join public.clientes c on c.id = bc.cliente_id
       where c.email = (select auth.jwt() ->> 'email')
    )
  );

-- ── tabla ──────────────────────────────────────────────────────────────────

create table if not exists public.barbara_referencias (
  id                 uuid primary key default gen_random_uuid(),
  barbara_cliente_id uuid not null references public.barbara_clientes(id) on delete cascade,
  storage_path       text not null,
  url                text not null,

  -- Qué producto es. Es lo que permite elegir la foto correcta para cada
  -- slide en vez de mandar siempre la primera.
  producto           text not null,

  -- Opcional, en palabras del cliente: "el frasco de 500g, el que tiene la
  -- tapa dorada". Ayuda cuando hay varias presentaciones del mismo producto.
  detalle            text not null default '',

  activa             boolean not null default true,
  creado_en          timestamptz not null default now(),
  unique (barbara_cliente_id, storage_path)
);

create index if not exists barbara_referencias_cliente_idx
  on public.barbara_referencias (barbara_cliente_id) where activa;

comment on table public.barbara_referencias is
  'Fotos del producto REAL del cliente, para pasarle al modelo de imagen como '
  'referencia. Sin esto el modelo inventa el envase y su etiqueta.';

-- ── RLS ────────────────────────────────────────────────────────────────────

alter table public.barbara_referencias enable row level security;

drop policy if exists "admin_all_barbara_referencias" on public.barbara_referencias;
create policy "admin_all_barbara_referencias" on public.barbara_referencias
  for all using ( public.es_admin() ) with check ( public.es_admin() );

-- El cliente ve y administra las suyas. A diferencia de `barbara_formulario`
-- —que sólo tiene select y update, y por eso un cliente nuevo no podía crear
-- su fila— acá SÍ hace falta insert: son varias filas y las crea él al subir.
drop policy if exists "cliente_gestiona_sus_referencias" on public.barbara_referencias;
create policy "cliente_gestiona_sus_referencias" on public.barbara_referencias
  for all
  using ( exists (
    select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
    where bc.id = barbara_referencias.barbara_cliente_id
      and c.email = (select auth.jwt() ->> 'email')
  ))
  with check ( exists (
    select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
    where bc.id = barbara_referencias.barbara_cliente_id
      and c.email = (select auth.jwt() ->> 'email')
  ));

commit;

-- ── verificación ───────────────────────────────────────────────────────────
--
--   select id, producto, detalle, activa from public.barbara_referencias
--    where barbara_cliente_id = (
--      select bc.id from public.barbara_clientes bc
--        join public.clientes c on c.id = bc.cliente_id
--       where c.negocio = 'Silver Roots');
--
-- Mientras esté vacío, `clientes.mjs` sigue generando por text-to-image igual
-- que hoy: las referencias son una mejora, no un requisito.
