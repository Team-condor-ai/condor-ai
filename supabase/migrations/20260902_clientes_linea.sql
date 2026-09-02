-- Reorganización del portal (2-sept-2026): "Clientes" pasa a ser "Productos",
-- con una pestaña por línea (Sites/Ecommerce/Track). Para poder filtrar la
-- cartera por línea hace falta saber a cuál pertenece cada cliente.
--
-- Ecommerce NO se backfillea acá a propósito: Tecnobox y Silver and Co no son
-- filas de `clientes`, viven en `ingresos_clientes` (ver
-- 20260901_ingresos_clientes.sql) ligados a Shopify. Un cliente de esta
-- tabla puede ser 'sites', 'track', o null (sin clasificar) -- nunca
-- 'ecommerce'.
alter table public.clientes add column if not exists linea text;

-- Backfill: todo lo que ya usa un plan de "Página web" es Cóndor Sites. Los
-- planes de Bárbara (línea Cóndor Agents) quedan sin clasificar a propósito:
-- Productos solo tiene 3 pestañas (Sites/Ecommerce/Track), no Agents.
update public.clientes
set linea = 'sites'
where linea is null and plan in ('Landing', 'Completa', 'A medida');

-- Dos casos puntuales, verificados contra la memoria real del negocio (no
-- calzaban por nombre de plan libre, no por dato incorrecto):
--   · Neisstech: plan "CondorAI" -- es el cliente de Cóndor Sites donde
--     Cóndor.ai actúa como departamento de TI externo.
--   · Howden group: plan "Servicios mixtos" -- es Howden Track, proyecto
--     pasado/cerrado de Cóndor Track.
-- El resto de las filas sin clasificar (Tecnobox, Silver & Co, Rat.IA,
-- Cóndor.AI, Videos IA, GHL, clientes de prueba) quedan deliberadamente sin
-- tocar: no encajan limpio en Sites/Track, o son filas internas/de prueba,
-- o -- Tecnobox y Silver & Co -- ya se administran aparte vía
-- `ingresos_clientes` y reclasificarlos acá crearía una fila duplicada y
-- confusa. Revisar a mano si corresponde archivarlas.
update public.clientes set linea = 'sites' where negocio = 'Neisstech' and linea is null;
update public.clientes set linea = 'track' where negocio = 'Howden group' and linea is null;

create index if not exists idx_clientes_linea on public.clientes(linea);
