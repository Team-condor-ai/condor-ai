-- condor.ai · Bucket de Storage para los logos del brand book de Bárbara.
--
-- Las 5 tablas de "Agentes IA > Bárbara" ya existen y no se tocan (ver
-- 20260815141239_barbara_agentes_ia.sql / 20260815150000_barbara_memoria_y_chat.sql).
-- Este bucket es infraestructura NUEVA que el módulo necesita para el input
-- de archivo del brand book ("sube a Supabase Storage") — no existía ningún
-- bucket en el proyecto antes de esto.
--
-- Público de lectura (para poder mostrar el logo con una URL directa desde
-- el portal, igual que cualquier logo de marca), pero solo admins pueden
-- subir/editar/borrar — mismo patrón que `admin_all_barbara_*` del resto del
-- módulo.
insert into storage.buckets (id, name, public)
values ('barbara-logos', 'barbara-logos', true)
on conflict (id) do nothing;

drop policy if exists "admin_manage_barbara_logos" on storage.objects;
create policy "admin_manage_barbara_logos" on storage.objects
  for all
  using ( bucket_id = 'barbara-logos' and public.es_admin() )
  with check ( bucket_id = 'barbara-logos' and public.es_admin() );
