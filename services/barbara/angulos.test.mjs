import assert from "node:assert/strict";
import test from "node:test";
import { proponer, juzgar, elegirAngulo } from "./angulos.mjs";

/* Un doble de `claude` que devuelve respuestas guionadas en orden y registra
   con qué se lo llamó. Así se testea la lógica de decisión sin red y sin
   gastar tokens. */
function claudeFalso(...respuestas) {
  const llamadas = [];
  const cola = [...respuestas];
  const fn = async (apiKey, body) => {
    llamadas.push({ apiKey, body });
    const siguiente = cola.shift();
    if (siguiente === undefined) throw new Error("claudeFalso: se acabaron las respuestas guionadas");
    return { content: [{ type: "text", text: JSON.stringify(siguiente) }] };
  };
  fn.llamadas = llamadas;
  return fn;
}

const A = (angulo) => ({ angulo, por_que_es_distinto: "n/a" });

test("proponer devuelve los ángulos y le pasa el historial al modelo", async () => {
  const claude = claudeFalso({ angulos: [A("uno"), A("dos"), A("tres")] });
  const out = await proponer(claude, "k", {
    instruccion: "carrusel de servicios",
    historial: ["algo viejo", "otra cosa vieja"],
    n: 3,
  });

  assert.equal(out.length, 3);
  assert.equal(out[0].angulo, "uno");
  const prompt = claude.llamadas[0].body.messages[0].content;
  assert.match(prompt, /algo viejo/);
  assert.match(prompt, /otra cosa vieja/);
});

test("proponer recorta a n aunque el modelo devuelva de más", async () => {
  const claude = claudeFalso({ angulos: [A("1"), A("2"), A("3"), A("4"), A("5")] });
  const out = await proponer(claude, "k", { instruccion: "x", n: 2 });
  assert.equal(out.length, 2);
});

test("juzgar sin historial no llama al modelo y toma el primero", async () => {
  const claude = claudeFalso(); // sin respuestas: si llama, revienta
  const v = await juzgar(claude, "k", { candidatos: [A("nuevo"), A("otro")], historial: [] });

  assert.equal(v.elegido.angulo, "nuevo");
  assert.equal(v.sin_historial, true);
  assert.equal(claude.llamadas.length, 0, "no debe gastar una llamada si no hay con qué comparar");
});

test("juzgar elige el índice que devuelve el modelo", async () => {
  const claude = claudeFalso({
    elegido_index: 2,
    descartes: [{ index: 0, se_parece_a: "viejo", razon: "misma idea" }],
  });
  const v = await juzgar(claude, "k", {
    candidatos: [A("repetido"), A("otro"), A("el bueno")],
    historial: ["viejo"],
  });

  assert.equal(v.elegido.angulo, "el bueno");
  assert.equal(v.elegido_index, 2);
  assert.equal(v.descartes.length, 1);
});

test("juzgar trata elegido_index = -1 como 'todos repiten'", async () => {
  const claude = claudeFalso({ elegido_index: -1, descartes: [] });
  const v = await juzgar(claude, "k", { candidatos: [A("a")], historial: ["a parecido"] });

  assert.equal(v.elegido, null);
  assert.equal(v.elegido_index, -1);
});

test("juzgar ignora un índice fuera de rango en vez de devolver undefined", async () => {
  const claude = claudeFalso({ elegido_index: 7, descartes: [] });
  const v = await juzgar(claude, "k", { candidatos: [A("a"), A("b")], historial: ["x"] });

  assert.equal(v.elegido, null, "un índice inventado por el modelo no puede pasar como elección válida");
});

test("elegirAngulo devuelve el primero bueno sin reintentar", async () => {
  const claude = claudeFalso(
    { angulos: [A("bueno"), A("otro")] },
    { elegido_index: 0, descartes: [] },
  );
  const r = await elegirAngulo(claude, "k", { instruccion: "x", historial: ["viejo"] });

  assert.equal(r.angulo.angulo, "bueno");
  assert.equal(r.intentos, 1);
  assert.equal(r.agotado, false);
  assert.equal(claude.llamadas.length, 2, "una para proponer, una para juzgar");
});

test("elegirAngulo reintenta y le pasa los descartes al segundo intento", async () => {
  const claude = claudeFalso(
    { angulos: [A("repite")] },
    { elegido_index: -1, descartes: [{ index: 0, se_parece_a: "pieza vieja", razon: "misma idea" }] },
    { angulos: [A("ahora sí")] },
    { elegido_index: 0, descartes: [] },
  );
  const r = await elegirAngulo(claude, "k", { instruccion: "x", historial: ["pieza vieja"] });

  assert.equal(r.angulo.angulo, "ahora sí");
  assert.equal(r.intentos, 2);
  assert.equal(r.agotado, false);

  // El segundo `proponer` (llamada 3) tiene que llevar el descarte explícito,
  // si no vuelve a proponer lo mismo.
  const segundaPropuesta = claude.llamadas[2].body.messages[0].content;
  assert.match(segundaPropuesta, /pieza vieja/);
  assert.match(segundaPropuesta, /misma idea/);
});

test("elegirAngulo agotado devuelve candidato + bandera, no null ni excepción", async () => {
  const claude = claudeFalso(
    { angulos: [A("repite 1")] },
    { elegido_index: -1, descartes: [{ index: 0, se_parece_a: "v", razon: "r" }] },
    { angulos: [A("repite 2")] },
    { elegido_index: -1, descartes: [{ index: 0, se_parece_a: "v", razon: "r" }] },
  );
  const r = await elegirAngulo(claude, "k", { instruccion: "x", historial: ["v"], maxIntentos: 2 });

  assert.equal(r.agotado, true, "el llamador tiene que poder avisar, no descubrirlo por un crash");
  assert.equal(r.angulo.angulo, "repite 2", "devuelve el mejor disponible para no quedarse sin publicar");
  assert.equal(r.descartes.length, 2);
});
