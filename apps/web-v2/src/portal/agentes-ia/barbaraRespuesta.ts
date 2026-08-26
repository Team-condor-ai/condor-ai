export type BloqueBarbara =
  | { tipo: "parrafo" | "titulo" | "cita"; texto: string }
  | { tipo: "lista" | "pasos"; items: string[] };

/** Markdown acotado y seguro: estructura el texto sin insertar HTML remoto. */
export function bloquesRespuestaBarbara(texto: string): BloqueBarbara[] {
  const lineas = texto.replace(/\r\n?/g, "\n").split("\n");
  const bloques: BloqueBarbara[] = [];
  let parrafo: string[] = [];

  const vaciarParrafo = () => {
    const contenido = parrafo.map((linea) => linea.trim()).filter(Boolean).join(" ");
    if (contenido) bloques.push({ tipo: "parrafo", texto: contenido });
    parrafo = [];
  };

  for (let indice = 0; indice < lineas.length; indice += 1) {
    const linea = lineas[indice].trim();
    if (!linea) {
      vaciarParrafo();
      continue;
    }

    const titulo = linea.match(/^#{1,3}\s+(.+)$/);
    if (titulo) {
      vaciarParrafo();
      bloques.push({ tipo: "titulo", texto: titulo[1] });
      continue;
    }

    const cita = linea.match(/^>\s?(.+)$/);
    if (cita) {
      vaciarParrafo();
      bloques.push({ tipo: "cita", texto: cita[1] });
      continue;
    }

    const item = linea.match(/^[-*•]\s+(.+)$/);
    const paso = linea.match(/^\d+[.)]\s+(.+)$/);
    if (item || paso) {
      vaciarParrafo();
      const tipo = item ? "lista" : "pasos";
      const items: string[] = [];
      while (indice < lineas.length) {
        const actual = lineas[indice].trim();
        const coincidencia = tipo === "lista"
          ? actual.match(/^[-*•]\s+(.+)$/)
          : actual.match(/^\d+[.)]\s+(.+)$/);
        if (!coincidencia) break;
        items.push(coincidencia[1]);
        indice += 1;
      }
      indice -= 1;
      bloques.push({ tipo, items });
      continue;
    }

    parrafo.push(linea);
  }

  vaciarParrafo();
  return bloques;
}
