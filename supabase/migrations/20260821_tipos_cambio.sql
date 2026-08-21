-- Portal Cóndor · convertir a CLP lo que se cobra en otras monedas.
--
-- POR QUÉ (21-ago-2026)
-- ---------------------------------------------------------------------------
-- El CRM cobra en CLP, COP, PEN y USD. Para que las gráficas muestren un total
-- que signifique algo hay que llevarlo todo a una sola moneda, y para eso hace
-- falta un tipo de cambio.
--
-- LO QUE NO SE PUEDE HACER ES ESCRIBIRLO A MANO
-- ---------------------------------------------------------------------------
-- El panel viejo tenía `TASA_CLP = { USD: 950, PEN: 255 }` escrito dentro del
-- JavaScript desde junio. Ese número no falla nunca: sigue dando un total,
-- cada vez más equivocado, y nadie se entera. Por eso el valor vive en una
-- tabla CON FECHA — si el dato está viejo, la pantalla lo puede decir.
--
-- Se guarda "cuántos pesos vale una unidad de esta moneda", que es la forma en
-- que se usa: `monto * a_clp`.

create table if not exists public.tipos_cambio (
  moneda         text primary key,
  a_clp          numeric not null check (a_clp > 0),
  -- De dónde salió. Sirve para saber a quién culpar si un número no cuadra.
  fuente         text,
  actualizado_en timestamptz not null default now()
);

alter table public.tipos_cambio enable row level security;

-- Cualquiera que haya iniciado sesión puede LEER: no es un dato sensible y el
-- portal del cliente también muestra montos.
drop policy if exists "ver_tipos_cambio" on public.tipos_cambio;
create policy "ver_tipos_cambio" on public.tipos_cambio
  for select using ( auth.uid() is not null );

-- Escribir es solo del equipo. En la práctica lo hace la Edge Function
-- `tipo-cambio` con la service role, que se salta RLS igual.
drop policy if exists "admin_escribe_tipos_cambio" on public.tipos_cambio;
create policy "admin_escribe_tipos_cambio" on public.tipos_cambio
  for all using ( public.es_admin() ) with check ( public.es_admin() );

-- El peso vale un peso. Esta fila hace que la conversión funcione sin ningún
-- caso especial en el código: CLP se busca igual que las demás.
insert into public.tipos_cambio (moneda, a_clp, fuente)
values ('CLP', 1, 'fijo')
on conflict (moneda) do nothing;
