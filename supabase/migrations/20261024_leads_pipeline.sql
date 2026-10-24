-- Leads en etapas (24-oct-2026). Inspirado en el tablero del CRM de Neisstech (la columna sale de señales reales,
-- no de un texto) y en los pipelines de GHL (etapas, valor por columna, línea de tiempo del lead).
-- `estado` (activo) se conserva tal cual: lo escriben las funciones del sitio. La etapa es nueva y la maneja el equipo.

alter table public.leads
  add column if not exists etapa text not null default 'nuevo',
  add column if not exists etapa_en timestamptz not null default now(),
  add column if not exists responsable text,
  add column if not exists valor_estimado integer,
  add column if not exists servicio_interes text,
  add column if not exists requiere_humano boolean not null default false,
  add column if not exists motivo_perdida text,
  add column if not exists proxima_accion text,
  add column if not exists proxima_accion_en date,
  add column if not exists actualizado_en timestamptz not null default now();

alter table public.leads drop constraint if exists leads_etapa_chk;
alter table public.leads add constraint leads_etapa_chk
  check (etapa in ('nuevo','contactado','reunion','propuesta','ganado','sin_respuesta','perdido'));
alter table public.leads drop constraint if exists leads_servicio_chk;
alter table public.leads add constraint leads_servicio_chk
  check (servicio_interes is null or servicio_interes in ('sites','ecommerce','crm'));

create table if not exists public.lead_eventos (
  id uuid primary key default gen_random_uuid(),
  lead_id bigint not null references public.leads(id) on delete cascade,
  tipo text not null check (tipo in ('etapa','nota','llamada','whatsapp','correo','reunion','sistema')),
  texto text not null default '',
  de_etapa text,
  a_etapa text,
  autor text,
  creado_en timestamptz not null default now()
);
create index if not exists lead_eventos_lead_idx on public.lead_eventos (lead_id, creado_en desc);
create index if not exists leads_etapa_idx on public.leads (etapa, etapa_en desc);

alter table public.lead_eventos enable row level security;
drop policy if exists admins_ven_lead_eventos on public.lead_eventos;
drop policy if exists admins_editan_lead_eventos on public.lead_eventos;
create policy admins_ven_lead_eventos on public.lead_eventos for select using (public.es_admin());
create policy admins_editan_lead_eventos on public.lead_eventos for all using (public.es_admin()) with check (public.es_admin());

-- Mover de etapa deja rastro y reinicia el reloj de la etapa; las señales reales mueven solas al lead hacia adelante.
create or replace function public.leads_antes_de_guardar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.reunion_id is not null and new.etapa = 'nuevo' then new.etapa := 'reunion'; end if;
    new.etapa_en := now();
  else
    if new.reunion_id is not null and old.reunion_id is null and new.etapa in ('nuevo','contactado') then new.etapa := 'reunion'; end if;
    if new.fue_whatsapp is true and coalesce(old.fue_whatsapp, false) is false and new.etapa = 'nuevo' then new.etapa := 'contactado'; end if;
    if new.pago_estado in ('aprobado','pagado','approved','paid') and coalesce(old.pago_estado,'') is distinct from new.pago_estado
       and new.etapa <> 'ganado' then new.etapa := 'ganado'; end if;
    if new.etapa is distinct from old.etapa then new.etapa_en := now(); end if;
    new.actualizado_en := now();
  end if;
  return new;
end $$;

create or replace function public.leads_despues_de_guardar() returns trigger
language plpgsql security definer set search_path = public as $$
declare quien text := coalesce(auth.jwt() ->> 'email', 'sistema');
begin
  if tg_op = 'INSERT' then
    insert into public.lead_eventos (lead_id, tipo, texto, a_etapa, autor)
    values (new.id, 'sistema', 'Lead recibido' || coalesce(' desde ' || nullif(new.origen,''), ''), new.etapa, 'sistema');
  elsif new.etapa is distinct from old.etapa then
    insert into public.lead_eventos (lead_id, tipo, texto, de_etapa, a_etapa, autor)
    values (new.id, 'etapa', '', old.etapa, new.etapa, quien);
  end if;
  return null;
end $$;

-- Los leads que ya existían entran a su etapa real y con un primer evento.
update public.leads set etapa = case when reunion_id is not null then 'reunion' when fue_whatsapp is true then 'contactado' else 'nuevo' end,
  etapa_en = coalesce(whatsapp_en, creado_en);
insert into public.lead_eventos (lead_id, tipo, texto, a_etapa, autor, creado_en)
select id, 'sistema', 'Lead recibido' || coalesce(' desde ' || nullif(origen,''), ''), etapa, 'sistema', creado_en from public.leads
where not exists (select 1 from public.lead_eventos e where e.lead_id = leads.id);

drop trigger if exists leads_antes on public.leads;
create trigger leads_antes before insert or update on public.leads for each row execute function public.leads_antes_de_guardar();
drop trigger if exists leads_despues on public.leads;
create trigger leads_despues after insert or update on public.leads for each row execute function public.leads_despues_de_guardar();

