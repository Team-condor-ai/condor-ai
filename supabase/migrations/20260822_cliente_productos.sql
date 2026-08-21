-- Portal Cóndor · productos que realmente se entregan a cada cliente.
--
-- Un cobro dice por qué entró dinero. Esta tabla dice qué producto tiene el
-- cliente, incluso antes de cobrarlo, mientras está pausado o después de que
-- cambió su forma de pago. Mezclar ambas cosas haría imposible representar
-- pruebas, cortesías, migraciones y contratos con varias cuotas.

create table if not exists public.cliente_productos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.clientes(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete restrict,
  estado      text not null default 'activo'
              check (estado in ('pendiente','activo','pausado','finalizado')),
  inicio      date default current_date,
  fin         date,
  notas       text,
  creado_por  uuid,
  creado_en   timestamptz not null default now(),
  constraint cliente_producto_unico unique (cliente_id, producto_id),
  constraint cliente_producto_fechas_ok check (
    fin is null or inicio is null or fin >= inicio
  )
);

create index if not exists cliente_productos_cliente_idx
  on public.cliente_productos (cliente_id);
create index if not exists cliente_productos_producto_idx
  on public.cliente_productos (producto_id);

alter table public.cliente_productos enable row level security;

drop policy if exists "admin_all_cliente_productos" on public.cliente_productos;
create policy "admin_all_cliente_productos" on public.cliente_productos
  for all using (public.es_admin()) with check (public.es_admin());

drop policy if exists "cliente_ve_sus_productos" on public.cliente_productos;
create policy "cliente_ve_sus_productos" on public.cliente_productos
  for select using (exists (
    select 1 from public.clientes c
    where c.id = cliente_productos.cliente_id
      and lower(c.email) = lower((select auth.jwt() ->> 'email'))
  ));

-- Lo ya vinculado a cobros se convierte en asignación sin duplicar filas.
insert into public.cliente_productos (cliente_id, producto_id, estado, inicio)
select distinct on (c.cliente_id, c.producto_id)
  c.cliente_id,
  c.producto_id,
  case
    when c.estado in ('anulado','cancelada') then 'finalizado'
    when c.estado = 'pausada' then 'pausado'
    else 'activo'
  end,
  coalesce(c.creado_en::date, current_date)
from public.cobros c
where c.producto_id is not null
order by c.cliente_id, c.producto_id, c.creado_en desc
on conflict (cliente_id, producto_id) do nothing;

-- Elegir un producto al crear/editar un cobro también lo deja asignado. No se
-- automatiza la baja: cancelar una cuota no demuestra que terminó la entrega.
create or replace function public.asignar_producto_desde_cobro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.producto_id is not null then
    insert into public.cliente_productos (
      cliente_id, producto_id, estado, inicio
    ) values (
      new.cliente_id,
      new.producto_id,
      case when new.estado = 'pausada' then 'pausado' else 'activo' end,
      coalesce(new.creado_en::date, current_date)
    )
    on conflict (cliente_id, producto_id) do update
      set estado = case
        when cliente_productos.estado = 'finalizado' then 'activo'
        else cliente_productos.estado
      end,
      fin = null;
  end if;
  return new;
end;
$$;

-- Solo el trigger debe poder invocar esta función con privilegios elevados.
revoke all on function public.asignar_producto_desde_cobro()
  from public, anon, authenticated;

drop trigger if exists cobro_asigna_producto on public.cobros;
create trigger cobro_asigna_producto
after insert or update of producto_id on public.cobros
for each row execute function public.asignar_producto_desde_cobro();
