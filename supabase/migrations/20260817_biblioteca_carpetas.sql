-- Portal Cóndor · la biblioteca pasa a ser un Drive: carpetas y archivos.
--
-- Antes era una lista plana con una "categoría" de cuatro valores fijos. Eso
-- alcanza para veinte archivos y se vuelve inútil a los cien: no hay forma de
-- agrupar por cliente, por campaña o por año sin inventar prefijos en el
-- nombre.

-- ───────────────────────────────────────────────────────────────────────────
-- Carpetas, anidables
--
-- `padre_id` referencia a la misma tabla: una carpeta sin padre está en la
-- raíz. `on delete cascade` borra el subárbol completo — es lo que espera
-- cualquiera que borra una carpeta, y la interfaz avisa antes.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.biblioteca_carpetas (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  padre_id   uuid references public.biblioteca_carpetas(id) on delete cascade,
  creado_en  timestamptz not null default now()
);

create index if not exists biblioteca_carpetas_padre_idx
  on public.biblioteca_carpetas(padre_id);

alter table public.biblioteca_carpetas enable row level security;

drop policy if exists "admin_all_biblioteca_carpetas" on public.biblioteca_carpetas;
create policy "admin_all_biblioteca_carpetas" on public.biblioteca_carpetas
  for all using ( public.es_admin() ) with check ( public.es_admin() );

-- ───────────────────────────────────────────────────────────────────────────
-- Los archivos ahora viven en una carpeta (o en la raíz, si es null)
--
-- `on delete cascade` acá también: si se borra la carpeta, sus archivos se
-- van con ella. Quedarían huérfanos e invisibles de todas formas.
-- ───────────────────────────────────────────────────────────────────────────
alter table public.biblioteca
  add column if not exists carpeta_id uuid
  references public.biblioteca_carpetas(id) on delete cascade;

create index if not exists biblioteca_carpeta_idx on public.biblioteca(carpeta_id);

-- Guardar el tipo real del archivo (image/png, application/pdf…) para poder
-- elegir el icono y decidir si se puede previsualizar.
alter table public.biblioteca add column if not exists mime text;

-- `categoria` queda pero deja de usarse en la interfaz: las carpetas hacen ese
-- trabajo mejor. No se borra la columna para no perder lo ya clasificado.
