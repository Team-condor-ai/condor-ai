-- Información interna: notas con varias fotos/archivos y una vista propia
-- para PDFs o documentos rápidos. Conserva las columnas antiguas como
-- compatibilidad con las fichas ya creadas.

alter table public.notas_internas
  drop constraint if exists notas_internas_tipo_check;

alter table public.notas_internas
  add constraint notas_internas_tipo_check
    check (tipo in ('nota', 'cuenta', 'archivo'));

alter table public.notas_internas
  add column if not exists archivos jsonb not null default '[]'::jsonb;

update public.notas_internas
set archivos = jsonb_build_array(jsonb_build_object(
  'url', archivo_url,
  'nombre', coalesce(archivo_nombre, 'Archivo'),
  'peso_bytes', archivo_peso_bytes
))
where archivo_url is not null
  and jsonb_array_length(archivos) = 0;

create index if not exists notas_internas_tipo_actualizado_idx
  on public.notas_internas (tipo, actualizado_en desc);

notify pgrst, 'reload schema';
