import assert from "node:assert/strict";
import test from "node:test";
import { bloquesRespuestaBarbara } from "./barbaraRespuesta.ts";

test("agrupa listas y párrafos", () => {
  const bloques = bloquesRespuestaBarbara("Tengo esto:\n\n- **Marca:** Cóndor.AI\n- **Tono:** Directo\n\n¿Partimos?");
  assert.deepEqual(bloques, [
    { tipo: "parrafo", texto: "Tengo esto:" },
    { tipo: "lista", items: ["**Marca:** Cóndor.AI", "**Tono:** Directo"] },
    { tipo: "parrafo", texto: "¿Partimos?" },
  ]);
});

test("reconoce títulos, pasos y citas", () => {
  const bloques = bloquesRespuestaBarbara("## Próximo paso\n1. Define el objetivo\n2. Elige el formato\n\n> Recomendación personalizada");
  assert.deepEqual(bloques, [
    { tipo: "titulo", texto: "Próximo paso" },
    { tipo: "pasos", items: ["Define el objetivo", "Elige el formato"] },
    { tipo: "cita", texto: "Recomendación personalizada" },
  ]);
});
