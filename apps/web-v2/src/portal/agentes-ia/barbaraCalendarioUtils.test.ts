import assert from "node:assert/strict";
import test from "node:test";
import { crearOcurrenciasContenido, fechaEnZona, resumenReglas } from "./barbaraCalendarioUtils.ts";

test("crea una publicación única respetando la zona de la marca", () => {
  const [iso] = crearOcurrenciasContenido({
    repite: false, fecha: "2026-08-28", hora: "10:00",
    desde: "2026-08-28", hasta: "2026-08-28", reglas: [], zonaHoraria: "America/Santiago",
  });
  assert.equal(fechaEnZona(iso, "America/Santiago"), "2026-08-28");
});

test("una serie genera todos los jueves y viernes del rango", () => {
  const ocurrencias = crearOcurrenciasContenido({
    repite: true, fecha: "2026-08-26", hora: "10:00",
    desde: "2026-08-26", hasta: "2026-09-05",
    reglas: [{ dia: 4, hora: "18:00" }, { dia: 5, hora: "12:30" }],
    zonaHoraria: "America/Santiago",
  });
  assert.deepEqual(ocurrencias.map((x) => fechaEnZona(x, "America/Santiago")), [
    "2026-08-27", "2026-08-28", "2026-09-03", "2026-09-04",
  ]);
});

test("resume la recurrencia en orden de lunes a domingo", () => {
  assert.equal(
    resumenReglas([{ dia: 5, hora: "12:00" }, { dia: 4, hora: "18:00" }]),
    "jueves a las 18:00 y viernes a las 12:00",
  );
});

test("limita series accidentales demasiado largas", () => {
  assert.throws(() => crearOcurrenciasContenido({
    repite: true, fecha: "2026-08-26", hora: "10:00",
    desde: "2026-08-26", hasta: "2026-12-31",
    reglas: [{ dia: 1, hora: "09:00" }], zonaHoraria: "America/Santiago", limite: 2,
  }), /límite/);
});
