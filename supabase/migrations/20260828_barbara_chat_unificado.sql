-- Bárbara · un solo hilo de conversación, venga del portal o de Telegram.
--
-- EL PROBLEMA QUE RESUELVE
-- ---------------------------------------------------------------------------
-- `barbara_chats` nació como ESPEJO de Telegram (ver 20260815141239). El chat
-- del portal, en cambio, se construyó efímero a propósito: `barbara-chat`
-- respondía sin insertar nada y el navegador mandaba el historial de la visita.
-- Consecuencia: al recargar la página la conversación desaparecía, el cliente
-- que escribía por Telegram y el que escribía por el portal parecían dos
-- personas distintas, y nada de lo conversado podía alimentar la memoria.
--
-- Esta migración no cambia el canal real de nadie: solo hace que ambos
-- escriban en la MISMA tabla, distinguidos por `canal`, para que el hilo se
-- pueda leer completo y aprender de él.
--
-- `canal` va con default 'portal' y sin backfill: las filas que ya existen son
-- justamente el espejo de Telegram, así que abajo se marcan como tales antes
-- de fijar el default.

alter table public.barbara_chats
  add column if not exists canal text,
  -- Imagen que acompaña al mensaje (el cliente manda una referencia visual).
  -- Es la URL en Storage, no el binario: la tabla es de conversación.
  add column if not exists imagen_url text,
  -- El mensaje llegó como nota de voz y `mensaje` es su transcripción. Importa
  -- para el aprendizaje: una transcripción puede traer errores y no debería
  -- pesar igual que algo que el cliente escribió con sus manos.
  add column if not exists es_audio boolean not null default false;

-- Las filas previas son todas espejo de Telegram (el portal no insertaba).
update public.barbara_chats set canal = 'telegram' where canal is null;

alter table public.barbara_chats
  alter column canal set default 'portal';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'barbara_chats_canal_check'
  ) then
    alter table public.barbara_chats
      add constraint barbara_chats_canal_check check (canal in ('portal', 'telegram'));
  end if;
end $$;

-- El hilo se lee siempre "lo más reciente de este cliente".
create index if not exists barbara_chats_hilo_idx
  on public.barbara_chats (barbara_cliente_id, creado_en desc);

notify pgrst, 'reload schema';
