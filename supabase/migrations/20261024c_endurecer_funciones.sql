-- 24-oct-2026 · Endurecer funciones (revisión de seguridad del portal 2.0).
-- Las funciones internas (Bárbara, colas de correo, triggers de leads y reuniones) ya no se pueden llamar
-- desde el navegador: solo el servidor (service_role) o el propio trigger. es_admin/es_creador/es_participante
-- siguen ejecutables porque las políticas RLS las usan.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'barbara\_%'
        or p.proname in ('encolar_mensaje', 'correo_autorizado', 'correo_tecnobox_vigilar', 'sync_sheets',
                         'leads_antes_de_guardar', 'leads_despues_de_guardar', 'trg_lead_optout', 'trg_lead_seguimiento',
                         'trg_reunion_reprogramar', 'trg_reunion_seguimiento', 'clientes_cliente_solo_sus_campos'))
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.firma);
    execute format('grant execute on function %s to service_role', f.firma);
  end loop;
end $$;

alter function public.es_admin() set search_path = public;
alter function public.correo_autorizado(text) set search_path = public;
alter function public.clientes_cliente_solo_sus_campos() set search_path = public;
