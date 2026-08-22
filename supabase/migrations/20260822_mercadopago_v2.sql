-- Mercado Pago v2 · conciliación, trazabilidad y retorno seguro al portal.
--
-- `cobros` conserva la intención comercial; `pagos` conserva cada intento y
-- resultado financiero. Los datos de checkout nunca reemplazan al libro de
-- contabilidad: solo entregan trazabilidad para conciliarlo correctamente.

alter table if exists public.cobros
  add column if not exists mp_preference_id text,
  add column if not exists mp_cuenta_id text,
  add column if not exists mp_checkout_creado_en timestamptz,
  add column if not exists mp_ultima_sincronizacion timestamptz;

alter table if exists public.pagos
  add column if not exists mp_status_detail text,
  add column if not exists mp_payment_type text,
  add column if not exists mp_payment_method_id text,
  add column if not exists mp_fee_amount numeric(14,2),
  add column if not exists mp_net_received numeric(14,2),
  add column if not exists mp_refunded_amount numeric(14,2) not null default 0,
  add column if not exists mp_ultima_sincronizacion timestamptz,
  add column if not exists mp_notificado_en timestamptz;

create unique index if not exists pagos_mp_id_idx
  on public.pagos (mp_id)
  where mp_id is not null;

-- Bitácora mínima de webhooks. No guarda tarjetas ni el payload completo:
-- Mercado Pago sigue siendo la fuente para el detalle sensible del pago.
create table if not exists public.mercadopago_eventos (
  id             bigint generated always as identity primary key,
  tipo           text not null,
  recurso_id     text,
  accion         text,
  request_id     text,
  firma_valida   boolean not null default false,
  procesado      boolean not null default false,
  resultado      text,
  recibido_en    timestamptz not null default now(),
  procesado_en   timestamptz
);

create index if not exists mercadopago_eventos_recurso_idx
  on public.mercadopago_eventos (tipo, recurso_id, recibido_en desc);

alter table public.mercadopago_eventos enable row level security;

drop policy if exists "admin_all_mercadopago_eventos" on public.mercadopago_eventos;
create policy "admin_all_mercadopago_eventos" on public.mercadopago_eventos
  for all using (public.es_admin()) with check (public.es_admin());

comment on table public.mercadopago_eventos is
  'Auditoría técnica de notificaciones de Mercado Pago, sin datos de tarjeta.';
