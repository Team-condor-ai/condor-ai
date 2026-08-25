-- Generar y entregar son dos fases independientes. Una caída de Telegram no
-- debe perder la pieza ni obligar a volver a pagar su generación.

alter table public.barbara_memoria
  add column if not exists entrega_estado text,
  add column if not exists entrega_intentos integer not null default 0,
  add column if not exists entrega_proximo_intento timestamptz not null default now(),
  add column if not exists entrega_claim_token uuid,
  add column if not exists entrega_claimed_at timestamptz,
  add column if not exists entrega_ultimo_error text,
  add column if not exists telegram_media_ids jsonb not null default '[]'::jsonb,
  add column if not exists telegram_caption_id bigint,
  add column if not exists entregada_en timestamptz;

-- Las filas anteriores a esta migración pertenecen al flujo histórico que ya
-- enviaba Telegram antes de escribir memoria. No se reenvían retroactivamente.
update public.barbara_memoria set entrega_estado = 'entregada', entregada_en = coalesce(entregada_en, creado_en)
where entrega_estado is null;
alter table public.barbara_memoria alter column entrega_estado set default 'pendiente';
alter table public.barbara_memoria alter column entrega_estado set not null;
alter table public.barbara_memoria drop constraint if exists barbara_memoria_entrega_estado_check;
alter table public.barbara_memoria add constraint barbara_memoria_entrega_estado_check
  check (entrega_estado in ('incompleta','pendiente','entregando','media_enviada','entregada','fallida'));

create index if not exists barbara_memoria_entrega_cola_idx
  on public.barbara_memoria (entrega_estado, entrega_proximo_intento)
  where entrega_estado in ('pendiente','fallida');

create or replace function public.barbara_recuperar_entregas_colgadas() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.role() <> 'service_role' then raise exception 'sólo service_role'; end if;
  update public.barbara_memoria set
    entrega_estado = case when jsonb_array_length(telegram_media_ids) > 0 then 'media_enviada' else 'fallida' end,
    entrega_claim_token = null,
    entrega_claimed_at = null,
    entrega_proximo_intento = now(),
    entrega_ultimo_error = 'claim vencido; recuperado automáticamente'
  where entrega_estado = 'entregando' and entrega_claimed_at < now() - interval '15 minutes';
  get diagnostics n = row_count; return n;
end $$;

create or replace function public.barbara_reclamar_entregas(p_limite integer default 10)
returns table (
  id uuid, claim_token uuid, telegram_chat_id text, negocio text, tipo text,
  caption text, telegram_media_ids jsonb, media jsonb
) language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' then raise exception 'sólo service_role'; end if;
  return query
  with candidatas as (
    select bm.id from public.barbara_memoria bm
    join public.barbara_clientes bc on bc.id = bm.barbara_cliente_id
    where bm.entrega_estado in ('pendiente','fallida','media_enviada')
      and bm.entrega_proximo_intento <= now()
      and bm.entrega_intentos < 6
      and coalesce(bc.telegram_chat_id, '') <> ''
      and exists (select 1 from public.barbara_media x where x.barbara_memoria_id = bm.id)
    order by bm.creado_en
    for update of bm skip locked
    limit greatest(1, least(coalesce(p_limite, 10), 30))
  ), tomadas as (
    update public.barbara_memoria bm set
      entrega_estado = 'entregando',
      entrega_intentos = bm.entrega_intentos + 1,
      entrega_claim_token = gen_random_uuid(),
      entrega_claimed_at = now()
    from candidatas c where bm.id = c.id returning bm.*
  )
  select t.id, t.entrega_claim_token, bc.telegram_chat_id,
    coalesce(c.negocio, t.titulo, 'tu marca'), t.tipo,
    coalesce(t.contenido->>'caption', ''), t.telegram_media_ids,
    coalesce((select jsonb_agg(jsonb_build_object(
      'storage_path', x.storage_path, 'mime_type', x.mime_type,
      'bytes', x.bytes, 'sha256', x.sha256, 'tipo', x.tipo
    ) order by x.storage_path) from public.barbara_media x where x.barbara_memoria_id = t.id), '[]'::jsonb)
  from tomadas t
  join public.barbara_clientes bc on bc.id = t.barbara_cliente_id
  join public.clientes c on c.id = bc.cliente_id;
end $$;

create or replace function public.barbara_registrar_media_entregada(
  p_memoria_id uuid, p_claim_token uuid, p_message_ids jsonb
) returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.role() <> 'service_role' then raise exception 'sólo service_role'; end if;
  if jsonb_typeof(p_message_ids) <> 'array' or jsonb_array_length(p_message_ids) = 0 then
    raise exception 'IDs de Telegram inválidos';
  end if;
  update public.barbara_memoria set telegram_media_ids = p_message_ids, entrega_estado = 'entregando'
  where id = p_memoria_id and entrega_estado = 'entregando' and entrega_claim_token = p_claim_token;
  get diagnostics n = row_count; return n = 1;
end $$;

create or replace function public.barbara_confirmar_entrega(
  p_memoria_id uuid, p_claim_token uuid, p_caption_message_id bigint
) returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.role() <> 'service_role' then raise exception 'sólo service_role'; end if;
  if p_caption_message_id is null or p_caption_message_id <= 0 then raise exception 'message_id inválido'; end if;
  update public.barbara_memoria set
    telegram_caption_id = p_caption_message_id,
    entrega_estado = 'entregada', entregada_en = now(), entrega_ultimo_error = null,
    entrega_claim_token = null, entrega_claimed_at = null
  where id = p_memoria_id and entrega_estado = 'entregando'
    and entrega_claim_token = p_claim_token and jsonb_array_length(telegram_media_ids) > 0;
  get diagnostics n = row_count; return n = 1;
end $$;

create or replace function public.barbara_fallar_entrega(
  p_memoria_id uuid, p_claim_token uuid, p_error text
) returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.role() <> 'service_role' then raise exception 'sólo service_role'; end if;
  update public.barbara_memoria set
    entrega_estado = case when jsonb_array_length(telegram_media_ids) > 0 then 'media_enviada' else 'fallida' end,
    entrega_proximo_intento = now() + make_interval(mins => least(360, power(2, entrega_intentos)::integer * 2)),
    entrega_ultimo_error = left(coalesce(p_error, 'error desconocido'), 1000),
    entrega_claim_token = null, entrega_claimed_at = null
  where id = p_memoria_id and entrega_estado = 'entregando' and entrega_claim_token = p_claim_token;
  get diagnostics n = row_count; return n = 1;
end $$;

revoke all on function public.barbara_recuperar_entregas_colgadas(), public.barbara_reclamar_entregas(integer),
  public.barbara_registrar_media_entregada(uuid,uuid,jsonb), public.barbara_confirmar_entrega(uuid,uuid,bigint),
  public.barbara_fallar_entrega(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.barbara_recuperar_entregas_colgadas(), public.barbara_reclamar_entregas(integer),
  public.barbara_registrar_media_entregada(uuid,uuid,jsonb), public.barbara_confirmar_entrega(uuid,uuid,bigint),
  public.barbara_fallar_entrega(uuid,uuid,text) to service_role;
