-- 24-oct-2026 · Las notas internas de un cliente salen de `clientes`.
-- Problema: la política `cliente_ve_lo_suyo` deja a cada cliente leer SU fila completa de `clientes`, y la
-- columna `notas` («Solo las ve el equipo; el cliente nunca las lee») venía incluida: desde el navegador, un
-- cliente podía leer lo que el equipo escribió de él. Ahora viven en `clientes_notas`, que solo ve el equipo.
create table if not exists public.clientes_notas (
  cliente_id uuid primary key references public.clientes(id) on delete cascade,
  notas text,
  actualizado_en timestamptz not null default now(),
  actualizado_por text
);
alter table public.clientes_notas enable row level security;
drop policy if exists clientes_notas_equipo on public.clientes_notas;
create policy clientes_notas_equipo on public.clientes_notas for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));
revoke all on public.clientes_notas from anon;

insert into public.clientes_notas (cliente_id, notas, actualizado_por)
select id, notas, 'migracion' from public.clientes where coalesce(notas, '') <> ''
on conflict (cliente_id) do update set notas = excluded.notas;

-- El trigger que protege los campos del cliente ya no toca `notas` (la columna se borra abajo).
create or replace function public.clientes_cliente_solo_sus_campos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- El equipo puede tocar todo.
  if public.es_admin() then
    return new;
  end if;

  -- Un cliente solo puede cambiar: telefono y archivado (darse de baja).
  -- Todo lo demás se restaura al valor que ya tenía. Se revierte en vez de
  -- lanzar error a propósito: así el guardado del portal sigue funcionando
  -- aunque el front mande la fila completa.
  new.email          := old.email;
  new.nombre         := old.nombre;
  new.negocio        := old.negocio;
  new.plan           := old.plan;
  new.concepto       := old.concepto;
  new.setup_monto    := old.setup_monto;
  new.mensual_monto  := old.mensual_monto;
  new.moneda         := old.moneda;
  new.setup_estado   := old.setup_estado;
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

  -- `mensual_estado` solo se admite si es la baja; si no, se conserva.
  if not (new.archivado is true and old.archivado is distinct from true) then
    new.mensual_estado := old.mensual_estado;
  end if;

  return new;
end;
$$;

-- Paso 2 (después de publicar el portal que ya lee `clientes_notas`): se recopia por si alguien escribió en el
-- intertanto y se borra la columna, para que no quede nada legible por el cliente.
insert into public.clientes_notas (cliente_id, notas, actualizado_por)
select id, notas, 'migracion' from public.clientes where coalesce(notas, '') <> ''
on conflict (cliente_id) do update set notas = coalesce(public.clientes_notas.notas, excluded.notas);
alter table public.clientes drop column if exists notas;
