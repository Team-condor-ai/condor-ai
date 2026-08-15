-- Portal · 14-ago-2026
-- Lo que le falta a `clientes` para el área del cliente.

-- 1) TELÉFONO
-- "Mi cuenta" ya lo soporta y oculta el campo si la columna no existe, así
-- que esto lo habilita sin tocar el front.
alter table public.clientes add column if not exists telefono text;

-- 2) EL CLIENTE PUEDE EDITAR LO SUYO, PERO NO TODO
-- Hasta ahora `cliente_ve_lo_suyo` era solo SELECT: el cliente no podía
-- guardar su teléfono ni darse de baja. La política de UPDATE se agrega
-- acotada, porque un UPDATE abierto sobre su propia fila le dejaría cambiar
-- `mensual_monto` a 0 desde la consola del navegador.
--
-- Postgres no permite restringir columnas dentro de una policy, así que se
-- resuelve con un trigger que revierte cualquier cambio a campos de dinero
-- cuando quien edita no es del equipo.
drop policy if exists "cliente_edita_lo_suyo" on public.clientes;
create policy "cliente_edita_lo_suyo" on public.clientes
  for update
  using      ( email = (select auth.jwt() ->> 'email') )
  with check ( email = (select auth.jwt() ->> 'email') );

create or replace function public.clientes_cliente_solo_sus_campos()
returns trigger language plpgsql security definer as $$
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

  -- `mensual_estado` solo se admite si es la baja; si no, se conserva.
  if not (new.archivado is true and old.archivado is distinct from true) then
    new.mensual_estado := old.mensual_estado;
  end if;

  return new;
end;
$$;

drop trigger if exists clientes_cliente_solo_sus_campos on public.clientes;
create trigger clientes_cliente_solo_sus_campos
  before update on public.clientes
  for each row execute function public.clientes_cliente_solo_sus_campos();
