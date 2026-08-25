-- Presupuesto por unidades reales. No congela precios de proveedores en SQL:
-- tokens, imágenes y segundos siguen siendo auditables aunque cambie la tarifa.

create table if not exists public.barbara_presupuestos (
  barbara_cliente_id uuid primary key references public.barbara_clientes(id) on delete cascade,
  modo text not null default 'observar' check (modo in ('observar','bloquear')),
  max_generaciones_dia integer check (max_generaciones_dia is null or max_generaciones_dia > 0),
  max_tokens_mes bigint check (max_tokens_mes is null or max_tokens_mes > 0),
  max_imagenes_mes integer check (max_imagenes_mes is null or max_imagenes_mes > 0),
  max_video_segundos_mes integer check (max_video_segundos_mes is null or max_video_segundos_mes > 0),
  actualizado_por text,
  actualizado_en timestamptz not null default now()
);

create table if not exists public.barbara_consumos (
  id uuid primary key default gen_random_uuid(),
  generacion_id uuid not null references public.barbara_generaciones(id) on delete cascade,
  barbara_cliente_id uuid not null references public.barbara_clientes(id) on delete cascade,
  intento integer not null check (intento > 0),
  estado text not null check (estado in ('completa','fallida')),
  inicio timestamptz not null,
  fin timestamptz not null,
  tokens_entrada bigint not null default 0 check (tokens_entrada >= 0),
  tokens_salida bigint not null default 0 check (tokens_salida >= 0),
  tokens_cache_lectura bigint not null default 0 check (tokens_cache_lectura >= 0),
  tokens_cache_escritura bigint not null default 0 check (tokens_cache_escritura >= 0),
  imagenes integer not null default 0 check (imagenes >= 0),
  video_segundos numeric not null default 0 check (video_segundos >= 0),
  llamadas jsonb not null default '[]'::jsonb,
  error text,
  creado_en timestamptz not null default now(),
  unique (generacion_id,intento)
);

create index if not exists barbara_consumos_cliente_fecha_idx
  on public.barbara_consumos (barbara_cliente_id,fin desc);
alter table public.barbara_presupuestos enable row level security;
alter table public.barbara_consumos enable row level security;
drop policy if exists "admin_barbara_presupuestos" on public.barbara_presupuestos;
create policy "admin_barbara_presupuestos" on public.barbara_presupuestos for all using (public.es_admin()) with check (public.es_admin());
drop policy if exists "admin_barbara_consumos" on public.barbara_consumos;
create policy "admin_barbara_consumos" on public.barbara_consumos for select using (public.es_admin());
drop policy if exists "cliente_ve_su_presupuesto" on public.barbara_presupuestos;
create policy "cliente_ve_su_presupuesto" on public.barbara_presupuestos for select using (exists (
  select 1 from public.barbara_clientes bc join public.clientes c on c.id=bc.cliente_id
  where bc.id=barbara_presupuestos.barbara_cliente_id and lower(c.email)=lower((select auth.jwt()->>'email'))
));
drop policy if exists "cliente_ve_su_consumo" on public.barbara_consumos;
create policy "cliente_ve_su_consumo" on public.barbara_consumos for select using (exists (
  select 1 from public.barbara_clientes bc join public.clientes c on c.id=bc.cliente_id
  where bc.id=barbara_consumos.barbara_cliente_id and lower(c.email)=lower((select auth.jwt()->>'email'))
));
revoke all on public.barbara_presupuestos,public.barbara_consumos from anon,authenticated;
grant select on public.barbara_presupuestos,public.barbara_consumos to authenticated;
grant all on public.barbara_presupuestos,public.barbara_consumos to service_role;

create or replace function public.barbara_registrar_consumo(
  p_generacion_id uuid,p_intento integer,p_estado text,p_inicio timestamptz,p_fin timestamptz,
  p_tokens_entrada bigint,p_tokens_salida bigint,p_tokens_cache_lectura bigint,p_tokens_cache_escritura bigint,
  p_imagenes integer,p_video_segundos numeric,p_llamadas jsonb,p_error text default null
) returns boolean language plpgsql security definer set search_path=public as $$
declare cliente uuid;
begin
  if auth.role()<>'service_role' then raise exception 'sólo service_role'; end if;
  select barbara_cliente_id into cliente from public.barbara_generaciones where id=p_generacion_id;
  if cliente is null then raise exception 'generación inexistente'; end if;
  if p_estado not in ('completa','fallida') or p_intento<1 or p_fin<p_inicio
    or jsonb_typeof(coalesce(p_llamadas,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_llamadas,'[]'::jsonb))>100 then
    raise exception 'consumo inválido';
  end if;
  insert into public.barbara_consumos (
    generacion_id,barbara_cliente_id,intento,estado,inicio,fin,tokens_entrada,tokens_salida,
    tokens_cache_lectura,tokens_cache_escritura,imagenes,video_segundos,llamadas,error
  ) values (
    p_generacion_id,cliente,p_intento,p_estado,p_inicio,p_fin,greatest(0,p_tokens_entrada),greatest(0,p_tokens_salida),
    greatest(0,p_tokens_cache_lectura),greatest(0,p_tokens_cache_escritura),greatest(0,p_imagenes),
    greatest(0,p_video_segundos),coalesce(p_llamadas,'[]'::jsonb),left(p_error,500)
  ) on conflict (generacion_id,intento) do nothing;
  return true;
end $$;

create or replace function public.barbara_verificar_presupuesto(p_barbara_cliente_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.barbara_presupuestos; tokens bigint; imagenes bigint; video numeric; generaciones bigint; permitido boolean;
begin
  if auth.role()<>'service_role' then raise exception 'sólo service_role'; end if;
  select * into p from public.barbara_presupuestos where barbara_cliente_id=p_barbara_cliente_id;
  if not found then return jsonb_build_object('configurado',false,'permitido',true,'modo','observar'); end if;
  select coalesce(sum(tokens_entrada+tokens_salida),0),coalesce(sum(imagenes),0),coalesce(sum(video_segundos),0)
    into tokens,imagenes,video from public.barbara_consumos
    where barbara_cliente_id=p_barbara_cliente_id and fin>=date_trunc('month',now());
  select count(*) into generaciones from public.barbara_consumos
    where barbara_cliente_id=p_barbara_cliente_id and fin>=date_trunc('day',now());
  permitido := (p.max_tokens_mes is null or tokens<p.max_tokens_mes)
    and (p.max_imagenes_mes is null or imagenes<p.max_imagenes_mes)
    and (p.max_video_segundos_mes is null or video<p.max_video_segundos_mes)
    and (p.max_generaciones_dia is null or generaciones<p.max_generaciones_dia);
  return jsonb_build_object(
    'configurado',true,'permitido',permitido or p.modo='observar','excedido',not permitido,'modo',p.modo,
    'uso',jsonb_build_object('tokens_mes',tokens,'imagenes_mes',imagenes,'video_segundos_mes',video,'generaciones_dia',generaciones),
    'limites',jsonb_build_object('tokens_mes',p.max_tokens_mes,'imagenes_mes',p.max_imagenes_mes,
      'video_segundos_mes',p.max_video_segundos_mes,'generaciones_dia',p.max_generaciones_dia)
  );
end $$;

revoke all on function public.barbara_registrar_consumo(uuid,integer,text,timestamptz,timestamptz,bigint,bigint,bigint,bigint,integer,numeric,jsonb,text),
  public.barbara_verificar_presupuesto(uuid) from public,anon,authenticated;
grant execute on function public.barbara_registrar_consumo(uuid,integer,text,timestamptz,timestamptz,bigint,bigint,bigint,bigint,integer,numeric,jsonb,text),
  public.barbara_verificar_presupuesto(uuid) to service_role;

