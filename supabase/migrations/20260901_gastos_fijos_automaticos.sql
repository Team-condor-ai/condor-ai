-- Cóndor AI · gastos fijos que se anotan solos.
--
-- Hasta ahora TODOS los gastos fijos pedían un clic en "Anotar" cada mes. Un
-- gasto fijo con `automatico = true` no espera ese clic: un job diario
-- (`pg_cron`) revisa cuáles ya llegaron a su `dia_del_mes` y no se han
-- anotado este mes, y los anota solo.
--
-- LA IDEMPOTENCIA VA EN LA REFERENCIA, NO EN UN "YA CORRIÓ"
-- ---------------------------------------------------------------------------
-- Igual que `contabilizar_gasto_meta` y `contabilizar_pago`: el asiento lleva
-- una `referencia` única ('fijo:<id>:<año-mes>') sobre el índice que ya existe
-- (`asientos_referencia_idx`). Si el job corre dos veces el mismo día — o si
-- alguien lo dispara a mano — no se duplica.

alter table public.gastos_fijos
  add column if not exists automatico boolean not null default false,
  add column if not exists medio_pago_id uuid references public.cuentas(id);

comment on column public.gastos_fijos.automatico is
  'Si es true, el job diario lo anota solo al llegar a dia_del_mes. Si es false, hay que anotarlo a mano.';
comment on column public.gastos_fijos.medio_pago_id is
  'Cuenta líquida de la que sale la plata cuando se anota automático. Requerida si automatico = true.';

create or replace function public.contabilizar_gastos_fijos_automaticos()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  g record;
  v_referencia text;
  v_periodo text := to_char(current_date, 'YYYY-MM');
  v_asiento_id uuid;
begin
  for g in
    select * from public.gastos_fijos
    where activo
      and automatico
      and cuenta_id is not null
      and medio_pago_id is not null
      and dia_del_mes is not null
      and dia_del_mes <= extract(day from current_date)::int
      and coalesce(monto, 0) > 0
  loop
    v_referencia := 'fijo:' || g.id::text || ':' || v_periodo;

    if exists (select 1 from public.asientos where referencia = v_referencia) then
      continue;
    end if;

    insert into public.asientos (fecha, glosa, origen, referencia)
    values (current_date, g.nombre, 'fijo-automatico', v_referencia)
    on conflict (referencia) where referencia is not null do nothing
    returning id into v_asiento_id;

    -- Si otra corrida ganó la carrera entre el exists y el insert, no hay
    -- fila que devolver: no se inventan líneas para un asiento que no es de
    -- esta corrida.
    if v_asiento_id is null then
      continue;
    end if;

    insert into public.asiento_lineas (asiento_id, cuenta_id, debe, haber, detalle)
    values
      (v_asiento_id, g.cuenta_id, g.monto, 0, g.nombre || ' (automático)'),
      (v_asiento_id, g.medio_pago_id, 0, g.monto, g.nombre || ' (automático)');
  end loop;
end;
$$;

revoke all on function public.contabilizar_gastos_fijos_automaticos()
  from public, anon, authenticated;
grant execute on function public.contabilizar_gastos_fijos_automaticos() to service_role;

-- El job. `cron.schedule` con el mismo nombre reemplaza la programación
-- anterior en vez de duplicar el job — se puede correr esta migración más
-- de una vez sin dejar dos jobs corriendo lo mismo.
create extension if not exists pg_cron;

select cron.schedule(
  'gastos-fijos-automaticos',
  '0 12 * * *',
  $$select public.contabilizar_gastos_fijos_automaticos();$$
);

notify pgrst, 'reload schema';
