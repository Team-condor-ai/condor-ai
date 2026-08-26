-- Destraba la Fase 3 (agencia autónoma supervisada): hoy `barbara_canales`
-- solo se puede poblar por SQL a mano porque su RLS únicamente permite
-- INSERT/UPDATE a es_admin() y no existe ninguna RPC de creación. Esta
-- función es ese camino, calcada del patrón de barbara_guardar_nodo
-- (20260825_barbara_cerebro_versionado.sql): security definer + guardia de
-- acceso + evento auditable. Creación solo staff a propósito: account_ref
-- no se valida contra Blotato, y un cliente escribiéndolo mal rompería la
-- publicación en silencio.

create or replace function public.barbara_crear_canal(
  p_barbara_cliente_id uuid,
  p_plataforma text,
  p_account_ref text,
  p_target jsonb default '{}'
) returns public.barbara_canales
language plpgsql security definer set search_path = public
as $$
declare
  fila public.barbara_canales;
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if p_plataforma not in ('instagram', 'tiktok', 'facebook', 'linkedin') then
    raise exception 'Plataforma no soportada';
  end if;
  if length(trim(coalesce(p_account_ref, ''))) < 1 then
    raise exception 'Falta la referencia de la cuenta';
  end if;
  if not public.es_admin() then
    raise exception 'Solo el equipo puede conectar un canal';
  end if;

  -- auto_publicar nace SIEMPRE false, sin excepción (mismo invariante ya
  -- documentado en el comentario de la tabla): activarlo es un paso aparte.
  insert into public.barbara_canales (
    barbara_cliente_id, plataforma, proveedor, account_ref, target, activo, auto_publicar
  ) values (
    p_barbara_cliente_id, p_plataforma, 'blotato', trim(p_account_ref), coalesce(p_target, '{}'), true, false
  )
  on conflict (barbara_cliente_id, plataforma, proveedor) do update set
    account_ref = excluded.account_ref,
    target = excluded.target,
    activo = true,
    actualizado_en = now()
  returning * into fila;

  insert into public.barbara_eventos (barbara_cliente_id, tipo, actor, fuente_tipo, fuente_id, payload)
  values (
    fila.barbara_cliente_id, 'canal_conectado', coalesce(nullif(actor_email, ''), 'staff'),
    'canal', fila.id::text, jsonb_build_object('plataforma', fila.plataforma)
  );

  return fila;
end;
$$;

revoke all on function public.barbara_crear_canal(uuid, text, text, jsonb) from public;
grant execute on function public.barbara_crear_canal(uuid, text, text, jsonb) to authenticated;
