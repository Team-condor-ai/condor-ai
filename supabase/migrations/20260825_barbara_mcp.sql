-- Arranque acotado de la Fase 4 (cerebro portable): un MCP propio de
-- Bárbara, de un solo cliente por token — a diferencia de mcp-condor
-- (D:\Proyectos\condor-mcp), que es de un solo tenant (staff interno vía
-- admins.token). Acá cada token de `barbara_clientes.mcp_token` resuelve
-- exactamente un `barbara_cliente_id`, nunca una lista.
--
-- MVP de 3 tools (memoria, calendario, proponer_nota) — no la lista completa
-- de VISION-OBJETIVO-FINAL.md. La escritura (`barbara_mcp_proponer_nota`)
-- NUNCA toca un nodo activo directo: siempre crea una propuesta pendiente en
-- `barbara_memoria_propuestas`, igual que el resto del sistema de
-- aprendizaje — respeta el invariante "cada modificación de memoria
-- importante debe ser reversible y con procedencia".

alter table public.barbara_clientes add column if not exists mcp_token text unique;

-- Solo staff genera/rota por ahora: sin UI de auto-servicio para el cliente
-- en esta sesión (control de alcance, ver plan). Para el canario se genera
-- con una llamada puntual.
create or replace function public.barbara_generar_token_mcp(p_barbara_cliente_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare token text;
begin
  if not public.es_admin() then
    raise exception 'Solo el equipo puede generar este token';
  end if;
  token := 'bb_' || encode(gen_random_bytes(24), 'hex');
  update public.barbara_clientes set mcp_token = token where id = p_barbara_cliente_id;
  if not found then raise exception 'Cliente de Bárbara no encontrado'; end if;
  return token;
end;
$$;

revoke all on function public.barbara_generar_token_mcp(uuid) from public;
grant execute on function public.barbara_generar_token_mcp(uuid) to authenticated;

-- Gateada por service_role: la resolución de "a qué cliente pertenece este
-- token" vive en la Edge Function (mcp-barbara), no acá — esta RPC solo
-- confía en que quien la llama ya resolvió esa identidad.
create or replace function public.barbara_mcp_proponer_nota(
  p_barbara_cliente_id uuid,
  p_tipo text,
  p_titulo text,
  p_contenido text
) returns public.barbara_memoria_propuestas
language plpgsql security definer set search_path = public
as $$
declare fila public.barbara_memoria_propuestas;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Sólo servicio interno';
  end if;
  if p_tipo not in ('gusto', 'dato') then raise exception 'Tipo no soportado'; end if;
  if length(trim(coalesce(p_titulo, ''))) not between 1 and 120
     or length(trim(coalesce(p_contenido, ''))) not between 1 and 800 then
    raise exception 'Título o contenido inválido';
  end if;

  insert into public.barbara_memoria_propuestas (
    barbara_cliente_id, accion, tipo, titulo, contenido, confianza, etiquetas, fuente_tipo, evidencia
  ) values (
    p_barbara_cliente_id, 'crear', p_tipo, trim(p_titulo), trim(p_contenido), 1, '{}', 'mcp',
    'Propuesta creada vía MCP de Bárbara'
  ) returning * into fila;

  return fila;
end;
$$;

revoke all on function public.barbara_mcp_proponer_nota(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.barbara_mcp_proponer_nota(uuid, text, text, text) to service_role;
