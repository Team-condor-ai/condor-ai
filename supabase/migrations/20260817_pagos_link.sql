-- Portal Cóndor · guardar el link de pago que devuelve Mercado Pago.
--
-- Antes el `init_point` se devolvía al navegador y se perdía: si cerrabas la
-- pestaña o el cliente decía "no me llegó el correo", había que generar un
-- cobro NUEVO — y eso deja filas duplicadas en `pagos` por un solo cobro real.
-- Guardándolo, el mismo link se puede volver a copiar o reenviar.
alter table public.pagos add column if not exists link text;

-- Concepto libre del cobro puntual: "landing de septiembre", no solo
-- "setup"/"mensual". `detalle` ya existe desde 20260817_clientes_flexibles.sql
-- y se reusa para esto.
