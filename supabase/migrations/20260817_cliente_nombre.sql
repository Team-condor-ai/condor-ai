-- Portal Cóndor · el cliente tiene NOMBRE, y el correo pasa a ser opcional.
--
-- POR QUÉ (17-ago-2026)
-- ---------------------------------------------------------------------------
-- `email` era `not null` y no había dónde poner el nombre de la persona, así
-- que quien cargaba un cliente sin correo terminaba escribiendo el nombre en
-- el campo del correo. En la base de producción ya pasó: hay una fila cuyo
-- "correo" es literalmente "Carmen Reyes".
--
-- Eso rompe dos cosas a la vez: el cliente nunca podrá entrar al portal (su
-- correo no es un correo) y cualquier envío a esa dirección falla en silencio.
--
-- Ahora el correo puede quedar vacío a propósito. La regla queda explícita en
-- la interfaz: SIN correo el cliente no tiene acceso al portal, y con eso
-- basta para los clientes que solo se administran internamente.

-- 1) Nombre de la persona de contacto (distinto de `negocio`, que es la empresa)
alter table public.clientes add column if not exists nombre text;

-- 2) El correo deja de ser obligatorio
alter table public.clientes alter column email drop not null;

-- 3) Rescatar los "correos" que en realidad eran nombres.
--    Solo toca filas cuyo email NO tiene forma de correo (sin @) y que aún no
--    tienen nombre: mueve el valor a `nombre` y deja el correo vacío.
update public.clientes
   set nombre = email,
       email  = null
 where email is not null
   and email not like '%@%'
   and (nombre is null or nombre = '');
