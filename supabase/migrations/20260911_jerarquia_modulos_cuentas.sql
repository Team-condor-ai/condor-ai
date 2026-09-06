-- Permite organizar un módulo grande en submódulos operativos.
alter table public.modulos_cuentas
  add column if not exists parent_id uuid
  references public.modulos_cuentas(id) on delete cascade;

create index if not exists modulos_cuentas_parent_idx
  on public.modulos_cuentas(parent_id, orden, nombre);

notify pgrst, 'reload schema';
