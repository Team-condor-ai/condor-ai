-- Bárbara · recuperación semántica de memoria con pgvector (27-ago-2026).
--
-- Hasta ahora `memoria.mjs` elegía qué nota entra al prompt por superposición
-- de palabras (ver STACK-TECNICO.md, "Capa de recuperación") — decisión
-- deliberada mientras no hubiera proveedor de embeddings aprobado. Ese
-- proveedor ya está aprobado (se reusa OpenAI, YA integrado para transcribir
-- notas de voz en `telegram-barbara-clientes`, mismo `OPENAI_API_KEY` — no es
-- una cuenta nueva). Esta migración solo agrega la columna y la búsqueda por
-- similitud; el puntaje semántico se SUMA al puntaje por palabras existente
-- en `memoria.mjs`, no lo reemplaza.
--
-- Alcance: solo `barbara_memoria_nodos` (gustos/datos/perfil de la marca) —
-- es la capa que motivó este cambio. `barbara_reglas` y `barbara_patrones`
-- quedan para una segunda pasada si hace falta, con su propio camino de
-- escritura (webhook de Telegram, `patrones.mjs`).
--
-- Sin índice HNSW/IVFFlat a propósito, mismo argumento que ya usa
-- STACK-TECNICO.md para el volumen real (cientos de notas por cliente, no
-- millones): fuerza bruta es instantánea a ese tamaño. Se agrega índice
-- recién cuando el volumen lo pida.

create extension if not exists vector;

alter table public.barbara_memoria_nodos
  add column if not exists embedding vector(1536);

comment on column public.barbara_memoria_nodos.embedding is
  'text-embedding-3-small (OpenAI) del título+contenido. Null hasta que memoria-semantica.mjs lo rellena — no bloquea la escritura del nodo.';

-- Búsqueda por similitud, acotada al cliente. Es de uso interno del motor
-- (clientes.mjs, service_role) — no se expone al portal, así que no se le
-- da grant a `authenticated` como al resto de las funciones de este archivo.
create or replace function public.barbara_memoria_similares(
  p_barbara_cliente_id uuid,
  p_embedding vector(1536),
  p_limite integer default 8
) returns table (id uuid, distancia float8)
language sql stable security definer set search_path = public
as $$
  select n.id, (n.embedding <=> p_embedding) as distancia
  from public.barbara_memoria_nodos n
  where n.barbara_cliente_id = p_barbara_cliente_id
    and n.activo = true
    and n.embedding is not null
  order by n.embedding <=> p_embedding
  limit greatest(1, least(p_limite, 50));
$$;

revoke all on function public.barbara_memoria_similares(uuid, vector, integer) from public;
