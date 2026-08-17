-- Portal Cóndor · el candado de "el cliente solo toca lo suyo" tapa también
-- las columnas nuevas.
--
-- POR QUÉ (17-ago-2026)
-- ---------------------------------------------------------------------------
-- `clientes_cliente_solo_sus_campos` es un BEFORE UPDATE que revierte, uno por
-- uno, los campos que un cliente NO puede cambiar de su propia ficha (solo
-- puede tocar `telefono` y darse de baja). La lista de campos está escrita a
-- mano, así que cada columna nueva nace FUERA del candado.
--
-- Hoy se agregaron `nombre`, `notas`, `cobra_setup` y `cobra_mensual` y las
-- cuatro quedaron editables por el cliente. `notas` es la peor: son notas
-- internas del equipo, que el cliente no debería poder ni leer ni escribir.
--
-- Se agregan a la lista. Ojo para el futuro: cualquier columna nueva de
-- `clientes` hay que sumarla acá también, o queda abierta.

create or replace function public.clientes_cliente_solo_sus_campos()
returns trigger
language plpgsql
security definer
as $function$
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
  new.notas          := old.notas;

  -- `mensual_estado` solo se admite si es la baja; si no, se conserva.
  if not (new.archivado is true and old.archivado is distinct from true) then
    new.mensual_estado := old.mensual_estado;
  end if;

  return new;
end;
$function$;
