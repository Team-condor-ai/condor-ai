-- Bandeja de ecommerce@tecnoboxchile.cl dentro del Portal (26-sept-2026, pedido de Joaquín).
-- La casilla vive en el servidor propio de Tecnobox; la función `correo-tecnobox` la lee por IMAP cada
-- 2 minutos (pg_cron) y copia acá los correos nuevos. Responder sale por SMTP como ecommerce@.
-- Solo el equipo de Cóndor (es_admin) lee o marca; nadie escribe filas desde el navegador.
create table if not exists correo_tecnobox (
  id              bigserial primary key,
  uid             bigint not null unique,          -- UID IMAP en INBOX (evita duplicados)
  message_id      text,
  de_nombre       text,
  de_email        text,
  para            text,
  asunto          text,
  fecha           timestamptz,
  texto           text,
  html            text,
  leido           boolean not null default false,
  respondido_en   timestamptz,
  respondido_por  text,
  creado_en       timestamptz not null default now()
);
create index if not exists correo_tecnobox_fecha on correo_tecnobox (fecha desc);

create table if not exists correo_tecnobox_respuestas (
  id          bigserial primary key,
  correo_id   bigint not null references correo_tecnobox(id) on delete cascade,
  cuerpo      text not null,
  enviado_por text not null,
  enviado_en  timestamptz not null default now()
);

alter table correo_tecnobox enable row level security;
alter table correo_tecnobox_respuestas enable row level security;
drop policy if exists correo_tecnobox_leer on correo_tecnobox;
create policy correo_tecnobox_leer on correo_tecnobox for select to authenticated using (es_admin());
drop policy if exists correo_tecnobox_marcar on correo_tecnobox;
create policy correo_tecnobox_marcar on correo_tecnobox for update to authenticated using (es_admin()) with check (es_admin());
drop policy if exists correo_tecnobox_resp_leer on correo_tecnobox_respuestas;
create policy correo_tecnobox_resp_leer on correo_tecnobox_respuestas for select to authenticated using (es_admin());
