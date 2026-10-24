-- 24-oct-2026 · Fuera Bárbara (pedido de Max). Sus datos (28 filas: brand book, canal, chats, clientes,
-- eventos, formulario y playbooks) quedaron respaldados en `respaldo.barbara_2026_10_24` (esquema sin acceso
-- desde la API). Las 8 Edge Functions de Bárbara y los buckets barbara-logos/-media/-referencias (vacíos) se
-- borraron por la API de gestión.
drop policy if exists admin_gestiona_storage_barbara on storage.objects;
drop policy if exists admin_manage_barbara_logos on storage.objects;
drop policy if exists admin_manage_barbara_referencias on storage.objects;
drop policy if exists cliente_lee_su_storage_barbara on storage.objects;
drop policy if exists cliente_sube_sus_referencias on storage.objects;
do $$ declare t record; begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'barbara%' loop
    execute format('drop table if exists public.%I cascade', t.relname);
  end loop;
  for t in select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'barbara\_%' loop
    execute format('drop function if exists %s cascade', t.f);
  end loop;
end $$;
