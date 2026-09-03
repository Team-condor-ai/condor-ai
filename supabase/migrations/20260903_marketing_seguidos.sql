-- El snapshot de Instagram solo guardaba `cantidad` (seguidores). La API
-- ya devuelve `follows_count` (a cuántas cuentas seguimos) en la misma
-- llamada -- se agrega la columna para no desperdiciar el dato.
alter table public.marketing_seguidores_snapshot
  add column if not exists siguiendo integer;
