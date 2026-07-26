-- condor.ai · Campaña Colombia — schema de leads/reuniones + cola de seguimiento (2026-07-26)
-- Aplicar en Supabase → SQL Editor → Run. Idempotente: se puede correr varias veces.
--
-- Qué hace:
--   1) Campos de campaña en 'leads' (país, UTMs, intención, atribución de Meta, pago).
--   2) Campos de contacto en 'reuniones' (email/whatsapp/lead_id/asistió) para poder recordar.
--   3) Tabla 'mensajes_programados': la cola que despacha services/seguimiento.
--   4) Triggers que ENCOLAN solos: al entrar un lead y al agendarse una reunión.
--      Samuel solo hace el INSERT; el seguimiento sale automático desde la base.

-- ─────────────────────────────────────────────────────────────
-- 1) LEADS · campos de la campaña
-- ─────────────────────────────────────────────────────────────
alter table public.leads add column if not exists nombre       text;                    -- el form de la landing pide Nombre (aparte de 'negocio')
alter table public.leads add column if not exists pais         text default 'CO';
alter table public.leads add column if not exists campana      text;                    -- ej. 'colombia-ads'
alter table public.leads add column if not exists intencion    text;                    -- 'reunion' (agendó) | 'contacto' (pidió que lo llamen)
alter table public.leads add column if not exists reunion_id   uuid references public.reuniones(id) on delete set null;
alter table public.leads add column if not exists seguimiento  boolean default true;    -- false = pidió no recibir más (opt-out)

-- Atribución: UTMs de Meta Ads + cookies del Pixel (necesarias para CAPI)
alter table public.leads add column if not exists utm_source   text;
alter table public.leads add column if not exists utm_medium   text;
alter table public.leads add column if not exists utm_campaign text;
alter table public.leads add column if not exists utm_content  text;
alter table public.leads add column if not exists utm_term     text;
alter table public.leads add column if not exists fbclid       text;
alter table public.leads add column if not exists fbp          text;                    -- cookie _fbp
alter table public.leads add column if not exists fbc          text;                    -- cookie _fbc

-- Pago (MercadoPago) asociado al lead: el cierre de la campaña se cobra sin crear cliente aún
alter table public.leads add column if not exists pago_estado  text default 'ninguno';  -- ninguno / pendiente / pagado
alter table public.leads add column if not exists pago_mp_id   text;
alter table public.leads add column if not exists pago_monto   numeric;
alter table public.leads add column if not exists pago_moneda  text;
alter table public.leads add column if not exists pago_en      timestamptz;

create index if not exists idx_leads_campana   on public.leads (campana, creado_en desc);
create index if not exists idx_leads_intencion on public.leads (intencion);

-- ─────────────────────────────────────────────────────────────
-- 2) REUNIONES · datos de contacto para poder recordar
--    ('contacto' de texto ya existe; estas columnas lo dejan consultable)
-- ─────────────────────────────────────────────────────────────
alter table public.reuniones add column if not exists cliente   text;                   -- por si aún no se aplicó reuniones_fix.sql
alter table public.reuniones add column if not exists lead_id   bigint references public.leads(id) on delete set null;
alter table public.reuniones add column if not exists email     text;
alter table public.reuniones add column if not exists whatsapp  text;                   -- E.164 sin '+' (ej. 573001234567)
alter table public.reuniones add column if not exists zona      text;                   -- IANA; si viene null el worker la deduce del prefijo (57 → Bogotá, si no Santiago)
alter table public.reuniones add column if not exists asistio   boolean;                -- null = aún no se sabe; false = no-show
alter table public.reuniones add column if not exists cerrada_en timestamptz;

create index if not exists idx_reuniones_fecha on public.reuniones (fecha_hora);

-- ─────────────────────────────────────────────────────────────
-- 3) COLA DE MENSAJES
--    Una fila = un envío concreto (canal + plantilla + destino + cuándo).
--    El worker la lee cada 15 min y despacha lo vencido.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.mensajes_programados (
  id               bigint generated always as identity primary key,
  lead_id          bigint references public.leads(id) on delete cascade,
  reunion_id       uuid   references public.reuniones(id) on delete cascade,
  canal            text not null check (canal in ('email', 'whatsapp')),
  plantilla        text not null,                    -- bienvenida / confirmacion / recordatorio_24h / recordatorio_1h / noshow_1 / noshow_2
  destino          text not null,                    -- correo, o número E.164 sin '+'
  datos            jsonb default '{}'::jsonb,        -- nombre, título, etc. para armar el mensaje
  programado_para  timestamptz not null,
  estado           text not null default 'pendiente' check (estado in ('pendiente', 'enviado', 'error', 'cancelado')),
  intentos         int default 0,
  ultimo_error     text,
  enviado_en       timestamptz,
  creado_en        timestamptz default now()
);

-- El worker busca por esto: lo pendiente y vencido, lo más viejo primero
create index if not exists idx_msgp_pendientes on public.mensajes_programados (estado, programado_para);

-- Anti-duplicados: una misma plantilla no se encola dos veces para la misma reunión/lead.
-- (Dos índices parciales en vez de uno solo porque el mensaje puede colgar de una reunión o de un lead suelto.)
create unique index if not exists uq_msgp_reunion on public.mensajes_programados (reunion_id, canal, plantilla)
  where reunion_id is not null;
create unique index if not exists uq_msgp_lead    on public.mensajes_programados (lead_id, canal, plantilla)
  where reunion_id is null and lead_id is not null;

alter table public.mensajes_programados enable row level security;
-- Solo el service role escribe (worker + edge functions). Los admins pueden mirar el log en el portal.
drop policy if exists "admins_ven_mensajes" on public.mensajes_programados;
create policy "admins_ven_mensajes" on public.mensajes_programados for select using ( public.es_admin() );

-- ─────────────────────────────────────────────────────────────
-- 4) ENCOLADO AUTOMÁTICO
-- ─────────────────────────────────────────────────────────────

-- Encola un envío. No pisa nada si ya existía (índices únicos de arriba) y
-- descarta lo que ya venció (ej. recordatorio de 24 h cuando agendaron para mañana temprano).
create or replace function public.encolar_mensaje(
  p_lead_id     bigint,
  p_reunion_id  uuid,
  p_canal       text,
  p_plantilla   text,
  p_destino     text,
  p_cuando      timestamptz,
  p_datos       jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_destino is null or length(trim(p_destino)) = 0 then return; end if;
  -- Margen de 2 min: si el momento ya pasó, no tiene sentido mandarlo tarde.
  if p_cuando < now() - interval '2 minutes' then return; end if;

  insert into public.mensajes_programados (lead_id, reunion_id, canal, plantilla, destino, datos, programado_para)
  values (p_lead_id, p_reunion_id, p_canal, p_plantilla, trim(p_destino), coalesce(p_datos, '{}'::jsonb),
          greatest(p_cuando, now()))
  on conflict do nothing;
end $$;

-- ── Lead nuevo que pidió "que me contacten" → bienvenida inmediata por los dos canales ──
create or replace function public.trg_lead_seguimiento()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_datos jsonb;
begin
  if coalesce(new.seguimiento, true) = false then return new; end if;
  if new.intencion is distinct from 'contacto' then return new; end if;   -- los que agendan reciben el flujo de la reunión

  v_datos := jsonb_build_object('nombre', coalesce(new.nombre, new.negocio, ''), 'negocio', coalesce(new.negocio, ''));
  perform public.encolar_mensaje(new.id, null, 'email',    'bienvenida', new.email,    now(), v_datos);
  perform public.encolar_mensaje(new.id, null, 'whatsapp', 'bienvenida', new.whatsapp, now(), v_datos);
  return new;
end $$;

drop trigger if exists lead_seguimiento on public.leads;
create trigger lead_seguimiento after insert on public.leads
  for each row execute function public.trg_lead_seguimiento();

-- ── Reunión agendada → confirmación ahora + recordatorio 24 h antes + 1 h antes ──
create or replace function public.trg_reunion_seguimiento()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_email    text;
  v_whatsapp text;
  v_nombre   text;
  v_datos    jsonb;
begin
  -- Solo las reuniones CON cliente externo (agendadas desde la web o por el bot).
  -- Las internas del equipo ya las cubre 'reunion-notificar'.
  if new.origen is not null and new.origen not in ('web', 'campana', 'bot') then return new; end if;
  if new.contacto is null and new.email is null and new.whatsapp is null then return new; end if;

  -- Fallback: 'contacto' viene como "Nombre · whatsapp · email" (lo arma agendar-publico)
  v_email    := coalesce(new.email,    nullif(trim(split_part(new.contacto, '·', 3)), ''));
  v_whatsapp := coalesce(new.whatsapp, regexp_replace(coalesce(split_part(new.contacto, '·', 2), ''), '\D', '', 'g'));
  v_nombre   := coalesce(new.cliente,  nullif(trim(split_part(new.contacto, '·', 1)), ''), 'Hola');
  if length(coalesce(v_whatsapp, '')) < 8 then v_whatsapp := null; end if;

  v_datos := jsonb_build_object(
    'nombre', v_nombre,
    'titulo', coalesce(new.titulo, 'Reunión con condor.ai'),
    'fecha_hora', new.fecha_hora,
    'duracion_min', coalesce(new.duracion_min, 30),
    'zona', new.zona
  );

  perform public.encolar_mensaje(new.lead_id, new.id, 'email',    'confirmacion',     v_email,    now(), v_datos);
  perform public.encolar_mensaje(new.lead_id, new.id, 'whatsapp', 'confirmacion',     v_whatsapp, now(), v_datos);
  perform public.encolar_mensaje(new.lead_id, new.id, 'email',    'recordatorio_24h', v_email,    new.fecha_hora - interval '24 hours', v_datos);
  perform public.encolar_mensaje(new.lead_id, new.id, 'whatsapp', 'recordatorio_24h', v_whatsapp, new.fecha_hora - interval '24 hours', v_datos);
  perform public.encolar_mensaje(new.lead_id, new.id, 'email',    'recordatorio_1h',  v_email,    new.fecha_hora - interval '1 hour',   v_datos);
  perform public.encolar_mensaje(new.lead_id, new.id, 'whatsapp', 'recordatorio_1h',  v_whatsapp, new.fecha_hora - interval '1 hour',   v_datos);
  return new;
end $$;

drop trigger if exists reunion_seguimiento on public.reuniones;
create trigger reunion_seguimiento after insert on public.reuniones
  for each row execute function public.trg_reunion_seguimiento();

-- ── Si mueven la reunión, se mueven los recordatorios que aún no salieron ──
create or replace function public.trg_reunion_reprogramar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.fecha_hora = old.fecha_hora then return new; end if;

  update public.mensajes_programados
     set programado_para = new.fecha_hora - interval '24 hours'
   where reunion_id = new.id and plantilla = 'recordatorio_24h' and estado = 'pendiente';
  update public.mensajes_programados
     set programado_para = new.fecha_hora - interval '1 hour'
   where reunion_id = new.id and plantilla = 'recordatorio_1h'  and estado = 'pendiente';

  -- Lo que quedó en el pasado ya no se manda
  update public.mensajes_programados
     set estado = 'cancelado', ultimo_error = 'reunión reprogramada'
   where reunion_id = new.id and estado = 'pendiente' and programado_para < now() - interval '2 minutes';
  return new;
end $$;

drop trigger if exists reunion_reprogramar on public.reuniones;
create trigger reunion_reprogramar after update of fecha_hora on public.reuniones
  for each row execute function public.trg_reunion_reprogramar();

-- ── Opt-out: si el lead pide no recibir más, se cancela todo lo pendiente ──
create or replace function public.trg_lead_optout()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.seguimiento = false and old.seguimiento is distinct from false then
    update public.mensajes_programados
       set estado = 'cancelado', ultimo_error = 'lead pidió baja'
     where lead_id = new.id and estado = 'pendiente';
  end if;
  return new;
end $$;

drop trigger if exists lead_optout on public.leads;
create trigger lead_optout after update of seguimiento on public.leads
  for each row execute function public.trg_lead_optout();
