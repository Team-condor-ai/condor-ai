-- Centro de email marketing: audiencia única, campañas y bitácora de envíos.
create table if not exists public.email_contactos (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  nombre text,
  empresa text,
  cliente_id uuid references public.clientes(id) on delete set null,
  estado text not null default 'no_suscrito' check (estado in ('suscrito','no_suscrito','baja','rebotado')),
  etiquetas text[] not null default '{}',
  fuente text not null default 'manual',
  consentimiento_en timestamptz,
  baja_en timestamptz,
  baja_token uuid not null default gen_random_uuid() unique,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create unique index if not exists email_contactos_email_idx on public.email_contactos (email);

create table if not exists public.email_campanas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  asunto text not null,
  preheader text,
  cuerpo text not null,
  estado text not null default 'borrador' check (estado in ('borrador','programada','enviando','enviada','cancelada')),
  programada_para timestamptz,
  destinatarios uuid[] not null default '{}',
  total_destinatarios int not null default 0,
  enviados int not null default 0,
  fallidos int not null default 0,
  ultimo_error text,
  creado_por text,
  creado_en timestamptz not null default now(),
  enviada_en timestamptz
);
create index if not exists email_campanas_pendientes_idx on public.email_campanas (programada_para)
  where estado = 'programada';

create table if not exists public.email_envios (
  id uuid primary key default gen_random_uuid(),
  campana_id uuid not null references public.email_campanas(id) on delete cascade,
  contacto_id uuid references public.email_contactos(id) on delete set null,
  email text not null,
  estado text not null check (estado in ('enviado','error','baja','rebotado')),
  proveedor_id text,
  error text,
  enviado_en timestamptz not null default now()
);
create index if not exists email_envios_campana_idx on public.email_envios (campana_id);

alter table public.email_contactos enable row level security;
alter table public.email_campanas enable row level security;
alter table public.email_envios enable row level security;
do $$ declare t text; begin
  foreach t in array array['email_contactos','email_campanas','email_envios'] loop
    execute format('drop policy if exists "admin_all_%1$s" on public.%1$I', t);
    execute format('create policy "admin_all_%1$s" on public.%1$I for all using (public.es_admin()) with check (public.es_admin())', t);
  end loop;
end $$;
