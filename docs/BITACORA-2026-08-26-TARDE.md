# Bitácora · 26-ago-2026 (tarde)

Dos encargos de Max: editar reuniones desde el calendario, y dejar el gasto de
Meta Ads de agosto en cero para partir de nuevo en septiembre.

---

## §1 · Las reuniones se pueden editar

Hasta hoy, en el calendario de Organización una reunión solo se podía
**arrastrar** de día, **estirar** para cambiar minutos y **borrar**. Cualquier
otra cosa —agregar el link de la videollamada, cambiar el título, sumar o
sacar un invitado— obligaba a eliminarla y agendarla de nuevo, lo que mandaba
un correo diciendo "nueva reunión agendada" y dejaba la vieja en el calendario
de todos.

### Lo que se agregó

`EditorReunion` ahora recibe `existente` y sirve para las dos cosas. Los campos
eran idénticos, así que un segundo componente solo garantizaba que el próximo
campo se agregara en uno y se olvidara en el otro. Lo único que cambia entre
los modos es la recurrencia: una reunión que ya existe **no** se convierte en
serie desde acá, porque habría que decidir qué pasa con las ocurrencias
anteriores.

- **Fecha, hora, duración, título, notas, cliente y link**, todo editable.
- **Invitados del equipo**, que se leen de `reuniones_admins` y se muestran ya
  marcados. Al guardar se reconcilian: se borran los de esa reunión y se
  insertan los que quedaron.
- **Invitado externo**. `reuniones` ya traía `contacto` y `email` desde
  `agendar-publico`, pero el TIPO no los declaraba y por eso la UI nunca los
  pudo mostrar: el cliente que reservó la reunión no recibía ningún correo.
- **Reenviar**, como casilla en el editor y como botón propio en la agenda.

### 🪤 Un `<a>` dentro de un `<button>` no es HTML válido

El evento del calendario era un enlace a la videollamada. Para poder editarlo
tenía que pasar a ser un botón — pero entonces se perdía el "entrar" de un
clic. Meter el enlace adentro del botón no sirve: el navegador desarma el
marcado y uno de los dos gestos deja de existir. Van como **hermanos** dentro
de `.evento-reunion-caja`, con el enlace como insignia en la esquina.

### 🪤 El correo mentía dos de cada tres veces

`reunion-notificar` decía **"Nueva reunión agendada"** pasara lo que pasara.
Desde que se puede editar y reenviar, ese texto haría que el invitado agendara
la misma reunión dos veces. Ahora hay tres tonos —`nueva`, `actualizada`,
`recordatorio`— y el `motivo` viaja en el cuerpo.

De paso, **el link nunca iba dentro del correo**: existía solo en el portal. Se
agregó como botón en el mail, en el mensaje de Telegram y —lo importante— como
`LOCATION` y `URL` del `.ics`, que es lo que Google y Apple convierten en el
botón "Unirse" del evento.

### Dónde vive esto

`staff/Reuniones.tsx` **no está enrutado**: es una pantalla que quedó sin
referencias. El calendario que se usa es **Organización → Calendario**. Se
dejaron las dos funcionando pero el reenvío vive en `reenviarReunion.ts`, así
que hay una sola implementación y no dos que se desincronicen.

---

## §2 · Meta Ads: agosto en cero

**El síntoma.** El gasto de Facebook se descontaba dos veces de la lectura del
mes.

**Lo que había abajo.** El sync trajo agosto completo —23 días, 3 campañas,
**219.744 CLP**— y devengó cada día como `5104 Publicidad` contra `2104 Meta
Ads por pagar`. Hasta ahí bien. Pero además alguien liquidó 21 de esos
devengos con asientos manuales *"Pagado sin afectar el líquido"* contra
**`1104 Tarjeta de débito corporativa`**. Esa tarjeta **nunca recibió un
abono**, así que quedó en **−202.536**: un activo negativo arrastrando el
balance, encima del gasto que ya estaba en resultados.

**La decisión de Max.** Agosto queda en cero y Meta Ads parte limpio el **1 de
septiembre**.

### Por qué borrar y no reversar

Un contra-asiento dejaría +219.744 y −219.744 conviviendo en el Desglose: la
cifra neta sería cero pero la pantalla mostraría ruido en las dos columnas,
que es justo lo que se pidió sacar. Son devengos automáticos, no pagos: se
verificó antes de aplicar que **ningún movimiento de banco** colgaba de ellos,
que nada más los saldaba, y que las cuentas 1104, 2104 y 5104 **no tenían una
sola línea fuera** de este conjunto. Y son reconstruibles: basta bajar la
fecha de corte y volver a correr el sync.

Se borraron **23 devengos + 21 liquidaciones**. Después:

| Cuenta | Antes | Después |
|---|---|---|
| 1104 Tarjeta de débito | −202.536 | **0** |
| 2104 Meta Ads por pagar | −17.208 | **0** |
| 5104 Publicidad y campañas | 219.744 | **0** |
| 1102 Banco | 387.501 | 387.501 (intacto) |

El libro sigue cuadrado: debe = haber = 471.447, sin asientos huérfanos.

### 🪤 Sin barrera, el reset dura 20 horas

`meta-egresos.yml` **relee 35 días hacia atrás todos los días a las 8:20**. Un
borrado a secas se deshace solo a la mañana siguiente.

Por eso el corte vive en la base (`meta_ads_ajustes.contabilizar_desde`) y lo
respeta **`contabilizar_gasto_meta`**, no una bandera del script: quien corra
el sync a mano con `--dias 90` choca contra el mismo muro. El RPC devuelve
`null` en vez de lanzar, porque una excepción abortaría la corrida entera por
días viejos que justamente queremos ignorar.

`sincronizar-egresos.mjs` lee el corte **antes** de salir a la red y recorta la
ventana: agosto ni siquiera se le pide a Meta. Si la tabla no existe, sigue
como antes en vez de fallar. 7 casos en verde, incluidos "toda la ventana es
anterior al corte" y "una instalación sin la tabla sigue sincronizando".

### En pantalla

Un mes anterior al corte no es un mes sin datos: es un mes que se decidió no
contabilizar. Sin ese aviso, el cero de agosto parece que el sync se cayó.
Contabilidad → Desglose muestra **"Período excluido"** y explica desde cuándo
cuenta Meta — pero solo si además no hay campañas visibles, para que la
pastilla no contradiga a la tabla de abajo.

---

## Estado

Build y `tsc` limpios, lint igual que en `main` (40 problemas preexistentes),
7 pruebas del sync de Meta en verde. Verificado en el portal real con CDP:
editar desde el calendario, guardar, reenviar y el tono correcto del correo
(`actualizada` al editar, `recordatorio` al reenviar).
