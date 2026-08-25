-- Claim atómico de generación: dos cron/manual/webhook concurrentes no pueden
-- gastar dos veces para la misma pieza lógica.

create table if not exists public.barbara_generaciones (
  id uuid primary key default gen_random_uuid(),
  barbara_cliente_id uuid not null references public.barbara_clientes(id) on delete cascade,
  tipo text not null check (tipo in ('carrusel','historia','ugc')),
  clave text not null check (length(clave) between 3 and 180),
  estado text not null default 'reclamada'
    check (estado in ('reclamada','generando','persistida','fallida','cancelada')),
  claim_token uuid,
  claimed_at timestamptz,
  intentos integer not null default 0,
  proximo_intento timestamptz not null default now(),
  barbara_memoria_id uuid references public.barbara_memoria(id) on delete set null,
  actor text,
  detalles jsonb not null default '{}'::jsonb,
  ultimo_error text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (barbara_cliente_id, tipo, clave)
);

create index if not exists barbara_generaciones_estado_idx
  on public.barbara_generaciones (estado, proximo_intento, claimed_at);
alter table public.barbara_generaciones enable row level security;
drop policy if exists "admin_barbara_generaciones" on public.barbara_generaciones;
create policy "admin_barbara_generaciones" on public.barbara_generaciones
  for all using (public.es_admin()) with check (public.es_admin());
drop policy if exists "cliente_ve_sus_generaciones" on public.barbara_generaciones;
create policy "cliente_ve_sus_generaciones" on public.barbara_generaciones for select using (exists (
  select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
  where bc.id = barbara_generaciones.barbara_cliente_id
    and lower(c.email) = lower((select auth.jwt() ->> 'email'))
));
revoke all on public.barbara_generaciones from anon, authenticated;
grant select on public.barbara_generaciones to authenticated;
grant all on public.barbara_generaciones to service_role;

create or replace function public.barbara_reclamar_generacion(
  p_barbara_cliente_id uuid, p_tipo text, p_clave text, p_actor text default 'barbara'
) returns table (id uuid, claim_token uuid, intento integer)
language plpgsql security definer set search_path = public as $$
declare fila public.barbara_generaciones;
begin
  if auth.role() <> 'service_role' then raise exception 'sólo service_role'; end if;
  if p_tipo not in ('carrusel','historia','ugc') or length(trim(coalesce(p_clave,''))) not between 3 and 180 then
    raise exception 'claim de generación inválido';
  end if;
  if not exists (select 1 from public.barbara_clientes where id=p_barbara_cliente_id and activo=true) then
    raise exception 'cliente Bárbara inactivo o inexistente';
  end if;

  insert into public.barbara_generaciones (barbara_cliente_id,tipo,clave,actor)
  values (p_barbara_cliente_id,p_tipo,trim(p_clave),left(coalesce(p_actor,'barbara'),120))
  on conflict (barbara_cliente_id,tipo,clave) do nothing;

  select * into fila from public.barbara_generaciones
  where barbara_cliente_id=p_barbara_cliente_id and tipo=p_tipo and clave=trim(p_clave)
  for update;
  if fila.estado in ('persistida','cancelada') then return; end if;
  if fila.estado in ('reclamada','generando') and fila.claimed_at is not null
     and fila.claimed_at >= now() - interval '90 minutes' then return; end if;
  if fila.estado='fallida' and fila.proximo_intento > now() then return; end if;

  update public.barbara_generaciones g set
    estado='generando', claim_token=gen_random_uuid(), claimed_at=now(),
    intentos=g.intentos+1, actor=left(coalesce(p_actor,'barbara'),120),
    actualizado_en=now(), ultimo_error=null
  where g.id=fila.id returning g.id,g.claim_token,g.intentos into id,claim_token,intento;
  return next;
end $$;

create or replace function public.barbara_confirmar_generacion(
  p_generacion_id uuid, p_claim_token uuid, p_memoria_id uuid, p_detalles jsonb default '{}'::jsonb
) returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.role() <> 'service_role' then raise exception 'sólo service_role'; end if;
  update public.barbara_generaciones g set
    estado='persistida', barbara_memoria_id=p_memoria_id,
    detalles=coalesce(p_detalles,'{}'::jsonb), actualizado_en=now(),
    claim_token=null, claimed_at=null, ultimo_error=null
  where g.id=p_generacion_id and g.estado='generando' and g.claim_token=p_claim_token
    and exists (select 1 from public.barbara_memoria bm
      where bm.id=p_memoria_id and bm.barbara_cliente_id=g.barbara_cliente_id
      and exists (select 1 from public.barbara_media x where x.barbara_memoria_id=bm.id));
  get diagnostics n = row_count; return n=1;
end $$;

create or replace function public.barbara_fallar_generacion(
  p_generacion_id uuid, p_claim_token uuid, p_error text
) returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.role() <> 'service_role' then raise exception 'sólo service_role'; end if;
  update public.barbara_generaciones set
    estado='fallida', proximo_intento=now()+make_interval(mins=>least(360,power(2,intentos)::integer*3)),
    ultimo_error=left(coalesce(p_error,'error desconocido'),1000), actualizado_en=now(),
    claim_token=null, claimed_at=null
  where id=p_generacion_id and estado='generando' and claim_token=p_claim_token;
  get diagnostics n = row_count; return n=1;
end $$;

revoke all on function public.barbara_reclamar_generacion(uuid,text,text,text),
  public.barbara_confirmar_generacion(uuid,uuid,uuid,jsonb), public.barbara_fallar_generacion(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.barbara_reclamar_generacion(uuid,text,text,text),
  public.barbara_confirmar_generacion(uuid,uuid,uuid,jsonb), public.barbara_fallar_generacion(uuid,uuid,text)
  to service_role;

