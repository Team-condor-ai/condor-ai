-- api_creditos.revelable: bandera que le dice al portal si dibujar el botón
-- "Revelar" en la fila. Hasta el 28-ago-2026 esa decisión vivía en un `Set`
-- hardcodeado en el frontend (PROVEEDORES_REVELABLES en CreditosApi.tsx),
-- que era razonable cuando los proveedores se agregaban a mano editando
-- código. Ahora el staff puede dar de alta proveedores desde el portal
-- (Edge Function `agregar-credito-api`), así que la lista tiene que vivir
-- en la base y actualizarse sola.
--
-- LA MANTIENE `agregar-credito-api`: cuando se guarda un valor en
-- `api_credenciales`, la misma función setea `revelable = true` acá. Si se
-- da de alta un proveedor sin credencial, queda en `false` (no hay nada
-- que revelar todavía).

alter table public.api_creditos
  add column if not exists revelable boolean not null default false;

-- Se marca lo que ya estaba en el Set previo, para no romper la pantalla
-- entre que se aplica esta migración y se despliega la nueva edge function.
update public.api_creditos
   set revelable = true
 where proveedor in ('kie', 'anthropic', 'blotato');
