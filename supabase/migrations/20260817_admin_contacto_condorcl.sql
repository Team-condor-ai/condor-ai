-- Portal Cóndor: agrega contacto@teamcondorcl.com a los admins.
--
-- POR QUÉ (17-ago-2026)
-- ---------------------------------------------------------------------------
-- "Nuevo cliente" no funcionaba. La causa más probable, verificada contra el
-- código: solo 4 correos están en `public.admins` (portal_admin.sql) y
-- `es_admin()` es lo único que habilita `admin_all_clientes` — la política
-- RLS que permite el INSERT. contacto@teamcondorcl.com, el correo de la
-- empresa, no estaba en esa lista. Con eso, cualquier alta/edición/baja de
-- cliente hecha desde ese correo la rechaza RLS en silencio: la petición
-- llega, Supabase la corta, y en el formulario se lee como "no funciona".
--
-- Pega y ejecuta en: Supabase -> SQL Editor -> New query -> Run
-- (mismo patrón que portal_admin.sql, `on conflict do nothing` para poder
-- correrlo más de una vez sin duplicar).
insert into public.admins (email, nombre) values
  ('contacto@teamcondorcl.com', 'Cóndor AI')
on conflict (email) do nothing;
