# Evidencia para el plan de producto de Cóndor

Revisión realizada el 21 de agosto de 2026.

## Estado observado en el repositorio

- El portal ya contiene clientes, cobros, productos asignables, contabilidad de doble partida, desglose de egresos, sincronización de Meta Ads, calendario, tareas, metas, email marketing, biblioteca, agentes y mapa.
- No aparecen módulos funcionales para oportunidades/pipeline, tickets con SLA, horas/capacidad, movimientos bancarios y conciliación, emisión DTE ante el SII, presupuesto contra real, cierre contable por período ni una matriz completa de roles y permisos.
- Archivos revisados: `apps/web-v2/src/portal/Portal.tsx`, `apps/web-v2/src/portal/disenio/Lateral.tsx`, `apps/web-v2/src/portal/staff/Dashboard.tsx`, `apps/web-v2/src/portal/staff/contabilidad/`, `supabase/migrations/`, `services/` y `.github/workflows/`.

## Patrones comerciales contrastados en documentación oficial

- SII — Factura electrónica y DTE: https://www.sii.cl/destacados/factura_electronica/index.html
- SII — Documentación técnica de factura electrónica: https://www.sii.cl/factura_electronica/tecnica.htm
- Fintoc — API para movimientos de cuentas bancarias: https://docs.fintoc.com/v2023-11-15/reference/movements-list
- QuickBooks — Conciliación de cuentas: https://quickbooks.intuit.com/learn-support/en-us/help-article/statement-reconciliation/reconcile-account-quickbooks-online/L3XzsllsK_US_en_US
- HubSpot — Forecast por pipeline y categorías de cierre: https://knowledge.hubspot.com/forecast/set-up-the-forecast-tool
- Harvest — Rentabilidad por cliente, proyecto, equipo y tarea: https://support.getharvest.com/hc/en-us/articles/25342727197581-Profitability-report
- Float — Capacidad, disponibilidad y asignación del equipo: https://support.float.com/en/articles/13847946-capacity-planning-and-resource-scheduling
- Zendesk — Tickets y políticas SLA: https://support.zendesk.com/hc/en-us/articles/5600997516058-About-SLA-policies-and-how-they-work
- Supabase — RLS y acceso por fila: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase — Roles y permisos con custom claims: https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac

## Límite de la evidencia

No se dispuso de entrevistas, analítica de uso, tiempos del equipo ni costos de desarrollo. La prioridad propuesta combina dependencia operativa, riesgo financiero y continuidad del flujo comercial; debe recalibrarse con esos datos antes de comprometer fechas.

## Mapa de visualización

- Segmento: priorización. Pregunta: cómo se distribuyen las herramientas propuestas entre capas de prioridad. Forma: barras verticales. Campos: prioridad y cantidad de módulos. Tres categorías exactas, sin inferir impacto ni esfuerzo. Paleta: una raíz azul, sin leyenda redundante. Entrega: informe HTML portable.
