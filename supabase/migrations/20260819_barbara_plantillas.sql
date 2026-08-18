-- La plantilla de carrusel de cada marca.
--
-- Los slides pasaron de dibujarse con un modelo de imagen a componerse en
-- HTML (ver `services/barbara/plantillas.mjs`). Un carrusel es una pieza
-- tipografica, y pedirle texto exacto a un modelo de imagen es pedirle justo
-- lo que peor hace: existia un parrafo entero (`REGLA_TEXTO`) rogandole que no
-- escribiera "titular" ni "subtitulo:" dentro de la imagen.
--
-- Vive en el brand book y no en `barbara_clientes` porque es una decision de
-- IDENTIDAD de la marca, igual que la paleta y la tipografia, no de operacion.
alter table public.barbara_brand_book
  add column if not exists plantilla text not null default 'editorial';

comment on column public.barbara_brand_book.plantilla is
  'editorial | bloque | ficha | foto — ver services/barbara/plantillas.mjs';
