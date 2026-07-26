# Tareas — Alejandro · Infra + automatización + integraciones

> Contexto completo del proyecto en **`PROYECTO.md`** · Deck: **https://condor-deck.vercel.app**

## Contexto rápido
Campaña Meta Ads en Colombia para vender páginas web de Cóndor.ai. Los leads entran por la landing (form → `POST /leads` de Samuel). Tú eres el dueño de **dónde vive todo (infra/DB/deploy)** y de las **automatizaciones que convierten al lead en cliente**: recordatorios de reunión, tracking y cobro.

## Tu rol
Infra + plomería del proyecto. Sin tu capa, los leads se guardan pero nadie los recontacta y no medimos nada.

## Tus tareas

### A. Base de datos e infra
- [ ] Definir el **schema de leads/reuniones** (coordina con Samuel el contrato de `POST /leads`). Tablas: `leads`, `reuniones`, y log de `mensajes_enviados`.
- [ ] Deploy: landing en **Vercel**, backend donde corresponda (Render/Vercel functions — tú decides). Variables de entorno, dominios, CORS.
- [ ] Tú confirmas el **stack definitivo**; el resto se alinea a lo que definas.

### B. Automatización (email + WhatsApp) — el diferenciador anti no-show
- [ ] **Email vía Resend:** confirmación al agendar + **recordatorio 24 h antes** + **1 h antes** + secuencia de recuperación si no asiste. Plantillas (tarea compartida).
- [ ] **WhatsApp vía Cloud API:** mismos recordatorios (24 h / 1 h) — es el canal que sí se lee en Colombia.
- [ ] Disparador: escuchar el **evento de "lead nuevo"** que emite el backend de Samuel y encolar los envíos según `tipo` y `fecha_hora`.

### C. Pago
- [ ] Integrar el **link de MercadoPago** existente en el flujo (post-reunión). Registrar el estado de pago contra el lead/cliente.

### D. Tracking
- [ ] **Meta Pixel + CAPI**: eventos de la landing (view, submit reunión, submit contacto) para optimizar la campaña. Coordina el Pixel con Joaquín.
- [ ] Deduplicar eventos pixel/CAPI (event_id).

### E. CRM / métricas (apoyo)
- [ ] Vista/panel simple de leads y estado del funnel (con los endpoints de Samuel), para el reporte a inversionistas.

## Orden / dependencias
1. **Schema + deploy + envs** primero (desbloquea a Samuel y a Joaquín).
2. Automatización engancha al evento de lead de Samuel.
3. Pixel/CAPI cuando la landing exista.

## Definición de listo
Todo desplegado con dominios/envs; un lead nuevo dispara automáticamente email + WhatsApp; el pixel/CAPI reporta a Meta; el pago por MercadoPago queda registrado.
