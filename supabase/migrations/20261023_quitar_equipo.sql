-- Cóndor AI · Quitar personas del equipo desde el Centro operativo.
-- El directorio nació solo con altas (20260909); ahora el equipo rota por
-- proyecto y hace falta poder retirar el acceso. La baja se confirma en el
-- portal, y nadie puede quitarse a sí mismo: así el último staff con sesión
-- nunca deja el portal sin dueño por un click.
drop policy if exists "staff_quita_equipo" on public.admins;
create policy "staff_quita_equipo" on public.admins for delete
  using (public.es_admin() and email <> (select auth.jwt() ->> 'email'));

notify pgrst, 'reload schema';
