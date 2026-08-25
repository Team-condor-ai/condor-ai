-- Publicación es un paso explícito posterior a la aprobación. Se registra el
-- canal y URL, pero no se simula una integración externa que no exista.
alter table public.barbara_memoria
  add column if not exists canal_publicacion text,
  add column if not exists publicacion_url text,
  add column if not exists publicada_en timestamptz,
  add column if not exists publicada_por text;

notify pgrst, 'reload schema';
