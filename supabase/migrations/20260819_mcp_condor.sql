-- MCP de Cóndor: que el Claude de cada uno del equipo lea y escriba en el
-- portal — reuniones, biblioteca, clientes — igual que se hizo ayer con Veci
-- Leads, pero usando el Supabase REAL de Cóndor en vez de un backend aparte:
-- acá SÍ es el mismo producto, así que separar la base no tendría sentido.
--
-- POR QUÉ UN TOKEN Y NO EL LOGIN DE SUPABASE DIRECTO
-- ---------------------------------------------------------------------------
-- El login del portal es por magic link — pensado para un navegador, no para
-- pegarlo en la config de un MCP que corre en la máquina de cada uno. El
-- token es de larga duración y se genera DESDE una sesión ya autenticada
-- (`mcp-condor-token`), así que solo un admin real de verdad puede sacarse el
-- suyo — nunca se reparte a mano ni viaja fuera del portal.

alter table public.admins add column if not exists token text unique;

-- El resumen/las notas de una reunión. Hoy `reuniones` guarda cuándo y con
-- quién, pero no QUÉ SE HABLÓ — que es el dato que de verdad sirve como
-- contexto para un Claude. Sin esto, "dejar el contexto de la reunión" no
-- tenía dónde vivir.
alter table public.reuniones add column if not exists notas text;
alter table public.reuniones add column if not exists notas_actualizado_por text;
alter table public.reuniones add column if not exists notas_actualizado_en timestamptz;
