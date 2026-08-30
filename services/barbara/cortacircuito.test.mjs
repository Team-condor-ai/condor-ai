import assert from "node:assert/strict";
import test from "node:test";
import {
  CORTE_MS,
  FALLOS_PARA_CORTAR,
  crearCortacircuito,
  esFalloDeInfraestructura,
  textoDelError,
} from "./cortacircuito.mjs";

/* Reloj falso: el tiempo sólo avanza cuando el test lo empuja. Sin esto,
   probar la recuperación costaría 5 minutos de espera real por caso — y un
   test que duerme termina siendo un test que nadie corre. */
function reloj(inicio = 0) {
  let t = inicio;
  const ahora = () => t;
  ahora.avanzar = (ms) => { t += ms; };
  return ahora;
}

/** Instancia de prueba: reloj inyectado y `alAbrir` mudo pero registrado. */
function nuevo(opciones = {}) {
  const ahora = reloj();
  const avisos = [];
  const cc = crearCortacircuito({ ahora, alAbrir: (a) => avisos.push(a), ...opciones });
  return { cc, ahora, avisos };
}

/** Paso de cascada que falla siempre con el error que se le pase. */
const pasoQueFalla = (nombre, error, registro = []) => ({
  nombre,
  ejecutar: async () => { registro.push(nombre); throw error instanceof Error ? error : new Error(error); },
});

/** Paso de cascada que siempre sale bien. */
const pasoQueAnda = (nombre, salida, registro = []) => ({
  nombre,
  ejecutar: async () => { registro.push(nombre); return salida; },
});

/* ── clasificación ─────────────────────────────────────────────────────── */

test("reconoce los errores reales que dispararon esto", () => {
  // El literal exacto del incidente del 24 al 27-ago-2026.
  assert.equal(esFalloDeInfraestructura(new Error("Claude 400: Your credit balance is too low")), true);
  // El que ya está guionado en openai-imagen.test.mjs.
  assert.equal(esFalloDeInfraestructura(new Error("OpenAI imagen 400: Billing hard limit has been reached")), true);
  // Los timeouts que NO dicen "timeout": openai-imagen.mjs:100 y kie-api.mjs:123.
  assert.equal(esFalloDeInfraestructura(new Error("OpenAI imagen: sin respuesta en 120s")), true);
  assert.equal(esFalloDeInfraestructura(new Error("Kie API: la tarea t1 no terminó en 9 min (último estado: waiting)")), true);
  // El OAuth de Higgsfield que se rompió cuatro veces en tres días.
  assert.equal(esFalloDeInfraestructura(new Error("Higgsfield config/auth (no reintentable): session expired")), true);
  assert.equal(esFalloDeInfraestructura(new Error("Kie API POST /jobs/createTask: 429 rate limit")), true);
});

test("un rechazo de contenido NO corta: es el prompt, no el proveedor", () => {
  // Si esto cortara, un prompt raro de UN cliente dejaría sin imágenes a los
  // 99 siguientes de la misma corrida.
  assert.equal(esFalloDeInfraestructura(new Error("OpenAI imagen 400: request rejected by our content policy")), false);
  assert.equal(esFalloDeInfraestructura(new Error("Prompt vacío")), false);
  assert.equal(esFalloDeInfraestructura(new Error("OpenAI no devolvió ninguna imagen")), false);
  // Un error sin nada reconocible se toma como de calidad: ante la duda no se
  // saca de la cascada a un proveedor que puede estar sano.
  assert.equal(esFalloDeInfraestructura(new Error("algo raro pasó")), false);
  assert.equal(esFalloDeInfraestructura(null), false);
});

test("los códigos numéricos no matchean adentro de otro número", () => {
  // feedback.py busca "429" como substring suelto. Acá eso cortaría por el
  // taskId de una tarea de Kie o por el "1500" del recorte de prompt.
  assert.equal(esFalloDeInfraestructura(new Error("Kie API: la tarea t429ab quedó rara")), false);
  assert.equal(esFalloDeInfraestructura(new Error("el prompt se recortó a 1500 caracteres")), false);
  assert.equal(esFalloDeInfraestructura(new Error("HTTP 503 service unavailable")), true);
});

test("un deploy roto no se le carga al proveedor", () => {
  // ERR_MODULE_NOT_FOUND es el `npm ci` que faltaba en el workflow. Si contara
  // como infraestructura, el log diría "openai cortado" y mandaría a debuggear
  // al lado equivocado.
  assert.equal(esFalloDeInfraestructura(new Error("Cannot find module 'sharp'")), false);
});

test("desentierra el motivo real de la cadena de cause", () => {
  // undici envuelve todo en "fetch failed" y esconde el ECONNRESET abajo.
  const envuelto = new Error("fetch failed", { cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }) });
  assert.equal(esFalloDeInfraestructura(envuelto), true);
  assert.match(textoDelError(envuelto), /ECONNRESET/);
  // Y también mira `status`, que los clientes HTTP ponen como propiedad.
  assert.equal(esFalloDeInfraestructura(Object.assign(new Error("upstream"), { status: 502 })), true);
});

/* ── conteo y corte ────────────────────────────────────────────────────── */

test("un fallo suelto no corta: hace falta la racha", () => {
  const { cc, avisos } = nuevo();
  assert.equal(cc.anotarFallo("kie", new Error("HTTP 503")).cortado, false);
  assert.equal(cc.cortado("kie"), false, "un 503 aislado es ruido, no una caída");
  assert.equal(avisos.length, 0);

  assert.equal(cc.anotarFallo("kie", new Error("HTTP 503")).cortado, true);
  assert.equal(cc.cortado("kie"), true);
  assert.equal(FALLOS_PARA_CORTAR, 2, "si cambia el umbral, este test tiene que decirlo");
});

test("una respuesta buena en el medio corta la racha", () => {
  const { cc } = nuevo();
  cc.anotarFallo("kie", new Error("HTTP 503"));
  cc.anotarExito("kie");
  cc.anotarFallo("kie", new Error("HTTP 503"));
  assert.equal(cc.cortado("kie"), false, "dos hipos separados por una respuesta sana no son una caída");
});

test("un fallo de calidad también corta la racha: el proveedor contestó", () => {
  const { cc } = nuevo();
  cc.anotarFallo("openai", new Error("HTTP 503"));
  cc.anotarFallo("openai", new Error("rejected by our content policy"));
  cc.anotarFallo("openai", new Error("HTTP 503"));
  assert.equal(cc.cortado("openai"), false);
});

test("al abrir avisa una sola vez, con el motivo y cuánto dura", () => {
  // El aviso es la pieza que faltó en agosto: tres días de silencio porque
  // nadie se enteró. Sin esto el cortacircuito ahorra plata pero sigue mudo.
  const { cc, avisos } = nuevo();
  cc.anotarFallo("anthropic", new Error("Your credit balance is too low"));
  cc.anotarFallo("anthropic", new Error("Your credit balance is too low"));
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].proveedor, "anthropic");
  assert.match(avisos[0].motivo, /credit balance/);
  assert.equal(avisos[0].corteMs, CORTE_MS);
});

test("si el aviso explota, la generación sigue igual", () => {
  const cc = crearCortacircuito({ ahora: reloj(), alAbrir: () => { throw new Error("Telegram caído"); } });
  cc.anotarFallo("kie", new Error("HTTP 503"));
  assert.doesNotThrow(() => cc.anotarFallo("kie", new Error("HTTP 503")));
  assert.equal(cc.cortado("kie"), true);
});

/* ── recuperación, sin esperar de verdad ───────────────────────────────── */

test("pasado el corte se vuelve a probar solo", () => {
  const { cc, ahora } = nuevo();
  cc.anotarFallo("kie", new Error("HTTP 503"));
  cc.anotarFallo("kie", new Error("HTTP 503"));
  assert.equal(cc.cortado("kie"), true);

  ahora.avanzar(CORTE_MS - 1);
  assert.equal(cc.cortado("kie"), true, "un milisegundo antes todavía está cortado");

  ahora.avanzar(1);
  assert.equal(cc.cortado("kie"), false, "vencida la ventana se reprueba sin que nadie lo destrabe");
});

test("si la sonda vuelve a fallar, el corte se renueva en el acto y más largo", () => {
  // El proveedor ya demostró que estaba caído: pedirle otros dos fallos sería
  // pagar dos timeouts de más por cada ventana.
  const { cc, ahora, avisos } = nuevo();
  cc.anotarFallo("kie", new Error("HTTP 503"));
  cc.anotarFallo("kie", new Error("HTTP 503"));
  ahora.avanzar(CORTE_MS);

  const r = cc.anotarFallo("kie", new Error("HTTP 503"));
  assert.equal(r.cortado, true, "un solo fallo alcanza para volver a cortar");
  assert.equal(avisos[1].corteMs, CORTE_MS * 2, "el segundo corte dura el doble");
});

test("un éxito después del corte borra el castigo acumulado", () => {
  const { cc, ahora } = nuevo();
  cc.anotarFallo("kie", new Error("HTTP 503"));
  cc.anotarFallo("kie", new Error("HTTP 503"));
  ahora.avanzar(CORTE_MS);
  cc.anotarExito("kie");
  assert.deepEqual(cc.resumen(), [], "recuperado es recuperado: vuelve a arrancar de cero");
});

/* ── la cascada: las reglas duras ──────────────────────────────────────── */

test("un fallo baja al proveedor siguiente en vez de dejar al cliente sin pieza", async () => {
  // El caso que motor.mjs NO cubría: cada escalón era un `if` con `return`
  // adentro, así que una caída de OpenAI dejaba el slide sin fondo aunque Kie
  // estuviera configurado y sano.
  const { cc } = nuevo();
  const orden = [];
  const url = await cc.cascada([
    pasoQueFalla("openai", new Error("OpenAI imagen 500: internal server error"), orden),
    pasoQueAnda("kie", "https://x/i.png", orden),
  ], { etiqueta: "imagen slide 1" });

  assert.equal(url, "https://x/i.png");
  assert.deepEqual(orden, ["openai", "kie"]);
});

test("también salta cuando el fallo es de calidad, no sólo de infraestructura", async () => {
  // La regla dura es sobre la PIEZA: si hay alternativa, se prueba. La clase
  // de fallo sólo decide si además se corta.
  const { cc } = nuevo();
  const url = await cc.cascada([
    pasoQueFalla("openai", new Error("rejected by our content policy")),
    pasoQueAnda("kie", "https://x/i.png"),
  ]);
  assert.equal(url, "https://x/i.png");
  assert.equal(cc.cortado("openai"), false, "un rechazo de contenido no puede tumbar al proveedor");
});

test("el proveedor cortado se saltea: los 5 slides que faltan no lo vuelven a pagar", async () => {
  const { cc } = nuevo();
  const orden = [];
  const caido = new Error("OpenAI imagen: sin respuesta en 120s");

  // Slides 1 y 2: OpenAI se cuelga, Kie salva la pieza.
  for (const _ of [1, 2]) {
    await cc.cascada([pasoQueFalla("openai", caido, orden), pasoQueAnda("kie", "ok", orden)]);
  }
  const hasta = orden.length;

  // Slides 3 a 6: OpenAI ni se intenta.
  for (const _ of [3, 4, 5, 6]) {
    await cc.cascada([pasoQueFalla("openai", caido, orden), pasoQueAnda("kie", "ok", orden)]);
  }
  assert.deepEqual(orden.slice(hasta), ["kie", "kie", "kie", "kie"]);
});

test("con todos cortados falla diciendo exactamente eso", async () => {
  const { cc, ahora } = nuevo();
  for (const proveedor of ["openai", "kie"]) {
    cc.anotarFallo(proveedor, new Error("HTTP 503"));
    cc.anotarFallo(proveedor, new Error("HTTP 503"));
  }

  const orden = [];
  await assert.rejects(
    () => cc.cascada([
      pasoQueFalla("openai", new Error("x"), orden),
      pasoQueFalla("kie", new Error("x"), orden),
    ], { etiqueta: "imagen slide 4" }),
    (e) => {
      assert.equal(e.todosCortados, true);
      assert.match(e.message, /todos los proveedores están cortados/);
      assert.match(e.message, /openai reintenta en 5 min/);
      assert.deepEqual(e.proveedores, ["openai", "kie"]);
      // Un corte se cura solo: marcarlo permanent abortaría la corrida entera
      // (clientes.mjs:641) por algo que en 5 min ya no está.
      assert.notEqual(e.permanent, true);
      return true;
    },
  );
  assert.deepEqual(orden, [], "no se gastó ni una llamada");

  ahora.avanzar(CORTE_MS);
  assert.equal(await cc.cascada([pasoQueAnda("openai", "vuelve")]), "vuelve");
});

test("con un solo proveedor el mensaje no miente hablando en plural", async () => {
  // El caso de `claude()`: no hay cascada, no hay a dónde saltar.
  const { cc } = nuevo();
  cc.anotarFallo("anthropic", new Error("credit balance is too low"));
  cc.anotarFallo("anthropic", new Error("credit balance is too low"));
  await assert.rejects(
    () => cc.cascada([pasoQueAnda("anthropic", "x")], { etiqueta: "Claude" }),
    /el único proveedor \(anthropic\) está cortado/,
  );
});

test("si todos fallan de verdad, el error nombra a cada uno y su motivo", async () => {
  const { cc } = nuevo();
  await assert.rejects(
    () => cc.cascada([
      pasoQueFalla("openai", new Error("OpenAI imagen 500: internal server error")),
      pasoQueFalla("kie", new Error("Kie API: createTask no devolvió taskId")),
    ], { etiqueta: "imagen slide 2" }),
    (e) => {
      assert.notEqual(e.todosCortados, true, "esto no es un corte: los dos se intentaron");
      assert.match(e.message, /openai: .*internal server error/);
      assert.match(e.message, /kie: .*createTask/);
      assert.equal(e.errores.length, 2);
      return true;
    },
  );
});

test("el error del que sí se intentó se ve, aunque otro estuviera cortado", async () => {
  const { cc } = nuevo();
  cc.anotarFallo("openai", new Error("HTTP 503"));
  cc.anotarFallo("openai", new Error("HTTP 503"));
  await assert.rejects(
    () => cc.cascada([
      pasoQueFalla("openai", new Error("x")),
      pasoQueFalla("kie", new Error("Kie API: createTask no devolvió taskId")),
    ]),
    (e) => {
      assert.match(e.message, /openai: saltado, cortado/);
      assert.match(e.message, /kie: .*createTask/);
      assert.deepEqual(e.cortados, ["openai"]);
      return true;
    },
  );
});

test("permanent sólo si TODOS los que se intentaron eran permanentes", async () => {
  // clientes.mjs:641 usa `permanent` para abortar la corrida entera. Si la key
  // de OpenAI está muerta pero Kie anda, abortar sería tirar a la basura a
  // todos los clientes que faltan por una cascada que igual funciona.
  const permanente = (nombre) => ({
    nombre,
    ejecutar: async () => { throw Object.assign(new Error(`${nombre} 401 unauthorized`), { permanent: true }); },
  });

  const a = nuevo().cc;
  await assert.rejects(
    () => a.cascada([permanente("openai"), pasoQueFalla("kie", new Error("Kie API 500"))]),
    (e) => e.permanent !== true,
  );

  const b = nuevo().cc;
  await assert.rejects(
    () => b.cascada([permanente("openai"), permanente("kie")]),
    (e) => e.permanent === true,
  );
});

test("sin ningún proveedor configurado lo dice, en vez de romper con undefined", async () => {
  const { cc } = nuevo();
  await assert.rejects(
    () => cc.cascada([
      { nombre: "openai", disponible: () => false, ejecutar: async () => "no" },
      { nombre: "kie", disponible: false, ejecutar: async () => "no" },
    ], { etiqueta: "imagen slide 1" }),
    /no hay ningún proveedor configurado/,
  );
});

test("un éxito en la cascada limpia la racha de ese proveedor", async () => {
  const { cc } = nuevo();
  cc.anotarFallo("kie", new Error("HTTP 503"));
  await cc.cascada([pasoQueAnda("kie", "ok")]);
  cc.anotarFallo("kie", new Error("HTTP 503"));
  assert.equal(cc.cortado("kie"), false);
});

/* ── estado compartido y su límite ─────────────────────────────────────── */

test("el estado es del proceso: lo comparten todos los clientes de la corrida", async () => {
  // Ése es el punto de que haya UNA instancia en motor.mjs: el cliente 40 no
  // tiene que redescubrir que el proveedor está caído.
  const { cc } = nuevo();
  const caido = new Error("Your credit balance is too low");
  const orden = [];
  await cc.cascada([pasoQueFalla("openai", caido, orden), pasoQueAnda("kie", "ok", orden)]); // cliente 1
  await cc.cascada([pasoQueFalla("openai", caido, orden), pasoQueAnda("kie", "ok", orden)]); // cliente 2
  await cc.cascada([pasoQueFalla("openai", caido, orden), pasoQueAnda("kie", "ok", orden)]); // cliente 3

  assert.equal(orden.filter((n) => n === "openai").length, 2, "el tercer cliente ya no le paga el timeout");
});

test("resumen sirve para el cierre de corrida y es serializable", () => {
  // La costura por si algún día se persiste: sale y entra como JSON plano.
  const { cc } = nuevo();
  cc.anotarFallo("openai", new Error("credit balance is too low"));
  cc.anotarFallo("openai", new Error("credit balance is too low"));
  cc.anotarFallo("kie", new Error("HTTP 503"));

  const r = cc.resumen();
  assert.deepEqual(r.map((x) => [x.proveedor, x.cortado]), [["openai", true], ["kie", false]]);
  assert.equal(r[0].reintentaEnMs, CORTE_MS);
  assert.equal(JSON.parse(JSON.stringify(r))[0].proveedor, "openai");
});

test("dos instancias no comparten estado: cortar imagen no corta video", () => {
  // Y al revés: dentro de una instancia el estado es POR PROVEEDOR, así que la
  // caída de OpenAI no arrastra a Kie.
  const { cc } = nuevo();
  cc.anotarFallo("openai", new Error("HTTP 503"));
  cc.anotarFallo("openai", new Error("HTTP 503"));
  assert.equal(cc.cortado("kie"), false);
  assert.equal(nuevo().cc.cortado("openai"), false);
});
