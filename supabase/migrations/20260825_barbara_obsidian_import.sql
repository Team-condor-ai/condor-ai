-- Importar desde Obsidian nunca pisa memoria: crea una propuesta auditable.

alter table public.barbara_memoria_propuestas
  add column if not exists hash_contenido text;
create unique index if not exists barbara_propuesta_hash_pendiente_idx
  on public.barbara_memoria_propuestas (barbara_cliente_id,hash_contenido)
  where estado='pendiente' and hash_contenido is not null;

create or replace function public.barbara_proponer_importacion_obsidian(
  p_barbara_cliente_id uuid,p_nodo_id uuid,p_version_esperada integer,p_tipo text,
  p_titulo text,p_contenido text,p_etiquetas text[],p_hash text
) returns public.barbara_memoria_propuestas
language plpgsql security definer set search_path=public as $$
declare actual public.barbara_memoria_nodos; propuesta public.barbara_memoria_propuestas; accion text; razon text;
begin
  if auth.role()<>'service_role' then raise exception 'sólo service_role'; end if;
  if p_tipo not in ('perfil','gusto','dato') or length(trim(coalesce(p_titulo,''))) not between 1 and 120
    or length(trim(coalesce(p_contenido,''))) not between 1 and 1600 or p_hash !~ '^[a-f0-9]{64}$'
    or coalesce(array_length(p_etiquetas,1),0)>12 then raise exception 'nota Obsidian inválida'; end if;
  if not exists (select 1 from public.barbara_clientes where id=p_barbara_cliente_id) then raise exception 'cliente inexistente'; end if;

  if p_nodo_id is null then accion:='crear'; razon:='Nota nueva importada desde Obsidian';
  else
    select * into actual from public.barbara_memoria_nodos where id=p_nodo_id and barbara_cliente_id=p_barbara_cliente_id;
    if not found then raise exception 'El nodo indicado no pertenece al cliente'; end if;
    accion:=case when actual.version=p_version_esperada then 'actualizar' else 'conflicto' end;
    razon:=case when actual.version=p_version_esperada then 'Edición externa sobre la versión vigente'
      else format('Conflicto de versión: nota %s, base %s',p_version_esperada,actual.version) end;
    if actual.tipo=p_tipo and actual.titulo=trim(p_titulo) and actual.contenido=trim(p_contenido)
      and actual.etiquetas=coalesce(p_etiquetas,'{}') then
      raise exception 'La nota no contiene cambios';
    end if;
  end if;

  insert into public.barbara_memoria_propuestas (
    barbara_cliente_id,nodo_objetivo_id,accion,tipo,titulo,contenido,confianza,etiquetas,
    fuente_tipo,fuente_id,evidencia,razon,hash_contenido
  ) values (
    p_barbara_cliente_id,p_nodo_id,accion,p_tipo,trim(p_titulo),trim(p_contenido),1,
    coalesce(p_etiquetas,'{}'),'obsidian',p_hash,'Importación Markdown',razon,p_hash
  ) on conflict (barbara_cliente_id,hash_contenido) where estado='pendiente' and hash_contenido is not null
    do update set razon=excluded.razon
  returning * into propuesta;
  return propuesta;
end $$;

revoke all on function public.barbara_proponer_importacion_obsidian(uuid,uuid,integer,text,text,text,text[],text)
  from public,anon,authenticated;
grant execute on function public.barbara_proponer_importacion_obsidian(uuid,uuid,integer,text,text,text,text[],text)
  to service_role;
