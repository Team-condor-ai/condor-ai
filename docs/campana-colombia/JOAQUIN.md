# Tareas — Joaquín · Landing base + Campaña Ads + Ventas

> Contexto completo del proyecto en **`PROYECTO.md`** · Deck: **https://condor-deck.vercel.app**

## Contexto rápido
Campaña Meta Ads en Colombia (financiada por Pía y Franco) para vender páginas y plataformas web de Cóndor.ai. El anuncio lleva a una landing corta cuyo único objetivo es **agendar reunión** o **pedir contacto**. Tú levantas la **base de la landing**, montas la **campaña** y lideras las **reuniones de venta**.

## Tu rol
Dueño del arranque: primero existe una landing funcional y una campaña al aire; sobre eso Max rediseña y el resto conecta backend/infra.

## Tus tareas

### A. Landing base (primero — desbloquea a Max)
- [ ] Estructura de la landing en el repo del portal Cóndor: hero breve, prueba social (reseñas + portafolio), los **dos CTAs** con sus formularios (aparecen al hacer clic).
- [ ] Form **"Agendemos una reunión"**: Nombre + WhatsApp + Correo + agendamiento (Calendly embebido, horario **8:00–21:00 COL**, reunión máx 1 h).
- [ ] Form **"Quiero que me contacten"**: Nombre + Correo + WhatsApp (promesa < 24 h).
- [ ] Ambos formularios postean a `POST /leads` (endpoint que hace Samuel — coordina el contrato del payload con él).
- [ ] Copy en español colombiano, foco en confianza y velocidad (entrega desde 48 h). Deja **slot para la foto IA del equipo** (ver B).
- [ ] Entregar la base a Max con una nota de qué está "listo" y qué queda para su rediseño.

### B. Creativos (coordinación)
- [ ] Generar/rebrandear los que faltan: 3 imágenes + **rebrandear el creativo morado** (mitusitio.com) + **2 videos**.
- [ ] Generar la **foto IA del equipo** en oficina corporativa para la landing.

### C. Campaña Meta Ads
- [x] **Pixel + CAPI instalados en la landing** (código listo, ver "Lo que falta para lanzar").
- [ ] Cuenta/Business Manager + sacar el **PIXEL_ID** y el token de CAPI.
- [ ] Estructura de campaña: públicos **solo Colombia**, ubicaciones, objetivo (leads/mensajes).
- [ ] Cargar los 7 creativos. Presupuesto test **~$10.000/día × 7 días** (confirmar moneda de la cuenta).
- [ ] **Día 8:** pausar los 2 peores, +20% al ganador. Documentar CPL.
- [ ] Reporte simple de gasto/resultados para los inversionistas.

### D. Ventas
- [ ] Guion de reunión (máx 1 h) + propuesta con los precios nuevos (Landing $6/mes, Web $18/mes).
- [ ] Cerrar con **link de MercadoPago**. Reuniones junto a Max.

## Orden / dependencias
1. Landing base (A) → habilita a Max y a Samuel (contrato del form).
2. Pixel (C) depende de que la landing exista; CAPI lo cierra Ale.
3. Campaña arranca cuando landing + tracking + creativos estén listos.

## Definición de listo
Landing base desplegada y capturando leads reales (form → `/leads` → DB), pixel disparando, campaña configurada lista para lanzar.

---

## Lo que falta para lanzar (bloqueado en tus cuentas)

La landing `/colombia` está **lista en código**: diseño, formularios, envío del lead y
tracking (Pixel + CAPI con deduplicación, eventos `PageView` / `ViewContent` / `Schedule` /
`Lead`). Lo único que falta son **dos valores** que solo salen de tus cuentas. Sin ellos la
landing funciona, pero **no guarda leads y no reporta conversiones**.

Ambos son variables de entorno del proyecto **web-v2 en Vercel** (ver `apps/web-v2/.env.example`).
Después de cargarlas hay que **redesplegar**: Vite las hornea en el bundle en tiempo de build.

| Variable | De dónde sale | Sin ella |
|---|---|---|
| `VITE_LEADS_API` | Google Sheets + Apps Script. Receta paso a paso arriba de `Code.gs` (5 min, tu cuenta de Google). Es la URL que termina en `/exec`. | El formulario **muestra error** y ofrece WhatsApp. Es a propósito: antes fingía éxito y el lead se perdía en silencio. |
| `VITE_META_PIXEL_ID` | Business Manager → Eventos → tu Pixel. | No se carga el Pixel: la campaña queda **sin optimización ni atribución**. |

Y para que el evento llegue también por servidor (≈ la mitad de los móviles bloquea el Pixel),
Ale necesita `META_PIXEL_ID` + `META_CAPI_TOKEN` como secrets de Supabase y desplegar la función
`capi` (`ALEJANDRO-ENTREGA.md` §3). Si eso no está, el Pixel del navegador sigue funcionando solo.

**Cómo probar que quedó bien**, una vez cargadas:
1. Entra a `condorai.cl/colombia?utm_campaign=prueba` y manda el formulario con tus datos.
2. Tiene que aparecer una fila nueva en la hoja "Leads", con la campaña y la URL.
3. Meta Events Manager → *Probar eventos*: `PageView`, `ViewContent` y `Schedule`/`Lead`.
