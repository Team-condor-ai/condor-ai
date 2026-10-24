-- 24-oct-2026 · Chat con cada cliente dentro del portal (pedido de Max: «como WhatsApp, pero desde la plataforma»).
-- Reemplaza a «Solicitudes»: un mensaje del cliente se puede marcar como pedido y lleva su estado
-- (nueva → en_curso → lista), así no se pierde el seguimiento que daban las solicitudes.
--
-- Seguridad:
--  · El equipo ve y escribe en todas las conversaciones.
--  · Un cliente solo ve la suya y solo puede escribir como cliente (de_equipo = false, autor = su correo).
--  · Marcar leído y cambiar el estado de un pedido va por funciones (no hay UPDATE abierto para el cliente).
--  · Adjuntos en el bucket privado `chat`, carpeta = id del cliente.
--  · «Escribiendo…» por un canal privado de Realtime `chat:<cliente_id>` con la misma regla.

create table if not exists public.chat_mensajes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  de_equipo boolean not null,
  autor text not null,
  texto text,
  adjunto_ruta text,
  adjunto_nombre text,
  adjunto_tipo text,
  adjunto_bytes bigint,
  pedido_estado text check (pedido_estado in ('nueva', 'en_curso', 'lista')),
  pedido_responsable text,
  creado_en timestamptz not null default now(),
  leido_en timestamptz,
  constraint chat_algo check (coalesce(btrim(texto), '') <> '' or adjunto_ruta is not null)
);
create index if not exists chat_por_cliente on public.chat_mensajes (cliente_id, creado_en desc);
create index if not exists chat_sin_leer on public.chat_mensajes (cliente_id) where leido_en is null;
alter table public.chat_mensajes enable row level security;

-- ¿El usuario de esta sesión es el cliente `c`? (por correo, cliente activo)
create or replace function public.es_cliente(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from clientes where id = c and lower(email) = lower((select auth.jwt() ->> 'email')) and archivado is not true)
$$;
revoke execute on function public.es_cliente(uuid) from public, anon;
grant execute on function public.es_cliente(uuid) to authenticated;

drop policy if exists chat_equipo on public.chat_mensajes;
create policy chat_equipo on public.chat_mensajes for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));
drop policy if exists chat_cliente_ve on public.chat_mensajes;
create policy chat_cliente_ve on public.chat_mensajes for select to authenticated using (public.es_cliente(cliente_id));
drop policy if exists chat_cliente_escribe on public.chat_mensajes;
create policy chat_cliente_escribe on public.chat_mensajes for insert to authenticated
  with check (public.es_cliente(cliente_id) and de_equipo = false and lower(autor) = lower((select auth.jwt() ->> 'email'))
              and pedido_estado is null and leido_en is null);

-- Marca leídos los mensajes del OTRO lado en una conversación.
create or replace function public.chat_marcar_leido(c uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if public.es_admin() then
    update chat_mensajes set leido_en = now() where cliente_id = c and de_equipo = false and leido_en is null;
  elsif public.es_cliente(c) then
    update chat_mensajes set leido_en = now() where cliente_id = c and de_equipo = true and leido_en is null;
  else
    raise exception 'sin acceso';
  end if;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.chat_marcar_leido(uuid) from public, anon;
grant execute on function public.chat_marcar_leido(uuid) to authenticated;

-- Bandeja del equipo: una fila por cliente activo, con el último mensaje y cuántos no ha leído el equipo.
create or replace function public.chat_bandeja()
returns table (cliente_id uuid, negocio text, nombre text, email text, ultimo_texto text, ultimo_de_equipo boolean,
               ultimo_en timestamptz, sin_leer integer, pedidos_abiertos integer)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.es_admin() then raise exception 'solo el equipo'; end if;
  return query
  select c.id, c.negocio, c.nombre, c.email,
         u.texto_o_adjunto, u.de_equipo, u.creado_en,
         coalesce((select count(*) from chat_mensajes m where m.cliente_id = c.id and not m.de_equipo and m.leido_en is null), 0)::int,
         coalesce((select count(*) from chat_mensajes m where m.cliente_id = c.id and m.pedido_estado in ('nueva', 'en_curso')), 0)::int
  from clientes c
  left join lateral (
    select coalesce(nullif(btrim(m.texto), ''), '📎 ' || m.adjunto_nombre) as texto_o_adjunto, m.de_equipo, m.creado_en
    from chat_mensajes m where m.cliente_id = c.id order by m.creado_en desc limit 1
  ) u on true
  where c.archivado is not true
  order by u.creado_en desc nulls last, coalesce(c.negocio, c.nombre);
end $$;
revoke execute on function public.chat_bandeja() from public, anon;
grant execute on function public.chat_bandeja() to authenticated;

-- Tiempo real: los mensajes nuevos llegan solos (Realtime respeta las políticas de arriba).
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'chat_mensajes') then
    alter publication supabase_realtime add table public.chat_mensajes;
  end if;
end $$;

-- «Escribiendo…»: canal privado chat:<cliente_id>, para el equipo y para ese cliente.
create or replace function public.puede_canal_chat(topico text) returns boolean
language sql stable security definer set search_path = public as $$
  select case when topico ~ '^chat:[0-9a-f-]{36}$'
              then public.es_admin() or public.es_cliente(substr(topico, 6)::uuid)
              else false end
$$;
revoke execute on function public.puede_canal_chat(text) from public, anon;
grant execute on function public.puede_canal_chat(text) to authenticated;
drop policy if exists chat_canal_lee on realtime.messages;
create policy chat_canal_lee on realtime.messages for select to authenticated
  using ((select realtime.topic()) like 'chat:%' and public.puede_canal_chat((select realtime.topic())));
drop policy if exists chat_canal_escribe on realtime.messages;
create policy chat_canal_escribe on realtime.messages for insert to authenticated
  with check ((select realtime.topic()) like 'chat:%' and public.puede_canal_chat((select realtime.topic())));

-- Adjuntos.
insert into storage.buckets (id, name, public, file_size_limit)
values ('chat', 'chat', false, 25 * 1024 * 1024)
on conflict (id) do nothing;
drop policy if exists chat_obj_equipo on storage.objects;
create policy chat_obj_equipo on storage.objects for all to authenticated
  using (bucket_id = 'chat' and (select public.es_admin())) with check (bucket_id = 'chat' and (select public.es_admin()));
drop policy if exists chat_obj_cliente_lee on storage.objects;
create policy chat_obj_cliente_lee on storage.objects for select to authenticated
  using (bucket_id = 'chat' and public.puede_canal_chat('chat:' || split_part(name, '/', 1)));
drop policy if exists chat_obj_cliente_sube on storage.objects;
create policy chat_obj_cliente_sube on storage.objects for insert to authenticated
  with check (bucket_id = 'chat' and public.puede_canal_chat('chat:' || split_part(name, '/', 1)));

-- Las solicitudes que existían pasan al chat como pedidos (con la respuesta del equipo, si la había).
insert into public.chat_mensajes (cliente_id, de_equipo, autor, texto, pedido_estado, pedido_responsable, creado_en, leido_en)
select s.cliente_id, false, coalesce(c.email, 'cliente'), s.titulo || coalesce(E'\n' || nullif(s.detalle, ''), ''), s.estado, s.responsable, s.creado_en, s.creado_en
from public.solicitudes s join public.clientes c on c.id = s.cliente_id
where not exists (select 1 from public.chat_mensajes m where m.cliente_id = s.cliente_id and m.creado_en = s.creado_en);
insert into public.chat_mensajes (cliente_id, de_equipo, autor, texto, creado_en, leido_en)
select s.cliente_id, true, coalesce(s.responsable, 'Cóndor'), s.respuesta, coalesce(s.lista_en, s.en_curso_en, s.actualizado_en), now()
from public.solicitudes s where coalesce(s.respuesta, '') <> ''
  and not exists (select 1 from public.chat_mensajes m where m.cliente_id = s.cliente_id and m.texto = s.respuesta);

-- «Actividad reciente» del Panel: los mensajes de clientes reemplazan a las solicitudes.
create or replace view public.actividad_reciente with (security_invoker = true) as
 select 'lead:' || e.id::text as id, e.creado_en, coalesce(e.autor, 'sistema') as quien,
        case e.tipo when 'etapa' then 'movió un lead a ' || e.a_etapa when 'sistema' then 'recibió un lead nuevo'
                    when 'reunion' then 'actualizó una reunión' else 'anotó en un lead' end as accion,
        'leads'::text as modulo
   from lead_eventos e
 union all
 select 'clave:' || a.id::text, a.creado_en, a.quien, 'reveló la clave «' || coalesce(k.titulo, '?') || '»', 'boveda'
   from claves_accesos a left join claves k on k.id = a.clave_id
 union all
 select 'chat:' || m.id::text, m.creado_en, coalesce(c.negocio, c.nombre, 'cliente'),
        case when m.adjunto_ruta is not null and coalesce(m.texto, '') = '' then 'mandó un archivo por el chat'
             else 'escribió por el chat: ' || left(m.texto, 80) end,
        'solicitudes'
   from chat_mensajes m join clientes c on c.id = m.cliente_id
  where not m.de_equipo;
