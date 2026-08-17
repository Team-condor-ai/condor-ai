-- Portal Cóndor · la ficha del cliente deja de asumir un solo tipo de trato.
--
-- POR QUÉ (17-ago-2026)
-- ---------------------------------------------------------------------------
-- La ficha daba por hecho que TODO cliente paga setup y mensualidad, y que su
-- plan es uno de tres fijos. En la realidad hay clientes que solo pagan setup,
-- otros solo mensualidad, y otros —como los trabajos que Howden encarga cada
-- tanto— que no tienen ni plan ni recurrencia: son encargos sueltos que se
-- cobran por transferencia contra boleta de garantía.
--
-- Con el modelo viejo esos clientes obligaban a inventar montos en 0 y dejar
-- campos vacíos que igual aparecían en pantalla, y no había dónde anotar el
-- trabajo puntual que sí se cobró.

-- ───────────────────────────────────────────────────────────────────────────
-- 1) Qué cobra este cliente (y qué no)
-- ───────────────────────────────────────────────────────────────────────────
alter table public.clientes add column if not exists cobra_setup   boolean default true;
alter table public.clientes add column if not exists cobra_mensual boolean default true;
alter table public.clientes add column if not exists notas         text;

-- ───────────────────────────────────────────────────────────────────────────
-- 2) Cobros puntuales: trabajos que no son ni setup ni mensualidad
--
-- Se reusa `pagos` en vez de crear una tabla nueva a propósito: esto ES el
-- historial de pagos del cliente. Tenerlo en dos tablas obligaría a unirlas
-- cada vez que alguien pregunta "cuánto nos ha pagado", que es justo la
-- pregunta que uno le hace a una ficha.
-- ───────────────────────────────────────────────────────────────────────────
alter table public.pagos add column if not exists detalle text;
alter table public.pagos add column if not exists fecha   date;
alter table public.pagos add column if not exists metodo  text;

-- `pagos` ya tenía RLS de admin desde `portal_admin.sql` (admin_all_pagos),
-- así que no hace falta tocar políticas.
