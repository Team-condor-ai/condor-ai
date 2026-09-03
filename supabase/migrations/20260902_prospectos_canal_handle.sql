-- Prospección: cada canal guarda su @/usuario/nombre, no solo el nombre del
-- canal (2-sept-2026, pedido de Joaquín tras usar el CRM: "en prospeccion al
-- seleccionar un canal debe poner el @ o user o nombre de como se ubica en
-- ese canal, y pueden ser multiples").
--
-- Antes: canales text[] default '{}'  -- ej. {"instagram","facebook"}
-- Ahora: canales jsonb default '[]'   -- ej. [{"canal":"instagram","handle":"@negocio"}]
--
-- Conversión sin perder lo ya cargado: cada canal existente pasa a un
-- objeto con handle vacío -- se completa a mano, no se inventa un dato que
-- nunca se guardó.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'prospectos' and column_name = 'canales' and data_type = 'ARRAY'
  ) then
    alter table public.prospectos rename column canales to canales_viejo;
    alter table public.prospectos add column canales jsonb not null default '[]';
    update public.prospectos
    set canales = (
      select coalesce(jsonb_agg(jsonb_build_object('canal', c, 'handle', '')), '[]'::jsonb)
      from unnest(canales_viejo) as c
    );
    alter table public.prospectos drop column canales_viejo;
  end if;
end $$;
