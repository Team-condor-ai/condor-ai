-- Métricas reales y avisos idempotentes de hitos para Bárbara.
-- Sólo guarda agregados por publicación; no perfiles, comentarios ni audiencia.

alter table public.barbara_memoria
  add column if not exists metricas jsonb not null default '{}'::jsonb,
  add column if not exists metricas_actualizadas_en timestamptz;

create table if not exists public.barbara_metricas_snapshots (
  id bigserial primary key,
  barbara_cliente_id uuid not null references public.barbara_clientes(id) on delete cascade,
  barbara_memoria_id uuid not null references public.barbara_memoria(id) on delete cascade,
  programacion_id uuid not null references public.barbara_programaciones(id) on delete cascade,
  plataforma text not null,
  external_id text not null,
  capturado_en timestamptz not null default now(),
  me_gusta bigint not null default 0 check (me_gusta >= 0),
  comentarios bigint not null default 0 check (comentarios >= 0),
  compartidos bigint not null default 0 check (compartidos >= 0),
  guardados bigint not null default 0 check (guardados >= 0),
  alcance bigint not null default 0 check (alcance >= 0),
  impresiones bigint not null default 0 check (impresiones >= 0),
  reproducciones bigint not null default 0 check (reproducciones >= 0),
  clics bigint not null default 0 check (clics >= 0),
  seguidores bigint not null default 0 check (seguidores >= 0),
  unique (programacion_id, capturado_en)
);

create index if not exists barbara_metricas_cliente_fecha_idx
  on public.barbara_metricas_snapshots (barbara_cliente_id, capturado_en desc);

create table if not exists public.barbara_metricas_hitos (
  id uuid primary key default gen_random_uuid(),
  barbara_cliente_id uuid not null references public.barbara_clientes(id) on delete cascade,
  programacion_id uuid not null references public.barbara_programaciones(id) on delete cascade,
  metrica text not null check (metrica in ('me_gusta','alcance','reproducciones','guardados','compartidos')),
  umbral bigint not null check (umbral > 0),
  valor bigint not null check (valor >= umbral),
  creado_en timestamptz not null default now(),
  unique (programacion_id, metrica, umbral)
);

create table if not exists public.barbara_notificaciones (
  id uuid primary key default gen_random_uuid(),
  barbara_cliente_id uuid not null references public.barbara_clientes(id) on delete cascade,
  programacion_id uuid references public.barbara_programaciones(id) on delete cascade,
  tipo text not null,
  payload jsonb not null default '{}'::jsonb,
  estado text not null default 'pendiente' check (estado in ('pendiente','enviando','enviada','fallida')),
  intentos integer not null default 0,
  proximo_intento timestamptz not null default now(),
  claim_token uuid,
  claimed_at timestamptz,
  ultimo_error text,
  creado_en timestamptz not null default now(),
  enviada_en timestamptz
);

create index if not exists barbara_notificaciones_cola_idx
  on public.barbara_notificaciones (estado, proximo_intento) where estado in ('pendiente','fallida');
create unique index if not exists barbara_notificaciones_hito_unico_idx
  on public.barbara_notificaciones (tipo, programacion_id, (payload->>'metrica'), (payload->>'umbral'));

alter table public.barbara_metricas_snapshots enable row level security;
alter table public.barbara_metricas_hitos enable row level security;
alter table public.barbara_notificaciones enable row level security;

create policy "cliente_ve_sus_metricas" on public.barbara_metricas_snapshots for select using (exists (
  select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
  where bc.id = barbara_metricas_snapshots.barbara_cliente_id
    and lower(c.email) = lower((select auth.jwt() ->> 'email'))
));
create policy "admin_metricas" on public.barbara_metricas_snapshots for all using (public.es_admin()) with check (public.es_admin());
create policy "cliente_ve_sus_hitos" on public.barbara_metricas_hitos for select using (exists (
  select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
  where bc.id = barbara_metricas_hitos.barbara_cliente_id
    and lower(c.email) = lower((select auth.jwt() ->> 'email'))
));
create policy "admin_hitos" on public.barbara_metricas_hitos for all using (public.es_admin()) with check (public.es_admin());
create policy "admin_notificaciones" on public.barbara_notificaciones for all using (public.es_admin()) with check (public.es_admin());

revoke all on public.barbara_metricas_snapshots, public.barbara_metricas_hitos, public.barbara_notificaciones from anon, authenticated;
grant select on public.barbara_metricas_snapshots, public.barbara_metricas_hitos to authenticated;
grant all on public.barbara_metricas_snapshots, public.barbara_metricas_hitos, public.barbara_notificaciones to service_role;

create or replace view public.barbara_metricas_actuales with (security_invoker = true) as
select distinct on (programacion_id)
  id, barbara_cliente_id, barbara_memoria_id, programacion_id, plataforma, external_id,
  capturado_en, me_gusta, comentarios, compartidos, guardados, alcance, impresiones,
  reproducciones, clics, seguidores,
  (me_gusta + comentarios + compartidos + guardados + clics) as interacciones
from public.barbara_metricas_snapshots
order by programacion_id, capturado_en desc;
grant select on public.barbara_metricas_actuales to authenticated, service_role;

create or replace function public.barbara_ingestar_metricas(
  p_programacion_id uuid,
  p_capturado_en timestamptz,
  p_metricas jsonb
) returns setof public.barbara_metricas_hitos
language plpgsql security definer set search_path = public as $$
declare
  p public.barbara_programaciones;
  m jsonb;
begin
  if auth.role() <> 'service_role' then raise exception 'sólo service_role'; end if;
  select * into p from public.barbara_programaciones where id = p_programacion_id and estado = 'publicada';
  if p.id is null or p.barbara_memoria_id is null or coalesce(p.external_id, '') = '' then
    raise exception 'publicación confirmada no encontrada';
  end if;
  if p_capturado_en < now() - interval '30 days' or p_capturado_en > now() + interval '5 minutes' then
    raise exception 'fecha de captura inválida';
  end if;
  m := jsonb_build_object(
    'me_gusta', greatest(0, coalesce((p_metricas->>'me_gusta')::bigint, 0)),
    'comentarios', greatest(0, coalesce((p_metricas->>'comentarios')::bigint, 0)),
    'compartidos', greatest(0, coalesce((p_metricas->>'compartidos')::bigint, 0)),
    'guardados', greatest(0, coalesce((p_metricas->>'guardados')::bigint, 0)),
    'alcance', greatest(0, coalesce((p_metricas->>'alcance')::bigint, 0)),
    'impresiones', greatest(0, coalesce((p_metricas->>'impresiones')::bigint, 0)),
    'reproducciones', greatest(0, coalesce((p_metricas->>'reproducciones')::bigint, 0)),
    'clics', greatest(0, coalesce((p_metricas->>'clics')::bigint, 0)),
    'seguidores', greatest(0, coalesce((p_metricas->>'seguidores')::bigint, 0))
  );
  insert into public.barbara_metricas_snapshots (
    barbara_cliente_id, barbara_memoria_id, programacion_id, plataforma, external_id, capturado_en,
    me_gusta, comentarios, compartidos, guardados, alcance, impresiones, reproducciones, clics, seguidores
  ) values (
    p.barbara_cliente_id, p.barbara_memoria_id, p.id, p.plataforma, p.external_id, p_capturado_en,
    (m->>'me_gusta')::bigint, (m->>'comentarios')::bigint, (m->>'compartidos')::bigint,
    (m->>'guardados')::bigint, (m->>'alcance')::bigint, (m->>'impresiones')::bigint,
    (m->>'reproducciones')::bigint, (m->>'clics')::bigint, (m->>'seguidores')::bigint
  ) on conflict (programacion_id, capturado_en) do nothing;

  update public.barbara_memoria set metricas = m, metricas_actualizadas_en = p_capturado_en
  where id = p.barbara_memoria_id and (metricas_actualizadas_en is null or metricas_actualizadas_en <= p_capturado_en);

  return query
  with candidatos(metrica, umbral, valor) as (
    select 'me_gusta', x, (m->>'me_gusta')::bigint from unnest(array[100,500,1000,5000,10000]::bigint[]) x
    union all select 'alcance', x, (m->>'alcance')::bigint from unnest(array[1000,5000,10000,50000,100000]::bigint[]) x
    union all select 'reproducciones', x, (m->>'reproducciones')::bigint from unnest(array[1000,5000,10000,50000,100000]::bigint[]) x
    union all select 'guardados', x, (m->>'guardados')::bigint from unnest(array[50,100,500,1000]::bigint[]) x
    union all select 'compartidos', x, (m->>'compartidos')::bigint from unnest(array[50,100,500,1000]::bigint[]) x
  ), mejores as (
    select distinct on (metrica) metrica, umbral, valor from candidatos
    where valor >= umbral order by metrica, umbral desc
  ), nuevos as (
    insert into public.barbara_metricas_hitos (barbara_cliente_id, programacion_id, metrica, umbral, valor)
    select p.barbara_cliente_id, p.id, metrica, umbral, valor from mejores
    on conflict do nothing returning *
  ), cola as (
    insert into public.barbara_notificaciones (barbara_cliente_id, programacion_id, tipo, payload)
    select barbara_cliente_id, programacion_id, 'hito_metrica',
      jsonb_build_object('hito_id', id, 'metrica', metrica, 'umbral', umbral, 'valor', valor)
    from nuevos on conflict do nothing
  ) select * from nuevos;
end $$;

revoke all on function public.barbara_ingestar_metricas(uuid,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.barbara_ingestar_metricas(uuid,timestamptz,jsonb) to service_role;

create or replace function public.barbara_recuperar_notificaciones_colgadas() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.role() <> 'service_role' then raise exception 'sólo service_role'; end if;
  update public.barbara_notificaciones set estado='fallida', claim_token=null, claimed_at=null,
    proximo_intento=now(), ultimo_error='claim vencido; recuperado automáticamente'
  where estado='enviando' and claimed_at < now() - interval '15 minutes';
  get diagnostics n = row_count; return n;
end $$;

create or replace function public.barbara_reclamar_notificaciones(p_limite integer default 20)
returns table (id uuid, claim_token uuid, telegram_chat_id text, negocio text, plataforma text,
  angulo text, metrica text, umbral bigint, valor bigint)
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' then raise exception 'sólo service_role'; end if;
  return query
  with candidatas as (
    select n.id from public.barbara_notificaciones n
    where n.estado in ('pendiente','fallida') and n.proximo_intento <= now() and n.intentos < 5
    order by n.creado_en for update skip locked limit greatest(1, least(coalesce(p_limite,20),50))
  ), tomadas as (
    update public.barbara_notificaciones n set estado='enviando', intentos=n.intentos+1,
      claim_token=gen_random_uuid(), claimed_at=now()
    from candidatas c where n.id=c.id
    returning n.*
  ) select t.id, t.claim_token, bc.telegram_chat_id, coalesce(c.negocio,'tu marca'),
      p.plataforma, coalesce(m.angulo,'tu publicación'), t.payload->>'metrica',
      (t.payload->>'umbral')::bigint, (t.payload->>'valor')::bigint
    from tomadas t join public.barbara_clientes bc on bc.id=t.barbara_cliente_id
    join public.clientes c on c.id=bc.cliente_id
    join public.barbara_programaciones p on p.id=t.programacion_id
    left join public.barbara_memoria m on m.id=p.barbara_memoria_id;
end $$;

create or replace function public.barbara_finalizar_notificacion(
  p_notificacion_id uuid, p_claim_token uuid, p_enviada boolean, p_error text default null
) returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.role() <> 'service_role' then raise exception 'sólo service_role'; end if;
  update public.barbara_notificaciones set
    estado=case when p_enviada then 'enviada' when intentos >= 5 then 'fallida' else 'fallida' end,
    enviada_en=case when p_enviada then now() else enviada_en end,
    proximo_intento=case when p_enviada then proximo_intento else now() + make_interval(mins => least(360, power(2,intentos)::integer * 5)) end,
    ultimo_error=case when p_enviada then null else left(coalesce(p_error,'error desconocido'),1000) end,
    claim_token=null, claimed_at=null
  where id=p_notificacion_id and estado='enviando' and claim_token=p_claim_token;
  get diagnostics n = row_count; return n=1;
end $$;

revoke all on function public.barbara_recuperar_notificaciones_colgadas(), public.barbara_reclamar_notificaciones(integer), public.barbara_finalizar_notificacion(uuid,uuid,boolean,text) from public, anon, authenticated;
grant execute on function public.barbara_recuperar_notificaciones_colgadas(), public.barbara_reclamar_notificaciones(integer), public.barbara_finalizar_notificacion(uuid,uuid,boolean,text) to service_role;
