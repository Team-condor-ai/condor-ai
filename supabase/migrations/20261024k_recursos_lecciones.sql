-- 24-oct-2026 · Recursos de cada lección (enlaces a plantillas, carpetas, herramientas): [{titulo, url, tipo}]
alter table public.lecciones add column if not exists recursos jsonb not null default '[]';
