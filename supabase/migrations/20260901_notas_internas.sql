-- Cóndor AI · Organización > Notas internas.
--
-- Datos de cuentas, accesos, y cualquier nota rápida del equipo que hoy vive
-- dispersa en chats y documentos sueltos. Puede llevar un archivo adjunto
-- (ej. un PDF) — reusa el bucket `biblioteca` que ya existe (mismo patrón que
-- la Biblioteca de archivos), bajo el prefijo `notas/`, para no duplicar
-- bucket ni políticas de Storage.

create table if not exists public.notas_internas (
  id               uuid primary key default gen_random_uuid(),
  titulo           text not null,
  contenido        text,
  -- Libre a propósito: "Cuenta", "Acceso", "Proveedor"... el equipo decide
  -- sus propias categorías en vez de encajar todo en una lista fija.
  categoria        text not null default 'Nota',
  archivo_url      text,
  archivo_nombre   text,
  archivo_peso_bytes bigint,
  creado_por       text,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now()
);

create index if not exists notas_internas_categoria_idx on public.notas_internas (categoria);

alter table public.notas_internas enable row level security;

drop policy if exists "admin_all_notas_internas" on public.notas_internas;
create policy "admin_all_notas_internas" on public.notas_internas
  for all using (public.es_admin()) with check (public.es_admin());

notify pgrst, 'reload schema';
