-- Bárbara · bloqueo del contenido propio de Cóndor antes de publicar solo.
--
-- 26-ago-2026: el contenido propio pasa a generarse todos los días a las
-- 13:00 Chile y a publicarse SOLO a las 16:00 Chile (3h después), salvo que
-- Joaquín escriba "bloquear barbara" en el chat interno de Telegram en esa
-- ventana. Esta tabla es la señal que separa esos dos momentos: la escribe
-- `telegram-barbara-clientes` (webhook) y la lee `barbara-publicar-automatico.yml`
-- antes de disparar la publicación real.
--
-- Sin policy de SELECT/INSERT para anon/authenticated a propósito: solo la
-- escriben y leen el webhook y el workflow, los dos con la service role key
-- (mismo criterio que `api_credenciales` y `ratia_leads`).
create table if not exists public.barbara_bloqueos_contenido (
  fecha date primary key,
  bloqueado_en timestamptz not null default now(),
  motivo text
);

alter table public.barbara_bloqueos_contenido enable row level security;
