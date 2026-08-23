-- Bárbara · memoria FUNDACIONAL: los playbooks propios de Cóndor.
--
-- La tercera capa de memoria, junto a las dos que ya existen:
--   · barbara_reglas   → memoria PRIVADA  (lo que corrigió ESTA marca)
--   · barbara_patrones → memoria GLOBAL   (lo que se repite entre clientes)
--   · barbara_playbooks→ memoria FUNDACIONAL (lo que Cóndor ya sabe)
--
-- Prioridad al generar, de más a menos: privada > global > fundacional.
-- Si el gusto del cliente contradice un playbook, gana el cliente, siempre.
--
-- POR QUÉ SE ESCRIBE A MANO Y NO SE APRENDE SOLA
-- ---------------------------------------------------------------------------
-- `barbara_patrones` la llena un modelo destilando piezas reales. Ésta no:
-- acá va conocimiento que Cóndor verificó con su propia plata y decidió
-- convertir en regla. Que entre a mano es la garantía de que cada línea tenga
-- a alguien detrás que la sostenga — es justo lo que la separa de "lo que un
-- modelo cree sobre marketing", que Claude ya trae de fábrica y no hace falta
-- guardar.
--
-- POR QUÉ NO SE CARGA CON CONTENIDO DE TERCEROS
-- ---------------------------------------------------------------------------
-- La idea original era precargarla con transcripciones de charlas de
-- expositores conocidos. Se descartó: redistribuir contenido ajeno dentro de
-- un producto por el que se cobra mensualidad es riesgo de derechos de autor
-- real, y además es innecesario — la teoría genérica de marketing ya la sabe
-- el modelo. Lo que no sabe, y sólo puede venir de acá, es qué le funcionó a
-- Cóndor con clientes reales. Ver services/barbara/ESTRATEGIA.md.

create table if not exists public.barbara_playbooks (
  id            uuid primary key default gen_random_uuid(),
  -- Nombre corto para reconocerlo en el portal. No se le manda al modelo.
  titulo        text not null,
  -- La regla misma, en imperativo y en español: es lo único que viaja al
  -- prompt del director.
  regla         text not null,
  -- Para qué formato aplica. 'general' entra siempre.
  tipo          text not null default 'general'
                check (tipo in ('carrusel', 'historia', 'ugc', 'general')),
  -- Rubro al que aplica, en minúsculas. NULL = sirve para cualquier marca.
  -- Un playbook de rubro sólo se le pasa a clientes de ese rubro.
  rubro         text,
  -- En qué se apoya: qué pieza, qué cliente, qué resultado lo verificó.
  -- Auditable a propósito — una regla sin evidencia no debería estar acá.
  evidencia     text not null,
  -- Nacen encendidos, al revés que barbara_patrones: éstos los escribió una
  -- persona que ya los verificó, no un modelo buscando correlaciones.
  activo        boolean not null default true,
  -- Orden de importancia dentro de la capa. Más alto = se le pasa antes.
  peso          int not null default 0,
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

comment on table public.barbara_playbooks is
  'Memoria fundacional de Bárbara: conocimiento propio de Cóndor, escrito a mano y verificado. Se le pasa al director con MENOS prioridad que las reglas del cliente y que los patrones globales.';

-- El motor filtra por activo + tipo + rubro en cada generación.
create index if not exists barbara_playbooks_lookup
  on public.barbara_playbooks (activo, tipo, rubro, peso desc);

alter table public.barbara_playbooks enable row level security;

-- Sólo el service_role (el motor y los scripts de staff) toca esta tabla.
-- No hay política para usuarios anónimos ni autenticados a propósito: un
-- cliente no debe poder leer ni escribir el conocimiento propio de Cóndor.
drop policy if exists barbara_playbooks_service on public.barbara_playbooks;
create policy barbara_playbooks_service
  on public.barbara_playbooks
  for all
  to service_role
  using (true)
  with check (true);
