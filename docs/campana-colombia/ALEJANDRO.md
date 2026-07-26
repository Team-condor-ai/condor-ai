# Tareas — Alejandro · Infra + automatización + integraciones

> Contexto completo del proyecto en **`PROYECTO.md`** · Deck: **https://condor-deck.vercel.app**
>
> **Estado:** el código está listo en la rama `feat/alejandro-infra-campana` —
> ver [`ALEJANDRO-ENTREGA.md`](ALEJANDRO-ENTREGA.md) (stack, contrato `POST /leads`, secrets y despliegue).
> Marcado `[x]` = implementado; falta aplicarlo en producción (migración + deploys + plantillas de WhatsApp).

## Contexto rápido
Campaña Meta Ads en Colombia para vender páginas web de Cóndor.ai. Los leads entran por la landing (form → `POST /leads` de Samuel). Tú eres el dueño de **dónde vive todo (infra/DB/deploy)** y de las **automatizaciones que convierten al lead en cliente**: recordatorios de reunión, tracking y cobro.

## Tu rol
Infra + plomería del proyecto. Sin tu capa, los leads se guardan pero nadie los recontacta y no medimos nada.

## Tus tareas

### A. Base de datos e infra
- [x] Definir el **schema de leads/reuniones** (coordina con Samuel el contrato de `POST /leads`). Tablas: `leads`, `reuniones`, y log de `mensajes_enviados`. → `supabase/migrations/campana_colombia.sql` (el log quedó como `mensajes_programados`: es cola y log a la vez) + contrato documentado para Samuel.
- [ ] Deploy: landing en **Vercel**, backend donde corresponda (Render/Vercel functions — tú decides). Variables de entorno, dominios, CORS. → *config y pasos escritos; falta ejecutarlo en las consolas.*
- [x] Tú confirmas el **stack definitivo**; el resto se alinea a lo que definas. → Supabase + Edge Functions + GitHub Actions + Vercel (sin piezas nuevas).

### B. Automatización (email + WhatsApp) — el diferenciador anti no-show
- [x] **Email vía Resend:** confirmación al agendar + **recordatorio 24 h antes** + **1 h antes** + secuencia de recuperación si no asiste. Plantillas (tarea compartida). → `services/seguimiento/`
- [x] **WhatsApp vía Cloud API:** mismos recordatorios (24 h / 1 h) — es el canal que sí se lee en Colombia. → mismo worker; falta crear y aprobar las plantillas en Meta.
- [x] Disparador: escuchar el **evento de "lead nuevo"** que emite el backend de Samuel y encolar los envíos según `tipo` y `fecha_hora`. → triggers en la BD: Samuel solo hace el INSERT, no tiene que llamar a nada.

### C. Pago
- [x] Integrar el **link de MercadoPago** existente en el flujo (post-reunión). Registrar el estado de pago contra el lead/cliente. → `supabase/functions/pago-lead` + `mp-webhook` registra `lead:<id>`.

### D. Tracking
- [x] **Meta Pixel + CAPI**: eventos de la landing (view, submit reunión, submit contacto) para optimizar la campaña. Coordina el Pixel con Joaquín. → `supabase/functions/capi` + `condor-tracking.js`; falta el PIXEL_ID/token de Joaquín.
- [x] Deduplicar eventos pixel/CAPI (event_id). → mismo `event_id` en navegador y servidor.

### E. CRM / métricas (apoyo)
- [ ] Vista/panel simple de leads y estado del funnel (con los endpoints de Samuel), para el reporte a inversionistas.

## Orden / dependencias
1. **Schema + deploy + envs** primero (desbloquea a Samuel y a Joaquín).
2. Automatización engancha al evento de lead de Samuel.
3. Pixel/CAPI cuando la landing exista.

## Definición de listo
Todo desplegado con dominios/envs; un lead nuevo dispara automáticamente email + WhatsApp; el pixel/CAPI reporta a Meta; el pago por MercadoPago queda registrado.
