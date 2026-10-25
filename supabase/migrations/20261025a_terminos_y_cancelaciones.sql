-- Términos y condiciones aceptados en el portal + cancelaciones (25-oct-2026).
-- El texto vive en apps/web-v2/src/legal/contenido.mjs; acá queda la prueba de cada aceptación
-- (versión, servicio, país, huella SHA-256 del texto, IP y navegador) y cada cancelación pedida.

-- ── Aceptaciones ──────────────────────────────────────────────────────────
create table if not exists public.terminos_aceptaciones (
  id bigint generated always as identity primary key,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  email text not null,
  version text not null,
  servicio text not null check (servicio in ('sites', 'ecommerce', 'crm')),
  pais text not null check (pais in ('cl', 'pe', 'co', 'mx', 'ar')),
  huella text not null check (huella ~ '^[0-9a-f]{64}$'),
  ip text,
  navegador text,
  aceptado_en timestamptz not null default now()
);
create index if not exists terminos_aceptaciones_cliente on public.terminos_aceptaciones (cliente_id, aceptado_en desc);
alter table public.terminos_aceptaciones enable row level security;

drop policy if exists terminos_equipo_ve on public.terminos_aceptaciones;
create policy terminos_equipo_ve on public.terminos_aceptaciones for select to authenticated using ((select public.es_admin()));
drop policy if exists terminos_cliente_ve on public.terminos_aceptaciones;
create policy terminos_cliente_ve on public.terminos_aceptaciones for select to authenticated using (public.es_cliente(cliente_id));
-- Nadie escribe directo: solo por aceptar_terminos(), que toma la IP de la petición. Es un registro, no se edita.
revoke insert, update, delete on public.terminos_aceptaciones from anon, authenticated;

-- Servicio y país se calculan igual que en el portal (contenido.mjs: servicioDeLinea / paisDeMoneda).
create or replace function public.aceptar_terminos(p_version text, p_servicio text, p_pais text, p_huella text)
returns timestamptz
language plpgsql security definer set search_path = public
as $$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  v_cliente public.clientes;
  v_servicio text;
  v_pais text;
  v_headers json := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  v_en timestamptz;
begin
  select * into v_cliente from public.clientes where lower(email) = v_email and archivado is not true limit 1;
  if v_cliente.id is null then raise exception 'No encontramos tu ficha de cliente.'; end if;
  v_servicio := case when v_cliente.linea in ('ecommerce', 'crm') then v_cliente.linea else 'sites' end;
  v_pais := case upper(coalesce(v_cliente.moneda, '')) when 'PEN' then 'pe' when 'COP' then 'co' when 'MXN' then 'mx' when 'ARS' then 'ar' else 'cl' end;
  if p_servicio is distinct from v_servicio or p_pais is distinct from v_pais then
    raise exception 'Los términos que viste no son los de tu servicio. Recarga la página.';
  end if;
  insert into public.terminos_aceptaciones (cliente_id, email, version, servicio, pais, huella, ip, navegador)
  values (
    v_cliente.id, v_email, left(p_version, 20), v_servicio, v_pais, lower(p_huella),
    nullif(trim(split_part(coalesce(v_headers ->> 'cf-connecting-ip', v_headers ->> 'x-forwarded-for', v_headers ->> 'x-real-ip', ''), ',', 1)), ''),
    left(v_headers ->> 'user-agent', 300)
  )
  returning aceptado_en into v_en;
  return v_en;
end;
$$;
revoke all on function public.aceptar_terminos(text, text, text, text) from public, anon;
grant execute on function public.aceptar_terminos(text, text, text, text) to authenticated;

-- ── Cancelaciones ─────────────────────────────────────────────────────────
-- Cualquiera de los cuatro medios basta (cláusula 7.1). El botón del portal la registra solo; las que llegan por
-- chat, correo o WhatsApp las anota el equipo desde la ficha. El servicio sigue hasta `termina_el` y la carpeta
-- + credenciales se entregan dentro de 10 días hábiles desde ahí (cláusula 8).
create table if not exists public.cancelaciones (
  id bigint generated always as identity primary key,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  canal text not null check (canal in ('portal', 'chat', 'correo', 'whatsapp')),
  motivo text check (char_length(motivo) <= 1000),
  solicitada_en timestamptz not null default now(),
  termina_el date not null,
  registrada_por text not null,
  confirmada_en timestamptz,
  entregado_en timestamptz,
  anulada_en timestamptz
);
create index if not exists cancelaciones_cliente on public.cancelaciones (cliente_id, solicitada_en desc);
create unique index if not exists cancelaciones_una_abierta on public.cancelaciones (cliente_id) where anulada_en is null and entregado_en is null;
alter table public.cancelaciones enable row level security;

drop policy if exists cancelaciones_equipo on public.cancelaciones;
create policy cancelaciones_equipo on public.cancelaciones for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));
drop policy if exists cancelaciones_cliente_ve on public.cancelaciones;
create policy cancelaciones_cliente_ve on public.cancelaciones for select to authenticated using (public.es_cliente(cliente_id));

create or replace function public.solicitar_cancelacion(p_motivo text)
returns public.cancelaciones
language plpgsql security definer set search_path = public
as $$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  v_cliente public.clientes;
  v_fila public.cancelaciones;
  v_motivo text := nullif(trim(left(p_motivo, 1000)), '');
begin
  select * into v_cliente from public.clientes where lower(email) = v_email and archivado is not true limit 1;
  if v_cliente.id is null then raise exception 'No encontramos tu ficha de cliente.'; end if;
  select * into v_fila from public.cancelaciones where cliente_id = v_cliente.id and anulada_en is null and entregado_en is null;
  if v_fila.id is not null then return v_fila; end if;

  insert into public.cancelaciones (cliente_id, canal, motivo, termina_el, registrada_por, confirmada_en)
  values (v_cliente.id, 'portal', v_motivo, greatest(coalesce(v_cliente.proximo_cobro, current_date), current_date), v_email, now())
  returning * into v_fila;

  -- Queda también como pedido en el chat, para que el equipo lo vea en su bandeja.
  insert into public.chat_mensajes (cliente_id, de_equipo, autor, texto, pedido_estado)
  values (v_cliente.id, false, v_email,
    'Cancelé mi servicio desde el portal. Sigue activo hasta el ' || to_char(v_fila.termina_el, 'DD-MM-YYYY') || '.'
      || coalesce(E'\nMotivo: ' || v_motivo, ''),
    'nueva');
  return v_fila;
end;
$$;
revoke all on function public.solicitar_cancelacion(text) from public, anon;
grant execute on function public.solicitar_cancelacion(text) to authenticated;

-- ── El cliente ya no se da de baja tocando `archivado` ──────────────────────
-- Antes la baja del portal archivaba al instante (y con eso el cliente perdía el portal y el chat el mismo día).
-- Ahora cancelar no corta nada hasta el fin del período: archivar queda solo para el equipo.
create or replace function public.clientes_cliente_solo_sus_campos()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- El equipo puede tocar todo.
  if public.es_admin() then
    return new;
  end if;

  -- Un cliente solo puede cambiar su teléfono. Todo lo demás se restaura al valor que ya tenía. Se revierte en vez
  -- de lanzar error a propósito: así el guardado del portal sigue funcionando aunque el front mande la fila completa.
  new.email          := old.email;
  new.nombre         := old.nombre;
  new.negocio        := old.negocio;
  new.plan           := old.plan;
  new.concepto       := old.concepto;
  new.setup_monto    := old.setup_monto;
  new.mensual_monto  := old.mensual_monto;
  new.moneda         := old.moneda;
  new.setup_estado   := old.setup_estado;
  new.mensual_estado := old.mensual_estado;
  new.proximo_cobro  := old.proximo_cobro;
  new.link_setup     := old.link_setup;
  new.link_mensual   := old.link_mensual;
  new.link_paypal    := old.link_paypal;
  new.web_url        := old.web_url;
  new.cobra_setup    := old.cobra_setup;
  new.cobra_mensual  := old.cobra_mensual;
  new.linea          := old.linea;
  new.irresponsable  := old.irresponsable;
  new.dias_sin_pagar := old.dias_sin_pagar;
  new.archivado      := old.archivado;
  return new;
end;
$$;
