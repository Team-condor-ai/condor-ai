# (codex) Bárbara · avance autónomo · bloque 2 · 25-ago-2026
(codex) Alcance: auditoría, implementación y pruebas locales. No se hizo push, despliegue, publicación social ni rotación de secretos.
(codex) Recuperación privada: la bonificación de recencia ahora cae a cero en 28 días y el presupuesto de contexto reserva diversidad mínima entre perfil, dato/gusto contextual y regla; muchas reglas cortas ya no expulsan la identidad de la marca.
(codex) Entrega confiable: generación y Telegram quedaron desacoplados mediante outbox persistente; el worker reclama de forma atómica, verifica tamaño y SHA-256, agrupa carruseles, guarda checkpoint de IDs y reintenta sólo el caption si los medios ya salieron.
(codex) Persistencia de medios: un fallo en cualquier slide compensa el lote completo para no dejar carruseles parciales; una generación incompleta se repara en la siguiente corrida sin volver a pagar la generación.
(codex) Idempotencia de generación: una tabla y RPC de claim impiden que cron, ejecución manual y webhook paguen la misma pieza simultáneamente; los claims colgados se recuperan y la fecha lógica usa la zona horaria del cliente.
(codex) Salud operativa: auditor determinista detecta publicaciones incoherentes, entregas agotadas, generaciones colgadas, canales inválidos, decisiones ausentes, patrones débiles, propuestas antiguas y colisiones; las alertas se deduplican y recuerdan con cadencia según severidad.
(codex) Consumo y presupuesto: telemetría central registra tokens Anthropic, cache, imágenes, segundos de video, proveedor/modelo y fallos sin guardar prompts; presupuestos por cliente operan en modo observar o bloquear con unidades reales, sin inventar precios.
(codex) Portal: análisis muestra el consumo mensual real en tokens, cache, imágenes, video, intentos y fallos.
(codex) Cerebro Obsidian: se puede exportar cada nodo privado a Markdown con frontmatter, `name:`, versión, hash, índice `MEMORY.md` y `[[wikilinks]]`; títulos iguales conservan identidad estable.
(codex) Importación Obsidian: el modo normal sólo valida; `--aplicar` crea propuestas auditables y nunca pisa nodos directamente. Si la versión cambió, crea conflicto para resolución humana.
(codex) Verificación durante el bloque: la suite llegó a 197 pruebas Node aprobadas antes del puente Obsidian; las 4 pruebas específicas del puente también aprobaron. TypeScript y ESLint aprobaron para el portal de análisis antes del último commit.
(codex) Commits locales de este bloque: `6e80c8b`, `6930c27`, `d6c7a11`, `02031d5`, `18743a6`, `e4c2644`.
(codex) Migraciones nuevas pendientes, no aplicadas por Codex: `20260825_barbara_entrega_confiable.sql`, `20260825_barbara_generaciones_idempotentes.sql`, `20260825_barbara_presupuesto_consumo.sql`, `20260825_barbara_salud_operativa.sql` y `20260825_barbara_obsidian_import.sql`.
(codex) Workflows nuevos pendientes de activación por push futuro: `barbara-entregador-pendientes.yml` y `barbara-auditoria-operativa.yml`.
(codex) Trabajo siguiente: ejecutar una verificación integral final, ensayar las migraciones en staging, hacer canary interno de generación→persistencia→entrega y construir consolidación/expiración de memoria con resolución explícita de duplicados.
(codex) Cambios HTML públicos ajenos continuaban presentes y fueron preservados fuera de todos los commits de Codex.
