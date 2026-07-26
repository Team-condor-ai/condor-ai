# Tareas — Samuel · Backend / programación

> Contexto completo del proyecto en **`PROYECTO.md`** · Deck: **https://condor-deck.vercel.app**

## Contexto rápido
Campaña Meta Ads en Colombia para vender páginas web de Cóndor.ai. La landing captura leads de dos formas: **agendar reunión** o **pedir contacto**. Tú construyes el **backend que recibe, valida y guarda esos leads** y la lógica de agendamiento. Es la pieza que conecta la landing con la base de datos y con las automatizaciones de Ale.

## Tu rol
Dueño del backend de leads y del agendamiento. Tu API es el punto por donde entra TODO el valor de la campaña.

## Tus tareas

### A. API de leads
- [ ] `POST /leads`: recibe el payload de los formularios de la landing. Define el contrato **con Joaquín** (quien hace el form). Campos mínimos:
  - `tipo`: `"reunion"` | `"contacto"`
  - `nombre`, `whatsapp`, `correo`
  - `fecha_hora` (solo si `tipo=reunion`), `origen`/UTM, `creativo` (para atribución)
- [ ] Validación (correo válido, WhatsApp normalizado a formato internacional), anti-spam básico (honeypot / rate limit), y respuesta clara para que el front muestre éxito/error.
- [ ] Guardar en la tabla de leads (schema lo define **Ale** — coordina). Idempotencia razonable (no duplicar por doble submit).
- [ ] Al crear un lead, **disparar el evento** que gatilla la automatización de Ale (webhook/cola/insert que él escuche). Acuerden el mecanismo.

### B. Agendamiento
- [ ] Lógica de reuniones: horario **8:00–21:00 hora Colombia**, duración **máx 1 h**, evitar choques/dobles reservas.
- [ ] Si usan **Calendly**: integrar su webhook para registrar la reunión como lead `tipo=reunion` y capturar fecha/hora. Si es custom: endpoints de disponibilidad + reserva.

### C. Endpoints de apoyo (CRM / métricas)
- [ ] `GET /leads` con filtros (tipo, estado, fecha) para el panel interno.
- [ ] Estados del lead: `nuevo` → `contactado` → `reunion_agendada` → `asistio` → `cerrado`/`perdido`.

## Orden / dependencias
1. Acordar **schema de la tabla con Ale** y **contrato del form con Joaquín** (hazlo primero, desbloquea a ambos).
2. `POST /leads` funcionando → Joaquín puede conectar la landing y Ale puede enganchar la automatización.

## Definición de listo
`POST /leads` recibe, valida y persiste; el agendamiento registra reuniones sin choques; cada lead nuevo emite el evento para la automatización.
