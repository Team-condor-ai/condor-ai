-- Estado normalizado de los proveedores que consumen créditos o tokens.
-- Solo el service role sincroniza; el equipo autenticado puede leer.

create table if not exists public.api_creditos (
  proveedor text primary key,
  nombre text not null,
  estado text not null default 'sin_datos'
    check (estado in ('ok','advertencia','sin_datos','error','requiere_configuracion')),
  saldo numeric,
  unidad_saldo text,
  uso_periodo numeric,
  unidad_uso text,
  tokens_entrada bigint,
  tokens_salida bigint,
  costo_usd numeric,
  periodo_desde timestamptz,
  detalle text,
  fuente text,
  actualizado_en timestamptz,
  orden integer not null default 100
);

alter table public.api_creditos enable row level security;

drop policy if exists "staff_lee_api_creditos" on public.api_creditos;
create policy "staff_lee_api_creditos" on public.api_creditos
  for select to authenticated
  using (public.es_admin());

revoke all on public.api_creditos from anon, authenticated;
grant select on public.api_creditos to authenticated;
grant all on public.api_creditos to service_role;

insert into public.api_creditos (
  proveedor, nombre, estado, unidad_saldo, unidad_uso, detalle, fuente, orden
) values
  ('anthropic', 'Anthropic', 'requiere_configuracion', null, 'tokens',
   'Agrega ANTHROPIC_ADMIN_KEY. Anthropic no expone el saldo prepago por API.',
   'Usage & Cost Admin API', 10),
  ('higgsfield', 'Higgsfield', 'sin_datos', 'créditos', 'créditos',
   'Esperando la primera sincronización segura.', 'Higgsfield CLI', 20),
  ('blotato', 'Blotato', 'sin_datos', 'créditos', null,
   'Blotato no publica un endpoint de saldo; se verificará la conexión.',
   'Blotato API', 30)
on conflict (proveedor) do nothing;
