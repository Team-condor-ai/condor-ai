-- Bárbara · acceso seguro a la biblioteca privada de assets.
-- El bucket ya existe y es privado. Estas policies permiten que un cliente
-- pida una URL firmada sólo para objetos catalogados en SU barbara_media.

drop policy if exists "admin_gestiona_storage_barbara" on storage.objects;
create policy "admin_gestiona_storage_barbara" on storage.objects
  for all to authenticated
  using (bucket_id = 'barbara-media' and public.es_admin())
  with check (bucket_id = 'barbara-media' and public.es_admin());

drop policy if exists "cliente_lee_su_storage_barbara" on storage.objects;
create policy "cliente_lee_su_storage_barbara" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'barbara-media'
    and exists (
      select 1
      from public.barbara_media media
      join public.barbara_memoria memoria on memoria.id = media.barbara_memoria_id
      join public.barbara_clientes bc on bc.id = memoria.barbara_cliente_id
      join public.clientes c on c.id = bc.cliente_id
      where media.storage_path = storage.objects.name
        and lower(c.email) = lower((select auth.jwt() ->> 'email'))
    )
  );

comment on policy "cliente_lee_su_storage_barbara" on storage.objects is
  'Permite URLs firmadas sólo cuando el objeto está catalogado y pertenece al cliente autenticado.';
