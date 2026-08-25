# (codex) Bárbara · avance autónomo intensivo · 25-ago-2026
(codex) Objetivo ejecutado: auditar, construir, probar y dejar commits locales; no se hizo push, deploy, publicación social ni cambio de secretos.
(codex) Estado de verificación: 176 pruebas Node aprobadas, TypeScript limpio, ESLint limpio en los componentes tocados y build directo de Vite exitoso.
(codex) Memoria privada: recuperación contextual por relevancia, prioridad, refuerzo, recencia y grafo; versionado inmutable; propuestas; conflictos; ledger; edición y aprobación por RPC con RLS por dueño.
(codex) Chat: las conversaciones alimentan candidatos de memoria sin consumir correcciones; secretos, datos temporales, inferencias y cambios de alto impacto quedan bloqueados o pendientes de aprobación.
(codex) Biblioteca: assets persistidos en bucket privado con SHA-256, rollback de huérfanos, URLs firmadas y explicación auditable de por qué se tomó cada decisión creativa.
(codex) Calendario: programación futura en zona horaria del cliente, reprogramación/confirmación/cancelación segura, historial, colisiones y estados reales visibles en el portal.
(codex) Publicación: claim atómico, recuperación de jobs colgados, backoff, confirmación estricta del proveedor y reutilización del submission ante timeout para no duplicar posts.
(codex) Aprendizaje global: sólo contrastes estructurales agregados multi-marca, huella idempotente, aprobación manual y patrones filtrados por tipo/contexto.
(codex) Métricas: se agregó ingesta HMAC agnóstica de proveedor, snapshots agregados sin audiencia ni comentarios, hitos idempotentes, outbox Telegram con retry y vista real de alcance/interacciones en el portal.
(codex) Algoritmo de rendimiento: mezcla aprobación con percentil social calculado dentro de la misma marca y formato; una cuenta grande no domina por alcance bruto y menos de tres piezas comparables no inventan señal.
(codex) Restricción confirmada: Blotato publica y confirma estados, pero su API no entrega analítica; el recolector futuro debe usar Meta/TikTok oficiales, Metricool o un importador autorizado contra `barbara-metricas`.
(codex) Migraciones aplicadas por Claude durante la sesión: prompts/credenciales, programación/media y cerebro versionado. No las volvió a aplicar Codex.
(codex) Migraciones todavía pendientes antes de activar todo: `20260825_barbara_media_storage_policies.sql`, `20260825_barbara_calendario_seguro.sql`, `20260825_barbara_publicacion_state_machine.sql`, `20260825_barbara_patrones_evidencia.sql`, `20260825_barbara_decisiones.sql` y `20260825_barbara_metricas_reales.sql`.
(codex) Funciones pendientes de despliegue controlado: actualización de `barbara-chat`, `barbara-aprender-chat` y `barbara-metricas`; esta última se despliega sin verificación JWT sólo porque exige HMAC-SHA256 propio con timestamp de cinco minutos.
(codex) Orden de activación recomendado: backup y aplicar migraciones en secuencia; desplegar funciones; configurar canales con `auto_publicar=false`; ejecutar canary interno de Cóndor; validar assets/calendario/chat/métricas; recién después habilitar una red y un cliente.
(codex) Commits locales de esta fase: `68c4589`, `39b7d7c`, `4cf7e92`, `7b26e2f`, `7962a30`, `7dc05d2`, `a159727`, `4322a8e`, `408718f`, `5b9de6c`, `7e3f79d`, `b2ed5b2`, `017d23e`; se apoyan en `105f3a2`, `fe1282b`, `bb24e14`, `e326dda` y `748234c`.
(codex) Había y aparecieron cambios concurrentes ajenos en HTML público y archivos de saludo/transición del portal; Codex no los añadió a sus commits, no los revirtió y los dejó intactos.
(codex) Próximo bloque de máximo valor: canary de punta a punta con datos internos, colector oficial de métricas por red, ledger real de consumo/costo por pieza y health checks operativos con alertas deduplicadas.
