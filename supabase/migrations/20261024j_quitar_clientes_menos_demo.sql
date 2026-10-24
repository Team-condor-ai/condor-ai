-- 24-oct-2026 · Pedido de Max: el portal parte limpio, solo con el cliente demo. 9 clientes respaldados.
-- Respaldo (esquema `respaldo`, sin acceso desde la API) y borrado de todos los clientes salvo el demo.
create table if not exists respaldo.clientes_2026_10_24 as
select now() as creado_en, jsonb_build_object(
  'clientes', (select jsonb_agg(to_jsonb(c)) from clientes c where c.email is distinct from 'clienteprueba@condorai.cl'),
  'cobros', (select jsonb_agg(to_jsonb(x)) from cobros x join clientes c on c.id = x.cliente_id where c.email is distinct from 'clienteprueba@condorai.cl'),
  'pagos', (select jsonb_agg(to_jsonb(x)) from pagos x join clientes c on c.id = x.cliente_id where c.email is distinct from 'clienteprueba@condorai.cl'),
  'notas', (select jsonb_agg(to_jsonb(x)) from clientes_notas x join clientes c on c.id = x.cliente_id where c.email is distinct from 'clienteprueba@condorai.cl')
) as datos;
delete from clientes where email is distinct from 'clienteprueba@condorai.cl';
delete from chat_mensajes;
select (select count(*) from clientes) clientes, (select count(*) from cobros) cobros, (select count(*) from pagos) pagos, (select count(*) from chat_mensajes) chats, (select count(*) from clientes_notas) notas, (select jsonb_array_length(datos->'clientes') from respaldo.clientes_2026_10_24) respaldados;
