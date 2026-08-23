-- Bárbara · semilla de la memoria fundacional.
--
-- REGLA DE ENTRADA A ESTA TABLA
-- ---------------------------------------------------------------------------
-- Acá sólo entra lo que Cóndor verificó en producción, con la evidencia
-- escrita al lado. NO entra "buenas prácticas de marketing" que suenan bien:
-- eso el modelo ya lo sabe de fábrica y llenar la tabla con teoría genérica
-- la convierte en ruido que compite con las reglas reales del cliente.
--
-- Cada fila de acá abajo salió de algo que pasó de verdad, con fecha. Si en el
-- futuro alguien agrega una sin evidencia comprobable, la está degradando.
--
-- Idempotente: se puede correr de nuevo sin duplicar.

insert into public.barbara_playbooks (titulo, regla, tipo, rubro, evidencia, peso)
select * from (values

  ('Caption en bloques, no en un párrafo',
   'La descripción va en 4 bloques separados por línea en blanco: (1) gancho de 1-2 líneas con 1-2 emojis, (2) cuerpo de 2-4 líneas cortas que puede llevar una pregunta, (3) cierre con CTA, (4) hashtags. Nunca un párrafo corrido: en el feed obliga a abrir "ver más" y se pierde.',
   'general', null,
   'Joaquín rechazó la primera caption real de Cóndor el 22-ago-2026 por venir toda en un párrafo, sin emojis ni preguntas. Pidió explícitamente que quedara anotado para la próxima.',
   90),

  ('Máximo 5 hashtags',
   'Nunca más de 5 hashtags en una publicación de Instagram.',
   'general', null,
   'Instagram rechazó una publicación real con HTTP 422 por traer 8 hashtags, 22-ago-2026. Además del prompt, hoy lo recorta blotato-outbox.mjs al publicar.',
   85),

  ('UGC es una persona hablándole a la cámara',
   'Un UGC es SIEMPRE una persona mostrando el producto y hablándole directo a la cámara, estilo grabado con su propio celular. Tomas de producto y de ambiente, sin nadie hablando, son otro formato y no son lo que el cliente compró.',
   'ugc', null,
   'Corrección de Joaquín del 17-ago-2026: el motor venía generando tomas de producto sin nadie hablando durante varias piezas.',
   80),

  ('Un argumento por pieza, no listas de características',
   'Cada pieza defiende UN solo argumento. Nada de listas de características ni de "todo lo que incluye". Se habla del costo de no resolver el problema, no de la tecnología ni del detalle del producto.',
   'carrusel', null,
   'Es la regla con la que se escribieron las series de venta de la cuenta propia de Cóndor (servicios y barbara_producto), en producción desde el 22-ago-2026.',
   70),

  ('Sin dato real, la pieza va sin número',
   'Si no tienes la cifra verificada en el material que te pasaron, escribe la pieza SIN cifras. Un buen texto sin números es publicable; uno con un número inventado no, porque sale con el logo de la marca encima.',
   'general', null,
   'El noticiero de Cóndor del 22-ago-2026 inventó una cifra atribuida a Bloomberg y un "reporte trimestral de Microsoft" que no existían. Se detectó mirando los PNG antes de publicar. Hoy también es regla dura en el system prompt (REGLA_VERACIDAD en motor.mjs).',
   95)

) as nuevos(titulo, regla, tipo, rubro, evidencia, peso)
where not exists (
  select 1 from public.barbara_playbooks p where p.titulo = nuevos.titulo
);
