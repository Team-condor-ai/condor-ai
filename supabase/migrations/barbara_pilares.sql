-- Bárbara · pilares de contenido por cliente.
--
-- Hasta ahora el reparto de qué se publica estaba escrito en código
-- (barbara.mjs: cuatro series fijas rotando por semana ISO). Sirve para la
-- cuenta propia de Cóndor y NO se puede copiar a un cliente: de esas cuatro
-- series, tres hablan de Cóndor o de Bárbara, y esa proporción de auto-venta
-- en la cuenta de un cliente le espanta los seguidores.
--
-- La mezcla pasa a ser un dato del onboarding. Ver services/barbara/pilares.mjs
-- para el catálogo de pilares y cómo se elige el de cada día (por deuda
-- acumulada, no por turno: converge a la mezcla pedida aunque se salten días).

-- La mezcla que pidió la marca, como {"educar": 40, "mostrar": 25, ...}.
-- NULL = todavía no la definió; el motor usa MEZCLA_POR_DEFECTO de pilares.mjs.
alter table public.barbara_formulario
  add column if not exists pilares jsonb;

comment on column public.barbara_formulario.pilares is
  'Mezcla de pilares de contenido pedida por la marca, p.ej. {"educar":40,"mostrar":25,"autoridad":20,"comunidad":15}. Acepta pesos crudos o porcentajes: pilares.mjs los normaliza. NULL = usa la mezcla por defecto.';

-- Qué pilar terminó usando cada pieza. Es lo que lee `elegirPilar` para
-- calcular la deuda, así que sin esta columna el reparto no converge a nada.
alter table public.barbara_memoria
  add column if not exists pilar text;

comment on column public.barbara_memoria.pilar is
  'Pilar de contenido de esta pieza (educar/mostrar/autoridad/comunidad/prueba_social). Lo escribe el motor al cerrar la pieza; es la base del cálculo de deuda que elige el pilar siguiente.';

-- El motor pide las últimas N piezas de un cliente ordenadas por fecha para
-- calcular el reparto real.
create index if not exists barbara_memoria_pilar_por_cliente
  on public.barbara_memoria (barbara_cliente_id, creado_en desc)
  where pilar is not null;
