-- Bárbara · sellos de marca en el brand book.
--
-- Proyecto VIVO: ylsqvmggycfijzfvguzq.
-- Independiente de 20260829_barbara_contexto_nicho.sql — se pueden aplicar en
-- cualquier orden.
--
-- POR QUÉ EN EL BRAND BOOK Y NO EN EL PROMPT
-- ---------------------------------------------------------------------------
-- Los sellos son las garantías de la marca: origen, composición, certificación
-- ("100% natural", "producto chileno", "sin aditivos"). Son los MISMOS en toda
-- pieza, así que pedírselos al modelo en cada generación es pagar tokens por
-- una constante — y, peor, es invitarlo a inventar una certificación que la
-- marca no tiene. Eso violaría REGLA_VERACIDAD y quedaría impreso sobre el
-- logo del cliente, que es el único lugar donde un dato inventado hace daño de
-- verdad.
--
-- Los BULLETS sí los escribe el modelo: cambian pieza a pieza porque dependen
-- del producto del que se esté hablando (ver schemaPara en clientes.mjs).
--
-- Sólo los usa la plantilla `sello`. Las otras cuatro ignoran la columna.

alter table public.barbara_brand_book
  add column if not exists sellos jsonb not null default '[]'::jsonb;

comment on column public.barbara_brand_book.sellos is
  'Garantías fijas de la marca para la barra inferior de la plantilla `sello`: '
  '["100% natural","Sin aditivos","Producto chileno"]. Máximo 4 — el quinto no '
  'entra en el lienzo de 1080px y plantillas.mjs lo recorta en silencio.';

-- Silver Roots, que es quien estrena la plantilla.
update public.barbara_brand_book set
  sellos = '["100% natural","Sin aditivos","Producto chileno","La Araucanía"]'::jsonb
where barbara_cliente_id = (
  select bc.id from public.barbara_clientes bc
    join public.clientes c on c.id = bc.cliente_id
   where c.negocio = 'Silver Roots'
);
