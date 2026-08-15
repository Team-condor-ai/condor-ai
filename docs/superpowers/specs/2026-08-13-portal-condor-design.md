# Portal Cóndor · diseño

**13-ago-2026.** Portal único en `condorai.cl`, con el look de Planeta Track.
Una sola puerta de entrada; el rol lo decide el correo.

---

## Qué se construye

Reemplazar `portal.html` y `admin.html` —dos páginas HTML sueltas de ~18 KB
cada una— por **una sola aplicación** que sirve a las dos audiencias:

- **Staff de Cóndor**: gestiona clientes, cobros, documentos y correos.
- **Clientes**: administran su suscripción, ven sus boletas y sus datos.

Se entra por el botón **"Acceso clientes"** que ya está en el menú de
`condorai.cl`. Después del login, el correo decide qué se ve. El cliente nunca
sabe que existe un área de staff; el staff no cambia de URL.

## Por qué una sola puerta y no dos

La alternativa era un selector *"¿Quién entra?"* como el del ERP de Planeta.
No sirve acá: ese selector **lista a las personas**, y para clientes externos
eso filtra la cartera completa a cualquiera que abra la página.

La detección por correo ya existe en la base y está probada:

```sql
create or replace function public.es_admin() returns boolean
  language sql security definer stable as $$
  select exists (select 1 from public.admins where email = (auth.jwt() ->> 'email'));
$$;
```

Y las políticas RLS ya separan las dos vistas: `admin_all_clientes` da acceso
total al staff, `cliente_ve_lo_suyo` limita al cliente a su propia fila.

> **Consecuencia de seguridad que hay que respetar:** el rol se resuelve en la
> base, no en el navegador. El front puede *ocultar* el menú de staff, pero lo
> que protege los datos es RLS. Nunca confiar en una bandera de JavaScript
> para decidir qué se muestra de la base.

---

## Dónde vive

> ⚠️ **Se construyó primero en el repo equivocado.** `condor-ai-web` tiene un
> `CNAME` en el historial y parecía servir el dominio. No lo sirve:
>
> | repo | cname en Pages | sirve |
> |---|---|---|
> | `condor-ai-web` | `null` | `joaquinmunozs.github.io/condor-ai-web/` |
> | **`condor-ai`** | **`condorai.cl`** | **el dominio** |
>
> Lo delató la fecha: `portal.html` en el dominio decía `Last-Modified`
> 11-ago, y el último deploy de `condor-ai-web` fue el 20-jun.

`condorai.cl` lo publica el workflow `deploy-web.yml` del monorepo, que
construye **`apps/web-v2`** con Vite y sube `dist` a Pages. El portal vive
**dentro de esa app**, montado en la ruta `/portal`:

```
apps/web-v2/src/
  main.tsx              ← ruta "portal/*" añadida
  portal/
    Portal.tsx          menú, rol y rutas internas
    auth/  disenio/  staff/  cliente/  lib/
```

### Stack

El de `apps/web-v2`, que ya existía: React 19 + Vite + TypeScript +
react-router + GSAP. No se agregó nada salvo `@supabase/supabase-js`.

### El CSS del ERP hubo que aislarlo

`estilo.css` define `body`, `svg` y `button` **globales** — en el ERP eso está
bien, porque el ERP es la página entera. Acá comparte bundle con el sitio
público, y el CSS del portal se concatena después: verificado en el build,
`body{background:var(--fondo)}` quedaba en la posición 32720 y el del sitio en
la 1159, así que **el portal le pisaba el fondo y la tipografía a la home**.

Dos medidas:

1. Esas tres reglas cuelgan de **`.portal-app`**, el div que envuelve al
   portal. Es el único cambio respecto al original; el resto del archivo es
   idéntico.
2. El portal se carga con **`lazy()`**, así Vite deja su CSS en un chunk
   aparte que la home no descarga. El bundle del sitio bajó de 65,4 kB a
   30,9 kB.

**El CSS del ERP se copia tal cual.** `estilo.css` y `piezas.css` son CSS
plano con variables (`--fondo`, `--texto`, `--borde`…): se importan sin tocar
una línea. Lo único que se reescribe es el markup (HTML→JSX) y la lógica.
Copiar en vez de recrear es lo que garantiza que se vea idéntico y no
"parecido".

---

## Diseño visual

Todo sale del sistema del ERP, sin inventar nada:

| | |
|---|---|
| Tipografía | `-apple-system, BlinkMacSystemFont, "SF Pro Text"` — San Francisco en Mac, system-ui en el resto |
| Base | 13.5 px, `letter-spacing:-.005em`, antialiased |
| Lateral | 220 px, fijo a la izquierda, `--lateral` |
| Radios | 9 px (botones, items), 14 px (lienzo) |
| Tema | claro y oscuro automáticos, ya resueltos con `prefers-color-scheme` |

### Iconos: SVG, no SF Symbols

Se pidieron "símbolos de iPhone, no emojis". **Los SF Symbols de Apple no se
pueden redistribuir en una web** — la licencia lo prohíbe expresamente.

El ERP ya resuelve esto y se sigue su camino: SVG inline, trazo 1.7 px,
`stroke-linecap:round`, 24×24 de viewBox. Es el mismo lenguaje visual, se ve
idéntico, y es legal. Todos los iconos viven en un solo módulo (`iconos.tsx`)
para que no se dupliquen sueltos por el código.

### Animación del menú lateral

Se pidió explícitamente. Tres capas, con GSAP:

1. **Al entrar**: los items del menú aparecen escalonados, 30 ms entre uno y
   otro, con un desplazamiento corto desde la izquierda.
2. **Hover**: el fondo entra en 120 ms; el icono se desplaza 1 px.
3. **Activo**: un indicador se *desliza* entre items en vez de saltar
   (`FLIP`), que es lo que da la sensación de continuidad de iOS.

> `@media(prefers-reduced-motion:reduce)` ya está en el CSS del ERP y apaga
> todas las transiciones. Las animaciones nuevas tienen que respetarlo — quien
> pidió menos movimiento en su sistema operativo lo pidió en serio.

---

## Arquitectura

```
portal-src/src/
  main.tsx              arranque + router
  auth/
    sesion.ts           login OTP + contraseña (reusa lo que ya funciona)
    rol.ts              es_admin() → "staff" | "cliente"
  disenio/
    estilo.css          ← copiado del ERP, sin tocar
    piezas.css          ← copiado del ERP, sin tocar
    iconos.tsx          SVG inline, uno por concepto
    Lateral.tsx         menú de 220px + animaciones
    Lienzo.tsx          panel, barra y cuerpo
  staff/
    Clientes.tsx        lista + alta + edición
    FichaCliente.tsx    ficha detallada
  cliente/
    MiPlan.tsx          suscripción y qué incluye
  lib/
    supabase.ts         cliente único
```

Cada archivo con un propósito. Cuando `Clientes.tsx` crezca de más, se parte
—es la señal de que hace dos cosas.

### Flujo de entrada

```
condorai.cl → "Acceso clientes" → /portal/
                                     │
                              ¿hay sesión?
                            no │        │ sí
                               ▼        ▼
                          Login      es_admin()
                        (OTP+clave)   │       │
                                 staff│       │cliente
                                      ▼       ▼
                              /staff/…   /mi/…
```

El login **no cambia**: la Edge Function `solicitar-acceso` ya cierra el
agujero por el que entró un correo ajeno (caso Max), tiene rate limit de
5/15 min y responde genérico para no filtrar quién es cliente. Se reusa
completa; no se toca.

---

## Alcance de esta primera entrega

Esta spec cubre **Fundación + Staff·clientes**. Lo demás va en specs propias:

| # | Sub-proyecto | Estado |
|---|---|---|
| **0** | **Fundación** — app, CSS, iconos, layout, auth, router por rol | **esta spec** |
| **1** | **Staff · clientes** — CRUD, ficha detallada | **esta spec** |
| 2 | Motor de documentos — cotización, contrato, T&C | siguiente |
| 3 | Cobros MercadoPago — links, webhook, boletas | |
| 4 | Portal cliente — suscripción, boletas, config, baja | |
| 5 | Correos masivos | |
| 6 | Grafo 3D tipo Obsidian | |

### 0 · Fundación

- App Vite que compila a `condor-ai-web/portal/`
- CSS del ERP copiado; tema claro/oscuro heredado
- `iconos.tsx` con el set inicial
- `Lateral.tsx`: 220 px, logo Cóndor, buscador, menú animado, tarjeta de
  usuario abajo
- Login OTP + contraseña reusando `solicitar-acceso`
- Router que manda a `/staff` o `/mi` según `es_admin()`

### 1 · Staff · clientes

- **Lista**: tabla con negocio, plan, montos, estado de cobro y próximo cobro.
  Buscador y chips de filtro (al día / pendiente / vencido / archivado).
- **Alta y edición**: negocio, correo, plan, concepto (qué incluye), montos de
  setup y mensualidad, moneda, próximo cobro, links de pago, web entregada.
- **Ficha detallada**: datos, historial de pagos, servicio contratado, estados
  y notas.
- **Archivar** en vez de borrar. La columna `archivado` ya existe: un cliente
  que se va es historia, no basura — y borrarlo se lleva sus pagos por
  `on delete cascade`.

### Qué NO entra ahora

Cobros, documentos, correos y grafo. Están diseñados en la descomposición
pero no se construyen todavía: cada uno depende de que este piso exista.

---

## Datos

Las tablas ya existen (`portal_schema.sql`, `portal_admin.sql`) y **no se
migran**: `clientes`, `pagos`, `admins`.

Columnas de `clientes` que la ficha usa: `email`, `negocio`, `plan`,
`concepto`, `setup_monto`, `mensual_monto`, `moneda`, `setup_estado`,
`mensual_estado`, `proximo_cobro`, `link_setup`, `link_mensual`,
`link_paypal`, `web_url`, `archivado`, `creado_en`.

Falta una sola cosa para lo que se pidió del portal cliente (fase 4): un campo
de **teléfono**. Se agrega en su spec, no acá.

---

## Errores

- **Sin sesión** → login, sin mensaje de error (no es un fallo).
- **Correo que no está en `admins` ni en `clientes`** → mensaje genérico. No
  se dice si el correo existe: eso es enumeración de clientes.
- **Falla de red** → se muestra el error real de Supabase, no "algo salió
  mal". Un mensaje vago obliga a abrir la consola para trabajar.
- **RLS rechaza** → se trata como "no tienes acceso", no como error técnico.

---

## Verificación

No hay suite de tests en `condor-ai-web`. Lo que se verifica antes de cambiar
el enlace del menú:

1. `npm run build` compila sin errores de TypeScript.
2. Un correo de `admins` entra y ve la lista completa de clientes.
3. Un correo de `clientes` entra y **no** ve el área de staff.
4. Un correo que no está en ninguna tabla recibe el mensaje genérico.
5. Crear, editar y archivar un cliente funciona contra la base real.
6. El portal se ve correcto en claro y en oscuro.
7. Con "reducir movimiento" activo, el menú no anima.

El punto 3 es el que importa: hay que comprobarlo **con un correo de cliente
de verdad**, no asumiendo que el front oculta bien el menú.
