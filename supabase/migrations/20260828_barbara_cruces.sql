-- Bárbara · dónde aterrizan los hallazgos del cruce de datos.
--
-- El cruce (services/barbara/cruzar-datos.mjs) compara lo que el cliente
-- DECLARÓ que prefiere contra lo que sus piezas publicadas realmente
-- rindieron. Corre una vez por semana y deja acá su resultado.
--
-- POR QUÉ SOLO EN BASE, SIN VISTA NI AVISO (decisión de Joaquín, 28-ago-2026)
-- ---------------------------------------------------------------------------
-- Un hallazgo del tipo "la regla que pediste está rindiendo peor" es delicado
-- de mostrar: al cliente puede sonar a reproche y al equipo le sirve recién
-- cuando hay varias semanas para ver tendencia. Se acumula historial primero y
-- se decide la presentación después, con datos a la vista.
--
-- Cada corrida INSERTA filas nuevas en vez de actualizar las anteriores: el
-- valor está justamente en poder mirar cómo cambia un veredicto en el tiempo.
-- Una regla que pasa de `contradicha` a `confirmada` es información; si se
-- sobrescribiera, esa historia no existiría.

create table if not exists public.barbara_cruces (
  id                    uuid primary key default gen_random_uuid(),
  barbara_cliente_id    uuid not null references public.barbara_clientes(id) on delete cascade,
  -- Sin FK a barbara_reglas a propósito: si la regla se borra, el hallazgo
  -- histórico sigue siendo cierto y no debería desaparecer con ella. Por eso
  -- también se guarda el texto de la regla y no solo su id.
  regla_id              uuid,
  regla                 text not null,
  veredicto             text not null
    check (veredicto in ('confirmada', 'contradicha', 'sin_diferencia', 'sin_evidencia')),
  accion                text not null
    check (accion in ('reforzar', 'revisar_con_cliente', 'ninguna', 'esperar')),
  motivo                text not null,
  muestras_a_favor      integer not null default 0 check (muestras_a_favor >= 0),
  muestras_resto        integer not null default 0 check (muestras_resto >= 0),
  -- Tasa de interacción (0..1). Nulas cuando el veredicto es sin_evidencia:
  -- no hubo con qué compararlas, y un 0 ahí se leería como "rindió pésimo".
  rendimiento_con_regla numeric,
  rendimiento_sin_regla numeric,
  piezas_evaluadas      integer not null default 0 check (piezas_evaluadas >= 0),
  corrido_en            timestamptz not null default now()
);

create index if not exists barbara_cruces_cliente_idx
  on public.barbara_cruces (barbara_cliente_id, corrido_en desc);
-- Para leer la historia de UNA regla sin escanear todo el cliente.
create index if not exists barbara_cruces_regla_idx
  on public.barbara_cruces (regla_id, corrido_en desc) where regla_id is not null;

alter table public.barbara_cruces enable row level security;

-- Solo el equipo. El cliente no ve esto todavía (ver nota de arriba); cuando
-- se decida mostrárselo, se agrega la policy correspondiente y recién ahí
-- pasa a ser algo que él puede leer.
drop policy if exists "admin_barbara_cruces" on public.barbara_cruces;
create policy "admin_barbara_cruces" on public.barbara_cruces
  for all using (public.es_admin()) with check (public.es_admin());

comment on table public.barbara_cruces is
  'Historial semanal del cruce entre las reglas declaradas por el cliente y el rendimiento real de sus piezas publicadas. Se inserta, no se actualiza: la evolución de un veredicto es el dato.';

notify pgrst, 'reload schema';
