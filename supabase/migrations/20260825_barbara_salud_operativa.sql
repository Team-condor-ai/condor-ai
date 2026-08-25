-- Alertas operativas deduplicadas. El auditor manda un snapshot completo,
-- reactiva lo que sigue roto y resuelve automáticamente lo que desapareció.

create table if not exists public.barbara_alertas_operativas (
  clave text primary key check (clave ~ '^[a-f0-9]{32}$'),
  tipo text not null,
  severidad text not null check (severidad in ('critica','alta','media')),
  resumen text not null,
  detalles jsonb not null default '{}'::jsonb,
  estado text not null default 'activa' check (estado in ('activa','resuelta')),
  apariciones integer not null default 1,
  primera_vista_en timestamptz not null default now(),
  ultima_vista_en timestamptz not null default now(),
  resuelta_en timestamptz,
  notificada_en timestamptz,
  proxima_notificacion timestamptz not null default now(),
  notificando boolean not null default false,
  claim_token uuid,
  claimed_at timestamptz,
  ultimo_error text,
  telegram_message_id bigint
);

alter table public.barbara_alertas_operativas enable row level security;
drop policy if exists "admin_barbara_alertas_operativas" on public.barbara_alertas_operativas;
create policy "admin_barbara_alertas_operativas" on public.barbara_alertas_operativas
  for select using (public.es_admin());
revoke all on public.barbara_alertas_operativas from anon, authenticated;
grant select on public.barbara_alertas_operativas to authenticated;
grant all on public.barbara_alertas_operativas to service_role;

create or replace function public.barbara_sincronizar_alertas_operativas(p_alertas jsonb)
returns table (clave text, claim_token uuid, severidad text, resumen text, detalles jsonb)
language plpgsql security definer set search_path = public as $$
-- ── POR QUÉ ESTA DIRECTIVA (Claude, 25-ago-2026) ────────────────────────
-- `returns table (clave text, claim_token uuid, severidad text, resumen
-- text, detalles jsonb)` declara esos cinco nombres como variables PL/pgSQL
-- (parámetros OUT). Cada vez que aparecen SIN calificar dentro del cuerpo,
-- Postgres no sabe si son la variable o la columna homónima y aborta con:
--
--   42702: column reference "clave" is ambiguous
--
-- Eso hacía fallar la corrida programada de `barbara-auditoria-operativa`
-- cada hora, incluso con el snapshot vacío.
--
-- Calificar los SELECT no alcanza: `on conflict (clave)` es una cláusula de
-- inferencia de índice donde NO se puede usar un alias de tabla — la sintaxis
-- no lo admite. Comprobado en la base real: con los SELECT ya calificados,
-- el error seguía apuntando justo a esa línea.
--
-- `use_column` resuelve toda ambigüedad a favor de la COLUMNA, que es lo
-- correcto acá: los parámetros de entrada llevan prefijo `p_` (no chocan con
-- nada) y los OUT sólo se usan implícitamente en el `return query` final,
-- que ya viene calificado con `a.`.
--
-- No se renombraron los OUT a `o_clave` etc. —la otra salida posible— porque
-- esos nombres son los de las columnas que devuelve la función, y
-- `auditoria-operativa.mjs` lee `a.clave`, `a.claim_token` y `a.severidad`:
-- renombrarlos arreglaba el SQL y rompía al llamador.
#variable_conflict use_column
begin
  if auth.role() <> 'service_role' then raise exception 'sólo service_role'; end if;
  if jsonb_typeof(coalesce(p_alertas,'[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_alertas,'[]'::jsonb)) > 200 then
    raise exception 'snapshot de alertas inválido';
  end if;

  create temporary table if not exists pg_temp.alertas_entrada (
    clave text primary key, tipo text, severidad text, resumen text, detalles jsonb
  ) on commit drop;
  truncate pg_temp.alertas_entrada;
  insert into pg_temp.alertas_entrada
  select left(x.clave,32), left(x.tipo,100), x.severidad, left(x.resumen,300), coalesce(x.detalles,'{}'::jsonb)
  from jsonb_to_recordset(coalesce(p_alertas,'[]'::jsonb))
    as x(clave text,tipo text,severidad text,resumen text,detalles jsonb)
  where x.clave ~ '^[a-f0-9]{32}$' and x.severidad in ('critica','alta','media') and length(trim(x.resumen)) > 0;

  -- Las columnas van CALIFICADAS con el alias `e`, y no es cosmético:
  -- `returns table (clave text, claim_token uuid, severidad text, resumen
  -- text, detalles jsonb)` declara esos cinco nombres como variables
  -- PL/pgSQL (parámetros OUT). Sin el alias, Postgres no sabe si `clave` es
  -- la variable o la columna y aborta con
  --   42702: column reference "clave" is ambiguous
  -- Eso hacía fallar la corrida programada de `barbara-auditoria-operativa`
  -- cada hora (25-ago-2026).
  insert into public.barbara_alertas_operativas (clave,tipo,severidad,resumen,detalles)
  select e.clave,e.tipo,e.severidad,e.resumen,e.detalles from pg_temp.alertas_entrada e
  on conflict (clave) do update set
    tipo=excluded.tipo, severidad=excluded.severidad, resumen=excluded.resumen, detalles=excluded.detalles,
    estado='activa', apariciones=barbara_alertas_operativas.apariciones+1,
    ultima_vista_en=now(), resuelta_en=null;

  update public.barbara_alertas_operativas a set estado='resuelta', resuelta_en=now(),
    notificando=false, claim_token=null, claimed_at=null
  where a.estado='activa' and not exists (select 1 from pg_temp.alertas_entrada e where e.clave=a.clave);

  -- Recupera claims de aviso caídos sin abrir una segunda función/cron.
  update public.barbara_alertas_operativas set notificando=false, claim_token=null, claimed_at=null,
    proxima_notificacion=now(), ultimo_error='claim de aviso vencido'
  where notificando=true and claimed_at < now()-interval '15 minutes';

  return query
  with candidatas as (
    select a.clave from public.barbara_alertas_operativas a
    where a.estado='activa' and a.notificando=false and a.proxima_notificacion<=now()
      and (a.notificada_en is null or a.notificada_en < now() - case when a.severidad='critica' then interval '6 hours' else interval '24 hours' end)
    order by case a.severidad when 'critica' then 0 when 'alta' then 1 else 2 end, a.primera_vista_en
    for update skip locked limit 30
  ), tomadas as (
    update public.barbara_alertas_operativas a set notificando=true,claim_token=gen_random_uuid(),claimed_at=now()
    from candidatas c where a.clave=c.clave
    returning a.clave,a.claim_token,a.severidad,a.resumen,a.detalles
  ) select * from tomadas;
end $$;

create or replace function public.barbara_finalizar_alerta_operativa(
  p_clave text,p_claim_token uuid,p_notificada boolean,p_error text default null,p_telegram_message_id bigint default null
) returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.role() <> 'service_role' then raise exception 'sólo service_role'; end if;
  update public.barbara_alertas_operativas set
    notificando=false,claim_token=null,claimed_at=null,
    notificada_en=case when p_notificada then now() else notificada_en end,
    proxima_notificacion=case when p_notificada then now()+case when severidad='critica' then interval '6 hours' else interval '24 hours' end else now()+interval '15 minutes' end,
    ultimo_error=case when p_notificada then null else left(coalesce(p_error,'error desconocido'),700) end,
    telegram_message_id=case when p_notificada then p_telegram_message_id else telegram_message_id end
  where clave=p_clave and notificando=true and claim_token=p_claim_token;
  get diagnostics n=row_count; return n=1;
end $$;

revoke all on function public.barbara_sincronizar_alertas_operativas(jsonb),
  public.barbara_finalizar_alerta_operativa(text,uuid,boolean,text,bigint) from public,anon,authenticated;
grant execute on function public.barbara_sincronizar_alertas_operativas(jsonb),
  public.barbara_finalizar_alerta_operativa(text,uuid,boolean,text,bigint) to service_role;

