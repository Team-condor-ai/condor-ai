-- Each deliverable has a durable review state and feedback points to it.
alter table public.barbara_memoria
  add column if not exists estado text,
  add column if not exists revisada_en timestamptz,
  add column if not exists revisada_por text,
  add column if not exists revision_comentario text;

update public.barbara_memoria set estado = 'historica' where estado is null;

alter table public.barbara_memoria
  alter column estado set default 'en_revision',
  alter column estado set not null;

alter table public.barbara_memoria drop constraint if exists barbara_memoria_estado_check;
alter table public.barbara_memoria add constraint barbara_memoria_estado_check
  check (estado in ('en_revision', 'requiere_ajuste', 'aprobada', 'publicada', 'historica'));

create index if not exists barbara_memoria_entregas_cliente_idx
  on public.barbara_memoria (barbara_cliente_id, estado, creado_en desc);

alter table public.barbara_chats
  add column if not exists pieza_id uuid references public.barbara_memoria(id) on delete set null;
create index if not exists barbara_chats_pieza_idx
  on public.barbara_chats (pieza_id, creado_en) where pieza_id is not null;

notify pgrst, 'reload schema';
