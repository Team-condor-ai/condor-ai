-- El cliente puede ver la identidad que Bárbara usa para su marca, pero no
-- alterarla: el equipo es dueño de su configuración visual y evita que una
-- edición accidental cambie la siguiente pieza.
drop policy if exists "cliente_ve_su_brand_book" on public.barbara_brand_book;
create policy "cliente_ve_su_brand_book" on public.barbara_brand_book
  for select using (exists (
    select 1
    from public.barbara_clientes bc
    join public.clientes c on c.id = bc.cliente_id
    where bc.id = barbara_brand_book.barbara_cliente_id
      and lower(c.email) = lower((select auth.jwt() ->> 'email'))
  ));
