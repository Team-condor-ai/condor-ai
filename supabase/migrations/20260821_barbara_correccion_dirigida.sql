-- Bárbara · corrección dirigida: que el reintento arregle LO QUE SE PIDIÓ.
--
-- EL PROBLEMA (21-ago-2026)
-- ---------------------------------------------------------------------------
-- Hoy, cuando el cliente pide un cambio, el webhook dispara el workflow con
-- RETRY=1 y el motor le dice al modelo, textualmente:
--
--     "ESTE ES UN REINTENTO: el cliente pidió una corrección sobre la versión
--      anterior. Genera una versión CLARAMENTE MEJOR y distinta."
--
-- Y nada más. Faltan las dos cosas que hacen falta para corregir:
--
--   1. QUÉ pidió el cliente. El texto de la corrección entra a
--      `barbara_chats` y el motor nunca lee esa tabla en el reintento.
--   2. QUÉ había antes. `barbara_memoria` guarda el ángulo, la fecha y el
--      tipo — no el contenido. Así que la "corrección" no puede ser una
--      corrección: es una pieza nueva desde cero.
--
-- El resultado se parece a aprender pero no lo es. El cliente pide "el
-- titular del slide 3 más corto" y recibe un carrusel completamente distinto,
-- donde a veces el problema original sigue ahí. Y como cada reintento gasta
-- uno de los 3 intentos, tres pedidos razonables lo dejan bloqueado sin que
-- nadie haya arreglado nada.
--
-- QUÉ AGREGA ESTA MIGRACIÓN
-- ---------------------------------------------------------------------------
-- Lo mínimo para que el reintento sea una EDICIÓN y no una regeneración, y
-- para poder comprobar después si de verdad se cumplió lo pedido.

-- ═══════════════════════════════════════════════════════════════════════
-- 1) LA PIEZA, GUARDADA
--
-- El JSON que generó el modelo (slides con su titular y cuerpo, o clips y
-- caption). Sin esto no hay "versión anterior" a la que corregirle algo.
--
-- Se guarda el plan, no las imágenes: los carruseles se COMPONEN desde este
-- JSON con `plantillas.mjs`, así que el JSON ES la pieza. Guardar los PNG
-- sería guardar el resultado de imprimirla.
-- ═══════════════════════════════════════════════════════════════════════
alter table public.barbara_memoria
  add column if not exists contenido jsonb;

-- ═══════════════════════════════════════════════════════════════════════
-- 2) EL PEDIDO, COMO LISTA
--
-- La corrección del cliente llega como una frase suelta: "el logo se ve
-- chico y el fondo muy oscuro, además el precio está mal". Eso no se puede
-- verificar. Como lista sí:
--
--   [{"id":1,"que":"logo","accion":"agrandar"},
--    {"id":2,"que":"fondo","accion":"aclarar"},
--    {"id":3,"que":"precio","accion":"corregir a $9.990"}]
--
-- Guardarla importa por dos motivos distintos: permite pedirle al modelo que
-- cambie SOLO eso, y permite comprobar punto por punto si lo hizo.
-- ═══════════════════════════════════════════════════════════════════════
alter table public.barbara_memoria
  add column if not exists cambios_pedidos jsonb;

-- Qué puntos de esa lista quedaron cumplidos, según la verificación. Sirve
-- para saber QUÉ le cuesta a Bárbara, que es más útil que saber qué pide el
-- cliente: si "acortar textos" se cumple siempre a la primera y "cambiar el
-- tono" nunca, eso dice dónde está el trabajo pendiente del producto.
alter table public.barbara_memoria
  add column if not exists cambios_cumplidos jsonb;

-- De qué pieza es reintento. Encadena los intentos de una misma corrección,
-- que hasta ahora quedaban como filas sueltas indistinguibles de piezas
-- nuevas. Es también lo que permite contar "cuántos intentos costó".
alter table public.barbara_memoria
  add column if not exists corrige_a uuid references public.barbara_memoria(id) on delete set null;

create index if not exists barbara_memoria_corrige_idx
  on public.barbara_memoria (corrige_a);

-- ═══════════════════════════════════════════════════════════════════════
-- 3) AVISARLE A STAFF CUANDO SE ACABAN LOS INTENTOS
--
-- Hoy, al tercer intento fallido, el cliente queda `bloqueado` y no pasa
-- nada más: nadie se entera. Es el mismo modo de falla silenciosa que ya
-- costó caro cuando las 3 correcciones eran por cliente de por vida — el
-- sistema se traba y solo se descubre porque el cliente reclama.
--
-- Con esto queda registrado qué se pidió, qué se intentó y qué no se logró,
-- para que el portal pueda mostrarlo y alguien pueda hacerse cargo.
-- ═══════════════════════════════════════════════════════════════════════
alter table public.barbara_correcciones
  add column if not exists ultimo_pedido text;
alter table public.barbara_correcciones
  add column if not exists ultimo_faltante jsonb;
alter table public.barbara_correcciones
  add column if not exists avisado_staff_en timestamptz;
