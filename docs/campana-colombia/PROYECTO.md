# Cóndor.ai × Colombia — Campaña + Landings

> Brief maestro del proyecto. Léelo completo antes de tocar tu parte.
> Presentación visual del modelo: **https://condor-deck.vercel.app**

---

## 1. Qué es

Encendemos una campaña de **Meta Ads en Colombia** para vender **landing pages, sitios web y plataformas a medida** de Cóndor.ai. La financian dos inversionistas (**Pía y Franco**); nosotros ponemos producto, diseño, código y ventas.

El anuncio lleva a una **landing corta con un solo objetivo**: que el lead **agende una reunión** o **pida que lo contactemos**. Después, email + WhatsApp automáticos lo acompañan hasta la reunión para bajar la inasistencia y cerrar más.

## 2. Inversionistas y trato

- **Inversión:** $270.000 CLP → **$250.000 campaña** + **$20.000 Claude (IA)**.
- **Utilidad por venta:** Inversionistas **60%** / Cóndor.ai **40%**.
- **Mensualidad recurrente:** Cóndor.ai **70%** / Inversionistas **30%**.
- Pago único = les devuelve la inversión. Mensualidad = nuestro ingreso recurrente.

## 3. La campaña (Meta Ads)

- **Solo Colombia.** 7 creativos: **5 imágenes + 2 videos** (2 videos pendientes).
- **Fase test (días 1–7):** todos los creativos al aire, ~$10.000/día (moneda a confirmar).
- **Día 8:** pausar los 2 peores, +20% al ganador.
- **Escala:** repetir el ciclo cada 3–4 días si el CPL se mantiene; duplicar ganadores en públicos nuevos.
- **Pago del cliente:** link de **MercadoPago** que ya tenemos.

## 4. La landing (CTA) — spec

Dominio Cóndor (ej. `condorai.cl/colombia`). Corta, confiable, un solo objetivo.
- Hero breve + **foto IA del equipo** en oficina corporativa (pendiente de generar).
- **Reseñas** (★★★★★) + **portafolio/clientes** (para confianza).
- **Dos botones** (los formularios sólo aparecen al hacer clic; la landing arranca limpia):
  1. **"Agendemos una reunión"** (botón grande) → form **Nombre + WhatsApp + Correo** + calendario **8:00–21:00 hora Colombia**, reunión de **máx 1 hora**.
  2. **"Quiero que me contacten"** → form **Nombre + Correo + WhatsApp** → contacto en **< 24 h**.
- Ambos leads entran a **seguimiento** (email + WhatsApp).

## 5. Seguimiento (anti no-show)

Lead agenda → **recordatorio 24 h antes** (email + WhatsApp) → **recordatorio 1 h antes** → reunión (máx 1 h) → cierre. Si no asiste: secuencia de recuperación para reagendar.

## 6. Precios (propuesta con mensualidad baja)

| Plan | Pago único | Mensualidad |
|---|---|---|
| Landing Express | $400.000 COP | **USD $6/mes** (~$24.000 COP) |
| Web Profesional (más elegido) | $1.250.000 COP | **USD $18/mes** (~$72.000 COP) |
| Plataforma a Medida | desde $2.200.000 COP | a cotizar |

Toda mensualidad incluye **hosting + soporte 24/7 + cambios ligeros** (según T&C).

## 7. Stack propuesto (Ale confirma el definitivo)

- **Landing / frontend:** en el **repo del portal Cóndor**, deploy en Vercel.
- **Backend de leads:** endpoint que recibe el form → guarda en base de datos (Supabase).
- **Agendamiento:** Calendly embebido (rápido) o custom.
- **Automatización:** email vía **Resend** + WhatsApp vía **Cloud API**.
- **Pago:** link **MercadoPago** existente.
- **Tracking:** **Meta Pixel + CAPI**.

> Ale es el dueño de las decisiones de infra/hosting/DB. Si tu tarea depende del stack, confírmalo con él antes de casarte con una librería.

## 8. División de trabajo

| Persona | Foco | Archivo |
|---|---|---|
| **Joaquín** | Landing base + Campaña Ads + Ventas | `JOAQUIN.md` |
| **Max** | Rediseño frontend + diseño | `MAX.md` |
| **Samuel** | Backend / programación | `SAMUEL.md` |
| **Ale** | Infra + automatización + integraciones | `ALEJANDRO.md` |

**Tareas compartidas:** T&C del cliente · CRM de leads · panel de métricas de campaña · plantillas email/WhatsApp · config Calendly · reporte a inversionistas.

## 9. Flujo de datos (de punta a punta)

```
Anuncio (Meta) → Landing → [Agendar | Contactar]
   → POST /leads (backend, Samuel) → DB leads (Ale)
   → automatización email + WhatsApp (Ale)
   → reunión (Joaquín + Max) → venta → link MercadoPago
   → cliente recurrente (mensualidad)
```

## 10. Convenciones

- **Marca:** navy profundo, azul royal (el `.ai`), verde esmeralda (CTA), rojo cóndor (acento puntual). Tipografía **San Francisco** (system stack). Logo oficial de Cóndor.ai.
- **Repo:** portal Cóndor. Trabaja en **tu rama** (`feat/<tu-nombre>-<tema>`), PR para revisar antes de mergear. No pushees directo a `main`.
- **Cómo trabajar con tu Claude:** abre tu archivo (`TUNOMBRE.md`) — tiene el contexto + tus tareas. Pídele que las ejecute una por una.
- Dudas de alcance/negocio → Joaquín. Dudas de infra/DB/deploy → Ale.
