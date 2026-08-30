-- Bárbara · el nicho en palabras del cliente + dos arreglos del onboarding.
--
-- Va contra el proyecto VIVO: ylsqvmggycfijzfvguzq.
-- (docs/como-seguir.md todavía nombra ogmvdthxwcmvqjlxhpsr, que es el anterior.)
--
-- Tres cosas, en orden de urgencia para el estreno:
--
--   1. La columna `contexto_nicho`, que es lo que el formulario nuevo pide y
--      hoy no tiene dónde guardarse.
--   2. Que ese texto llegue a la memoria semántica solo. Sin esto sería un
--      escritor sin lector — el mismo agujero que clientes.mjs documenta sobre
--      `barbara_memoria_nodos`: "la tabla existía, el portal la escribía y el
--      generador NUNCA la leía".
--   3. ⚠️ EL BLOQUEO REAL DEL ESTRENO: hoy un cliente nuevo NO PUEDE llenar su
--      formulario. `barbara_formulario` tiene policies de select y update para
--      el cliente, pero NINGUNA de insert. Si la fila no existe, el cliente
--      entra al onboarding y no puede guardar nada. Lo mismo con el brand book.

begin;

-- ── 1. la columna ──────────────────────────────────────────────────────────

alter table public.barbara_formulario
  add column if not exists contexto_nicho text;

comment on column public.barbara_formulario.contexto_nicho is
  'El nicho del negocio en palabras del propio cliente, sin estructura. Es el '
  'campo más rico del formulario: alimenta el prompt y la búsqueda semántica.';

-- ── 2. que llegue a la memoria semántica ───────────────────────────────────

-- El texto se copia a `barbara_memoria_nodos` como nodo de perfil. Desde ahí
-- lo levantan solos los dos caminos que ya existen:
--   · memoria.mjs lo puntúa y lo mete en el prompt (capa de más peso);
--   · memoria-semantica.mjs lo vectoriza en la próxima corrida.
--
-- No se calcula el embedding acá: Postgres no habla con OpenAI. Se deja en
-- NULL y `rellenarEmbeddingsFaltantes` lo completa, que es exactamente para lo
-- que fue escrita esa función.
create or replace function public.barbara_sincronizar_contexto_nicho()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  marca constant text := 'formulario:contexto_nicho';
  texto text;
  cambio_texto boolean;
begin
  texto := nullif(btrim(coalesce(new.contexto_nicho, '')), '');

  if texto is null then
    -- Si el cliente vació el campo, el nodo se apaga en vez de borrarse: el
    -- historial de por qué Bárbara escribió lo que escribió no se tira.
    update public.barbara_memoria_nodos
       set activo = false, actualizado_en = now()
     where barbara_cliente_id = new.barbara_cliente_id and origen = marca;
    return new;
  end if;

  -- Tope de 1600 como el resto de los nodos (ver barbara_guardar_nodo). El
  -- texto COMPLETO queda en barbara_formulario; acá va la versión que entra al
  -- prompt, que igual tiene presupuesto de caracteres en memoria.mjs.
  texto := left(texto, 1600);

  -- Se mira el estado ANTES de tocarlo: hace falta distinguir "el texto
  -- cambió" (hay que revectorizar) de "solo hay que reactivar el nodo porque
  -- el cliente vació el campo y volvió a escribir lo mismo" (no hace falta).
  select (n.contenido is distinct from texto)
    into cambio_texto
    from public.barbara_memoria_nodos n
   where n.barbara_cliente_id = new.barbara_cliente_id and n.origen = marca;

  update public.barbara_memoria_nodos
     set contenido      = texto,
         activo         = true,
         actualizado_en = now()
   where barbara_cliente_id = new.barbara_cliente_id
     and origen = marca
     and (contenido is distinct from texto or activo = false);

  if cambio_texto is not null then       -- el nodo existe
    if not cambio_texto then return new; -- mismo texto: nada que revectorizar
    end if;
    -- El embedding viejo describe el texto viejo: dejarlo sería buscar por
    -- semántica contra algo que el cliente ya cambió. Se nulea para que
    -- `rellenarEmbeddingsFaltantes` lo recalcule en la próxima corrida.
    --
    -- Va por EXECUTE con su excepción porque al 29-ago-2026 la columna
    -- `embedding` NO existe en el proyecto vivo: `memoria-semantica.mjs` y
    -- `embeddings.mjs` están escritos, pero la migración de pgvector que
    -- citan (20260827_barbara_memoria_pgvector.sql) no está en el repo. El
    -- código ya tolera esa ausencia cayendo a lista vacía; esta migración
    -- también, y sigue siendo correcta el día que la columna aparezca.
    begin
      execute 'update public.barbara_memoria_nodos set embedding = null'
           || ' where barbara_cliente_id = $1 and origen = $2'
        using new.barbara_cliente_id, marca;
    exception
      when undefined_column then null;  -- base sin pgvector: no hay qué invalidar
    end;
    return new;
  end if;

  -- `cambio_texto` nulo ⇒ el nodo no existía. El `not exists` es una guarda
  -- contra dos guardados simultáneos del mismo formulario, que sin ella
  -- dejarían dos nodos de perfil compitiendo por el mismo espacio del prompt.
  if not exists (
    select 1 from public.barbara_memoria_nodos
     where barbara_cliente_id = new.barbara_cliente_id and origen = marca
  ) then
    insert into public.barbara_memoria_nodos
      (barbara_cliente_id, tipo, titulo, contenido, peso, activo, origen)
    values
      (new.barbara_cliente_id, 'perfil', 'Su negocio, en sus palabras', texto, 5, true, marca);
  end if;

  return new;
end;
$$;

drop trigger if exists barbara_formulario_contexto_nicho on public.barbara_formulario;
create trigger barbara_formulario_contexto_nicho
  after insert or update of contexto_nicho on public.barbara_formulario
  for each row execute function public.barbara_sincronizar_contexto_nicho();

-- ── 3. que un cliente nuevo pueda llenar su formulario ─────────────────────

-- Se resuelve creando las filas al dar de alta al cliente, no dándole INSERT
-- libre: con las policies de update que ya existen, una fila que existe es
-- todo lo que el cliente necesita para editarla. Menos superficie, mismo
-- resultado.
create or replace function public.barbara_preparar_onboarding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.barbara_formulario (barbara_cliente_id)
  values (new.id)
  on conflict (barbara_cliente_id) do nothing;

  insert into public.barbara_brand_book (barbara_cliente_id)
  values (new.id)
  on conflict (barbara_cliente_id) do nothing;

  return new;
end;
$$;

drop trigger if exists barbara_clientes_preparar_onboarding on public.barbara_clientes;
create trigger barbara_clientes_preparar_onboarding
  after insert on public.barbara_clientes
  for each row execute function public.barbara_preparar_onboarding();

-- Backfill para los clientes que ya existen sin fila.
--
-- ⚠️ Acotado a propósito a los que tienen `telegram_chat_id` NULL.
--
-- El motivo: decidirElegibilidad() pide que bb y form EXISTAN, no que tengan
-- datos. Crear filas vacías para un cliente que YA tiene Telegram configurado
-- lo volvería elegible de golpe, y en la próxima corrida del cron Bárbara le
-- generaría una pieza con el formulario en blanco — sin público, sin tono y
-- sin restricciones. Contenido malo, mandado a un cliente real, sin que nadie
-- lo pidiera.
--
-- Un cliente sin `telegram_chat_id` no genera nada pase lo que pase
-- (clientes.mjs:137), así que ahí la fila vacía es inofensiva — y es
-- justamente el estado de un cliente nuevo en onboarding, que es a quien esto
-- viene a destrabar.
--
-- Para un cliente ya activo al que le falte el formulario: créenselo a mano
-- CON datos, no con esta migración.
insert into public.barbara_formulario (barbara_cliente_id)
select bc.id from public.barbara_clientes bc
 where bc.telegram_chat_id is null
   and not exists (
     select 1 from public.barbara_formulario f where f.barbara_cliente_id = bc.id
   )
on conflict (barbara_cliente_id) do nothing;

insert into public.barbara_brand_book (barbara_cliente_id)
select bc.id from public.barbara_clientes bc
 where bc.telegram_chat_id is null
   and not exists (
     select 1 from public.barbara_brand_book b where b.barbara_cliente_id = bc.id
   )
on conflict (barbara_cliente_id) do nothing;

-- Backfill del nodo de memoria para quien ya hubiera escrito su contexto
-- (hoy nadie, pero deja la migración re-ejecutable sin dejar huecos).
update public.barbara_formulario
   set contexto_nicho = contexto_nicho
 where nullif(btrim(coalesce(contexto_nicho, '')), '') is not null;

commit;
