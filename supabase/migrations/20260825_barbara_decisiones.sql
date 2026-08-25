-- Bárbara · trazabilidad estructurada de cada decisión creativa.

create table if not exists public.barbara_decisiones (
  id                   uuid primary key default gen_random_uuid(),
  barbara_cliente_id   uuid not null references public.barbara_clientes(id) on delete cascade,
  barbara_memoria_id   uuid not null references public.barbara_memoria(id) on delete cascade,
  programacion_id      uuid references public.barbara_programaciones(id) on delete set null,
  tipo                 text not null,
  pilar                text,
  angulo               text,
  memoria_privada      jsonb not null default '[]',
  patrones_globales    jsonb not null default '[]',
  diagnostico_memoria  jsonb not null default '{}',
  decision_pilar       jsonb not null default '{}',
  decision_angulo      jsonb not null default '{}',
  decision_horario     jsonb,
  creado_en            timestamptz not null default now(),
  unique (barbara_memoria_id)
);

create index if not exists barbara_decisiones_cliente_idx
  on public.barbara_decisiones (barbara_cliente_id, creado_en desc);
alter table public.barbara_decisiones enable row level security;

drop policy if exists "admin_barbara_decisiones" on public.barbara_decisiones;
create policy "admin_barbara_decisiones" on public.barbara_decisiones
  for all using (public.es_admin()) with check (public.es_admin());
drop policy if exists "cliente_ve_decisiones_barbara" on public.barbara_decisiones;
create policy "cliente_ve_decisiones_barbara" on public.barbara_decisiones
  for select using (exists (
    select 1 from public.barbara_clientes bc join public.clientes c on c.id = bc.cliente_id
    where bc.id = barbara_decisiones.barbara_cliente_id
      and lower(c.email) = lower((select auth.jwt() ->> 'email'))
  ));

comment on table public.barbara_decisiones is
  'Por qué Bárbara eligió memoria, pilar, ángulo y horario; no contiene secretos ni prompts internos.';
