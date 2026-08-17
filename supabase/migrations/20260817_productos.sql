-- Portal Cóndor: catálogo de productos/servicios que se ofrecen (Landing,
-- Videos IA, Bárbara, etc.), separado del texto libre "Servicio ofrecido" que
-- ya tiene cada cliente. Sirve como referencia interna del equipo, no se
-- asigna automáticamente a `clientes.concepto`.
--
-- Mismo patrón que `clientes`/`admins`: solo admins (es_admin()) pueden
-- ver y gestionar. No hay vista de cliente para esta tabla.
create table if not exists public.productos (
  id                     uuid primary key default gen_random_uuid(),
  nombre                 text not null,
  descripcion            text,
  caracteristicas        text[] not null default '{}',
  precio_setup_sugerido  numeric,
  precio_mensual_sugerido numeric,
  moneda                 text not null default 'CLP',
  activo                 boolean not null default true,
  creado_en              timestamptz not null default now()
);

alter table public.productos enable row level security;

drop policy if exists "admin_all_productos" on public.productos;
create policy "admin_all_productos" on public.productos
  for all using ( public.es_admin() ) with check ( public.es_admin() );
