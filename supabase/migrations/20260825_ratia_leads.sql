-- Rat.IA: leads capturados desde el DM de Instagram (25-ago-2026).
--
-- POR QUÉ EXISTE
-- ═══════════════════════════════════════════════════════════════════════
-- Pedido de Joaquín: cuando alguien comenta en un post de Rat.IA para que
-- le manden el link por DM, el bot de ManyChat lo trae acá antes de
-- entregarle el link — deja su correo, acepta la política de datos, y
-- recién ahí ve la oferta. Esta tabla es donde queda ese registro: el
-- correo, qué producto le interesó, y la prueba de que consintió (con
-- fecha), que es el respaldo real ante la Ley 19.628.
--
-- POR QUÉ INSERT PÚBLICO, SIN SESIÓN
-- ═══════════════════════════════════════════════════════════════════════
-- Quien llena el formulario nunca inició sesión en el portal — es tráfico
-- frío de Instagram. La única forma de que la landing pueda guardar el
-- lead es que el rol `anon` pueda insertar. No hay SELECT para `anon` ni
-- `authenticated`: nadie externo puede leer los leads de otro, sólo
-- `service_role` (el equipo, desde el portal o una consulta directa).
create table if not exists public.ratia_leads (
  id               uuid primary key default gen_random_uuid(),
  correo           text not null check (
                     correo ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(correo) <= 200),
  producto_nombre  text,
  producto_url     text,
  comercio         text,
  -- 'oferta' | 'error' — de qué carril venía el post (ver
  -- vigia-precios/ratia_seleccion.py). Los de 'error' son el caso que
  -- pidió correo desde el principio; 'oferta' hoy no lo pide en el post
  -- pero la landing es la misma para las dos, así que igual se distingue.
  tipo             text check (tipo in ('oferta', 'error')),
  post_id          text,
  fuente           text not null default 'ig_dm',
  consintio        boolean not null default false,
  consintio_en     timestamptz,
  creado_en        timestamptz not null default now()
);

create index if not exists ratia_leads_correo_idx on public.ratia_leads (correo);
create index if not exists ratia_leads_creado_idx on public.ratia_leads (creado_en);

alter table public.ratia_leads enable row level security;

-- Cualquiera puede CREAR su propio lead (es el punto: es un formulario
-- público), pero sólo si de verdad marcó el consentimiento — la landing no
-- puede insertar la fila si el checkbox quedó sin marcar. Esto es un
-- respaldo a nivel de base, no sólo de UI: cierra la puerta a que alguien
-- llame al endpoint de Supabase directo, sin pasar por la landing, y
-- guarde un lead "sin consentir".
create policy "cualquiera_deja_su_correo_si_consintio"
  on public.ratia_leads for insert
  to anon, authenticated
  with check (consintio = true and consintio_en is not null);

-- Ninguna policy de select para anon/authenticated: se lee sólo por
-- service_role (equipo interno), igual que `api_credenciales`.
revoke all on public.ratia_leads from anon, authenticated;
grant insert on public.ratia_leads to anon, authenticated;
grant all on public.ratia_leads to service_role;
