-- CRM de prospección — Cóndor Ecommerce (2-sept-2026)
-- Pega en Supabase → SQL Editor → Run (idempotente)
--
-- Por qué una tabla nueva y no reusar `leads`: `leads` es el funnel INBOUND
-- del diagnóstico web (alguien llega solo y deja sus datos). Esto es
-- prospección OUTBOUND manual — Joaquín y Max navegando Instagram, Facebook,
-- Google Maps y LinkedIn y anotando a quién le escribieron. Son procesos
-- opuestos (entra solo vs. se sale a buscar) con datos distintos.
--
-- `linea` existe para poder reusar esta misma tabla cuando Sites/Track/Agents
-- definan su propia prospección — hoy solo la usa Ecommerce.
create table if not exists public.prospectos (
  id uuid primary key default gen_random_uuid(),
  linea text not null default 'ecommerce',
  negocio text not null,
  contacto text,
  canales text[] not null default '{}',
  estado text not null default 'recien_contactado',
  notas text,
  cerrado boolean not null default false,
  -- Se guarda el NOMBRE, no solo el email: `admins` tiene RLS que solo deja
  -- leer la fila propia (ver nombreUsuario.ts), así que el dashboard no
  -- podría mostrar el nombre de otra persona sin este atajo. Se fija una
  -- sola vez, al crear la fila — quien prospectó no cambia si alguien más
  -- edita el estado después.
  creado_por_email text,
  creado_por_nombre text,
  ultima_actividad_en timestamptz not null default now(),
  creado_en timestamptz not null default now()
);

create index if not exists idx_prospectos_linea on public.prospectos(linea);
create index if not exists idx_prospectos_estado on public.prospectos(estado);
create index if not exists idx_prospectos_creado_por on public.prospectos(creado_por_email);

-- El reloj del seguimiento se resetea SOLO cuando cambia el estado, nunca
-- por editar el nombre o una nota — así una alerta de "atrasado" no
-- desaparece porque alguien corrigió un typo sin de verdad hacer seguimiento.
create or replace function public.prospectos_tocar_actividad()
returns trigger language plpgsql as $$
begin
  if new.estado is distinct from old.estado then
    new.ultima_actividad_en = now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prospectos_actividad on public.prospectos;
create trigger trg_prospectos_actividad
  before update on public.prospectos
  for each row execute function public.prospectos_tocar_actividad();

alter table public.prospectos enable row level security;
drop policy if exists "admins_prospectos" on public.prospectos;
create policy "admins_prospectos" on public.prospectos
  for all using ( public.es_admin() ) with check ( public.es_admin() );
