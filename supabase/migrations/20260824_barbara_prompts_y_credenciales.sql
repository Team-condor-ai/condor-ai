-- Bárbara: log de cada prompt de generación (24-ago-2026) + credenciales
-- de API revelables desde el portal (Créditos API > Revelar).

-- ═══════════════════════════════════════════════════════════════════════
-- 1) LOG DE PROMPTS
--
-- Pedido de Joaquín: poder examinar, para cada pieza corregida, el prompt
-- EXACTO que la generó — para encontrar patrones de qué tipo de prompt
-- termina en corrección. Sin esto, `barbara_memoria` dice QUÉ se publicó
-- pero no CÓMO se le pidió al modelo que lo hiciera.
--
-- Una fila por CADA llamada de generación real (la inicial y cada
-- reintento de corrección), no una por pieza — así queda visible qué
-- cambió entre el intento que falló y el que el cliente aceptó.
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists public.barbara_prompts (
  id                 uuid primary key default gen_random_uuid(),
  barbara_cliente_id uuid not null references public.barbara_clientes(id) on delete cascade,
  barbara_memoria_id uuid references public.barbara_memoria(id) on delete set null,
  tipo               text not null,           -- carrusel / historia / ugc
  intento            integer not null default 0,  -- 0 = inicial, 1+ = reintento de corrección
  modelo             text not null default 'claude-sonnet-5',
  prompt_sistema     text not null,
  prompt_usuario     text not null,
  respuesta          jsonb,                    -- el plan_contenido parseado
  correccion_pedida  text,                     -- si intento > 0, qué pidió el cliente
  creado_en          timestamptz not null default now()
);

create index if not exists barbara_prompts_cliente_idx
  on public.barbara_prompts (barbara_cliente_id, creado_en desc);
create index if not exists barbara_prompts_memoria_idx
  on public.barbara_prompts (barbara_memoria_id);

alter table public.barbara_prompts enable row level security;

-- Solo staff: es material interno de diagnóstico, no algo que el cliente
-- necesite ver (a diferencia de `barbara_reglas`, que sí es su marca).
drop policy if exists "admin_all_barbara_prompts" on public.barbara_prompts;
create policy "admin_all_barbara_prompts" on public.barbara_prompts
  for all using ( public.es_admin() ) with check ( public.es_admin() );

-- ═══════════════════════════════════════════════════════════════════════
-- 2) CREDENCIALES DE API REVELABLES
--
-- Las keys de verdad viven en GitHub Actions secrets (write-only: no se
-- pueden leer de vuelta desde ahí). Para que el portal las pueda "revelar
-- para copiar", necesitan una copia de lectura acá — SOLO accesible vía la
-- Edge Function `revelar-credencial` (nunca por un select directo del
-- cliente: no hay policy de SELECT para authenticated, a propósito).
--
-- Mantener las dos copias (GitHub secret que usan los workflows, esta fila
-- que lee el portal) sincronizadas es responsabilidad manual: si se rota
-- una key, hay que actualizar las dos.
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists public.api_credenciales (
  proveedor      text primary key,
  valor          text not null,
  nota           text,
  actualizado_en timestamptz not null default now(),
  actualizado_por text
);

alter table public.api_credenciales enable row level security;

-- NINGUNA policy de select para `authenticated`: se lee solo por
-- service_role, dentro de la Edge Function que ya verificó `es_admin()`.
revoke all on public.api_credenciales from anon, authenticated;
grant all on public.api_credenciales to service_role;

insert into public.api_credenciales (proveedor, valor, nota, actualizado_por)
values ('kie', '2428ea9704c5eb9e58136b586dc7c80f', 'Kie.ai — gpt-image-2 + seedance-2-0, migración desde Higgsfield', 'claude')
on conflict (proveedor) do update set valor = excluded.valor, actualizado_en = now();

-- Fila inicial en api_creditos para que aparezca en la pantalla antes de
-- que corra la primera sincronización (mismo patrón que las otras filas
-- sembradas en 20260826_api_creditos.sql).
insert into public.api_creditos (proveedor, nombre, estado, unidad_saldo, unidad_uso, detalle, fuente, orden)
values ('kie', 'Kie.ai', 'sin_datos', 'créditos', 'créditos',
  'Esperando la primera sincronización. Reemplaza a Higgsfield: gpt-image-2 + seedance-2-0.',
  'Kie.ai API', 15)
on conflict (proveedor) do nothing;
