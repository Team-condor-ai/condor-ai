-- Portal Cóndor · Organización: tareas y metas.
--
-- QUÉ RESUELVE
-- ---------------------------------------------------------------------------
-- Hoy el trabajo del equipo vive en la cabeza de cada uno y en el grupo de
-- WhatsApp. El portal ya sabe quiénes son los clientes, qué se les cobra y qué
-- reuniones hay; lo que falta es qué hay que HACER, y para quién.
--
-- POR QUÉ TAMBIÉN METAS Y NO SOLO TAREAS
-- ---------------------------------------------------------------------------
-- Un tablero de tareas dice en qué se está gastando el día. No dice si eso
-- acerca a algo. Las metas se apoyan en números que el portal YA calcula
-- —recurrente, clientes, cobrado— así que el avance se actualiza solo en vez
-- de depender de que alguien lo mueva a mano, que es como mueren todos los
-- tableros de objetivos.

-- ───────────────────────────────────────────────────────────────────────────
-- 1) Tareas
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.tareas (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  descripcion text,

  -- Las columnas del tablero. 'bloqueada' existe porque una tarea detenida por
  -- algo ajeno no es lo mismo que una sin empezar, y meterlas en la misma pila
  -- esconde justo lo que hay que destrabar.
  estado      text not null default 'por_hacer'
              check (estado in ('por_hacer','en_curso','bloqueada','hecha')),
  prioridad   text not null default 'media'
              check (prioridad in ('baja','media','alta','urgente')),

  -- A quién le toca y de qué cliente es. Ambas opcionales: hay tareas del
  -- equipo que no son de ningún cliente, y tareas que aún no tienen dueño.
  asignado_a  text,
  cliente_id  uuid references public.clientes(id) on delete set null,

  vence       date,
  etiquetas   text[] not null default '{}',

  -- Posición dentro de su columna, para poder reordenar a mano.
  orden       int not null default 0,

  -- Cuándo se dio por hecha. Sin esta fecha no se puede saber cuánto demoró
  -- nada — el mismo error que ya cometimos al no guardar cuándo se cancela
  -- una suscripción.
  hecha_en    timestamptz,

  creado_por  text,
  creado_en   timestamptz not null default now()
);

create index if not exists tareas_estado_idx  on public.tareas (estado, orden);
create index if not exists tareas_vence_idx   on public.tareas (vence) where estado <> 'hecha';
create index if not exists tareas_cliente_idx on public.tareas (cliente_id);

-- La fecha de término se pone sola: si dependiera de que alguien la escriba,
-- no estaría nunca.
create or replace function public.trg_tarea_hecha()
returns trigger language plpgsql as $$
begin
  if new.estado = 'hecha' and (old.estado is distinct from 'hecha') then
    new.hecha_en := now();
  elsif new.estado <> 'hecha' then
    new.hecha_en := null;
  end if;
  return new;
end $$;

drop trigger if exists tarea_hecha on public.tareas;
create trigger tarea_hecha before update on public.tareas
  for each row execute function public.trg_tarea_hecha();

-- ───────────────────────────────────────────────────────────────────────────
-- 2) Metas
--
-- `metrica` dice de dónde sale el avance. Las automáticas las calcula el
-- portal con datos que ya tiene; 'manual' es para lo que no es un número de
-- la base ("cerrar el contrato con X").
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.metas (
  id        uuid primary key default gen_random_uuid(),
  titulo    text not null,
  detalle   text,
  metrica   text not null default 'manual'
            check (metrica in ('manual','recurrente','clientes','cobrado_mes','suscriptores_ratia')),
  objetivo  numeric not null,
  -- Solo para las manuales; en las automáticas se ignora y manda el cálculo.
  avance    numeric not null default 0,
  hasta     date,
  estado    text not null default 'activa' check (estado in ('activa','lograda','archivada')),
  creado_en timestamptz not null default now()
);

-- ───────────────────────────────────────────────────────────────────────────
-- 3) Seguridad — solo el equipo
-- ───────────────────────────────────────────────────────────────────────────
alter table public.tareas enable row level security;
alter table public.metas  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['tareas','metas'] loop
    execute format('drop policy if exists "admin_all_%1$s" on public.%1$I', t);
    execute format(
      'create policy "admin_all_%1$s" on public.%1$I for all using (public.es_admin()) with check (public.es_admin())',
      t);
  end loop;
end $$;
