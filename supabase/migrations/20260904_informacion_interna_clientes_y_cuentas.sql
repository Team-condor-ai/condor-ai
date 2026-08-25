-- Información interna: una nota o una cuenta puede pertenecer a un cliente.
-- Las cuentas llevan sus datos estructurados para no esconder usuario, URL o
-- titular dentro de un párrafo libre. Las notas ya existentes pasan a tipo
-- "nota" sin perder categoría, contenido ni archivos.

alter table public.notas_internas
  add column if not exists tipo text not null default 'nota'
    check (tipo in ('nota', 'cuenta')),
  add column if not exists cliente_id uuid references public.clientes(id) on delete set null,
  add column if not exists datos_cuenta jsonb;

create index if not exists notas_internas_cliente_idx
  on public.notas_internas (cliente_id)
  where cliente_id is not null;

update public.notas_internas
set tipo = 'cuenta'
where lower(categoria) in ('cuenta', 'acceso') and tipo = 'nota';

notify pgrst, 'reload schema';
