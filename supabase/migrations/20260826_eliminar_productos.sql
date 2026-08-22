-- Retira por completo el catálogo interno de productos y sus asignaciones.
-- Los cobros, pagos y el texto libre `clientes.plan` se conservan: son
-- registros contractuales y financieros independientes del catálogo.

drop trigger if exists cobro_asigna_producto on public.cobros;
drop function if exists public.asignar_producto_desde_cobro();
drop view if exists public.productos_rendimiento;
drop table if exists public.cliente_productos;

alter table if exists public.cobros
  drop column if exists producto_id;

drop table if exists public.productos;
