# Visión final · Bárbara

## La tesis

Bárbara no es un generador de posts. Es un agente de crecimiento por cliente:
un cerebro digital persistente que conoce el negocio, aprende de cada
interacción, programa y mejora su contenido, y deja trazabilidad verificable
de por qué tomó cada decisión.

La ambición es superar las limitaciones de memoria y continuidad de un equipo
humano mediante escala, recuperación precisa del contexto y aprendizaje
acumulado. Eso no significa prometer que un modelo base "piensa mejor que una
persona"; significa construir un sistema que recuerda más, pierde menos
contexto, se adapta más rápido y puede operar de forma consistente para cada
cliente sin mezclar su información con la de otro.

La ventaja no será un prompt secreto. Será el ciclo completo:

`conversación → memoria privada → decisión explicable → contenido/programación → resultado → retroalimentación → aprendizaje`.

## Experiencia de cliente

### Portal Bárbara: el centro de control

El portal de Cóndor es donde el cliente usa realmente a Bárbara. Telegram es
un canal complementario de entrega y avisos, nunca la interfaz que concentra
el trabajo intelectual ni la configuración.

En el portal, cada cliente debe poder:

1. Hablar con el chatbot de Bárbara desde Inicio. La conversación debe poder
   pedir cambios, aportar contexto del negocio, explicar gustos, cuestionar
   una pieza o solicitar una acción concreta.
2. Ver y editar el calendario de contenido. Cada pieza muestra estado,
   plataforma, fecha/hora, objetivo, pilar, borrador y resultado. El cliente
   puede moverla o reprogramarla fácilmente; el agente conserva la razón y
   reevalúa el orden cuando cambie el plan.
3. Consultar una memoria tipo Obsidian. Debe verse como un grafo navegable de
   notas: perfil, gustos, hechos, reglas, correcciones, estrategia, patrones
   y decisiones. Las notas esenciales y las aprendidas con el cliente deben
   ser comprensibles, editables con control y trazables a su origen.
4. Revisar piezas, pedir una corrección dirigida y entender qué cambió. Un
   reintento no puede rehacer a ciegas ni borrar el contexto anterior.
5. Ver la biblioteca, resultados y recomendaciones sustentadas en datos
   reales, sin métricas simuladas ni publicaciones que aparenten estar hechas.

### Telegram: entrega y relación, no dependencia

Telegram entrega copias de las piezas multimedia y notificaciones
personalizadas, por ejemplo: "tu publicación quedó programada", "tu anuncio
ya fue publicado" o "esta pieza superó los 100 me gusta". Cada aviso debe
originarse en un evento real de la integración correspondiente; nunca se
inventan resultados ni estados. Telegram también puede recibir feedback breve,
pero el historial y la operación viven en el portal.

## El cerebro por cliente

Cada cliente tiene un cerebro aislado y siempre alimentándose. No son archivos
Markdown sueltos: son notas estructuradas que se pueden representar y exportar
como Markdown para dar una experiencia Obsidian, mientras la base de datos
conserva relaciones, permisos, versiones, fuentes y consultas eficientes.

### Capas y prioridad

1. **Memoria privada**: brand book, perfil, hechos del negocio, gustos,
   restricciones, calendario, conversaciones, correcciones y resultados de
   ese cliente. Es la autoridad máxima.
2. **Patrones globales**: aprendizajes anonimizados y comprobados entre
   múltiples marcas. Nacen apagados, requieren evidencia y aprobación antes
   de afectar a otros clientes.
3. **Playbooks fundacionales**: conocimiento propio de Cóndor AI, verificable
   y mantenido por el equipo.

Ante cualquier conflicto: privada > global > fundacional. Nunca se expone el
contenido, la identidad ni datos sensibles de un cliente a otro.

### Algoritmo de aprendizaje

El motor debe tratar cada interacción como evidencia, no como una orden que
queda perdida en un chat:

1. Clasifica la intención: dato, preferencia, regla, corrección, solicitud de
   contenido, cambio de calendario o resultado.
2. Propone una nota o una modificación a una nota existente con fuente,
   confianza y alcance.
3. Para cambios de alto impacto, conserva versión anterior y deja revisión
   humana/cliente; para hechos explícitos y preferencias claras, actualiza con
   trazabilidad.
4. Recupera sólo el contexto relevante para cada decisión: perfil sintetizado,
   reglas reforzadas, notas vinculadas, historial de piezas, pilar pendiente,
   calendario y resultados comparables.
5. Explica internamente por qué eligió un ángulo, una fecha o una corrección;
   guarda el prompt, las fuentes y el veredicto de revisión.
6. Promueve un patrón global únicamente con muestra suficiente de clientes y
   resultados, anonimizado y apagado hasta aprobación del equipo.

La escala viene de que el mismo ciclo corre de manera aislada para miles de
clientes; la calidad viene de que cada pieza es evaluada por su contexto,
resultado y feedback, no sólo por haber sido generada.

## Integraciones abiertas y seguras

El cliente podrá conectar su IA personal mediante MCP/CLI (Claude, ChatGPT u
otra compatible). Esas conexiones no reciben acceso irrestricto a la base.
Trabajan con acciones con permisos explícitos:

- leer notas y calendario del propietario;
- proponer, crear o reescribir notas privadas con fuente y versión;
- pedir un reintento dirigido o programar una pieza;
- consultar resultados y patrones autorizados;
- nunca leer datos de otro cliente ni activar un patrón global sin aprobación.

Toda escritura de una integración externa queda auditada con actor, fecha,
herramienta, cambio propuesto y versión anterior. Las acciones caras o de
publicación requieren confirmación según el plan y el nivel de confianza.

## Invariantes no negociables

- Datos y memorias de una marca nunca cruzan a otra marca.
- No se inventan métricas, publicaciones, resultados ni fuentes.
- Una publicación sólo se marca como publicada con respuesta exitosa del canal.
- Cada pieza tiene presupuesto, cuota y trazabilidad de costos.
- Cada modificación de memoria importante es reversible y tiene procedencia.
- Las publicaciones reales pasan por aprobación o por una política explícita
  de automatización que el cliente pueda entender y desactivar.
- Los archivos multimedia se guardan persistentemente; Telegram no es la
  única copia.
- El sistema falla en voz alta: una credencial, publicación o generación
  fallida crea un estado visible y un aviso, no un éxito falso.

## Hitos de construcción

### Fase 1 · Operación confiable

Motor Kie, portal, chat, memoria, calendario y correcciones funcionando de
punta a punta con Cóndor como cliente interno. Pruebas, logs, presupuesto por
cliente y almacenamiento persistente de assets.

### Fase 2 · Aprendizaje verificable

Versionado de notas, grafo de memoria usable, trazabilidad de cada decisión,
medición real de resultados y promoción controlada de patrones globales.

### Fase 3 · Agencia autónoma supervisada

Conexión oficial a redes, publicación programada con aprobación/políticas,
avisos reales por Telegram, informes y optimización basada en resultados.

### Fase 4 · Cerebro portable

MCP/CLI por cliente, export/import de su cerebro en Markdown estructurado,
repo y schema propio de Bárbara, y una arquitectura que se pueda escindir de
Cóndor sin perder seguridad ni trazabilidad.

## Cómo mediremos que progresa

- Porcentaje de instrucciones que Bárbara recuerda correctamente en la
  siguiente pieza.
- Correcciones repetidas por cliente: deben bajar, no acumularse.
- Tiempo desde feedback hasta una corrección útil.
- Piezas aprobadas sin cambios y resultados reales comparables por pilar.
- Costo por pieza y margen por cliente, con alertas antes de exceder cuota.
- Porcentaje de memoria con fuente, versión y confianza explícitas.

Esta visión es una dirección de meses. Cada sesión debe cerrar con un cambio
pequeño, probado y trazable que acerque a Bárbara a este ciclo completo.
