import { useState } from "react";
import { sb } from "../lib/supabase";
import { CATALOGO_PLANES, MONEDAS, type Cliente } from "./tipos";

type Props = {
  cliente: Cliente | null;
  cerrar: () => void;
  guardado: () => void;
};

/**
 * Alta y configuración de un cliente. `cliente === null` significa "nuevo".
 *
 * CREAR PIDE POCO; CONFIGURAR PIDE TODO
 * ---------------------------------------------------------------------------
 * Dar de alta a alguien necesita un nombre y nada más. Todo lo demás —el
 * contacto, la web, las notas— se sabe después, y pedirlo por adelantado
 * llena la ficha de campos vacíos que igual ocupan pantalla. Por eso el
 * formulario de alta es corto y el botón "Configurar cliente" de la ficha
 * abre el mismo formulario con todo.
 *
 * UN SOLO "NOMBRE"
 * ---------------------------------------------------------------------------
 * Antes se pedían "Nombre de contacto" y "Negocio" al crear, y nadie tenía
 * claro cuál iba en las listas. Ahora se pide UNO, que es el que se muestra en
 * todas partes (`negocio`), y la persona de contacto queda como un dato más de
 * la configuración.
 *
 * Los cobros NO viven acá: son una tabla propia y se agregan desde la ficha.
 */
export function EditorCliente({ cliente, cerrar, guardado }: Props) {
  const esNuevo = !cliente;

  const [f, setF] = useState({
    negocio: cliente?.negocio ?? "",
    nombre: cliente?.nombre ?? "",
    email: cliente?.email ?? "",
    telefono: cliente?.telefono ?? "",
    plan: cliente?.plan ?? "",
    concepto: cliente?.concepto ?? "",
    moneda: cliente?.moneda ?? "CLP",
    web_url: cliente?.web_url ?? "",
    notas: cliente?.notas ?? "",
  });

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!f.negocio.trim()) { setError("Ponle un nombre al cliente."); return; }
    setGuardando(true);
    setError("");

    const fila = {
      ...f,
      negocio: f.negocio.trim(),
      // El correo vacío viaja como null, no como "": es lo que distingue
      // "no tiene correo" de "tiene un correo en blanco", y `email` dejó de
      // ser obligatorio en la base justamente para permitir el primer caso.
      email: f.email.trim().toLowerCase() || null,
      nombre: f.nombre.trim() || null,
      telefono: f.telefono.trim() || null,
      plan: f.plan.trim() || null,
      notas: f.notas.trim() || null,
    };

    const q = cliente
      ? sb.from("clientes").update(fila).eq("id", cliente.id)
      : sb.from("clientes").insert(fila);
    const { error } = await q;
    setGuardando(false);
    if (error) setError(error.message);
    else guardado();
  }

  const campoPlan = (
    <label className="campo-lbl">
      Plan o servicio
      {/* Campo libre + desplegable con lo que ya ofrecemos. Es un `select`
          aparte y no un `datalist` porque el datalist no muestra la flecha en
          todos los navegadores: la lista existía y nadie sabía que estaba. */}
      <span style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
        <input
          className="campo"
          style={{ flex: 1, minWidth: 0 }}
          placeholder="Escribe uno, o elige de la lista →"
          value={f.plan}
          onChange={(e) => set("plan", e.target.value)}
        />
        <select
          className="campo"
          style={{ width: 132, flex: "none" }}
          value=""
          onChange={(e) => e.target.value && set("plan", e.target.value)}
          aria-label="Elegir de los planes que ya ofrecemos"
        >
          <option value="">Elegir…</option>
          {CATALOGO_PLANES.map((g) => (
            <optgroup key={g.grupo} label={g.grupo}>
              {g.planes.map((p) => <option key={p}>{p}</option>)}
            </optgroup>
          ))}
        </select>
      </span>
    </label>
  );

  return (
    <div className="velo" onClick={cerrar}>
      <form className="panel-modal" onClick={(e) => e.stopPropagation()} onSubmit={enviar}>
        <header>
          <h2>{esNuevo ? "Nuevo cliente" : "Configurar cliente"}</h2>
        </header>

        <div className="contenido">
          <label className="campo-lbl">
            Nombre
            <input
              className="campo"
              required
              autoFocus
              placeholder="Ej: Tecnobox"
              value={f.negocio}
              onChange={(e) => set("negocio", e.target.value)}
            />
            <small>Es el nombre con el que aparece en todo el portal.</small>
          </label>

          <div className="dos">
            <label className="campo-lbl">
              Correo <span style={{ fontWeight: 400, opacity: 0.7 }}>· opcional</span>
              <input
                className="campo"
                type="email"
                value={f.email}
                onChange={(e) => set("email", e.target.value)}
              />
              {/* El aviso cambia según lo que haya escrito: repetir siempre la
                  misma frase hace que nadie la lea. Sin correo se dice la
                  consecuencia concreta, no una regla abstracta. */}
              <small style={f.email.trim() ? undefined : { color: "var(--mal-tx)" }}>
                {f.email.trim()
                  ? "Con este correo inicia sesión en el portal de clientes."
                  : "Sin correo NO entra al portal de clientes. Se administra solo desde acá."}
              </small>
            </label>
            <label className="campo-lbl">
              Teléfono <span style={{ fontWeight: 400, opacity: 0.7 }}>· opcional</span>
              <input
                className="campo"
                type="tel"
                placeholder="+56 9 1234 5678"
                value={f.telefono}
                onChange={(e) => set("telefono", e.target.value)}
              />
              <small>Con código de país, para que el enlace a WhatsApp funcione.</small>
            </label>
          </div>

          {/* El plan va en su propia fila, no compartiendo `.dos` con la
              moneda: entre el campo de texto y el desplegable no cabían en
              media pantalla y el texto quedaba cortado a la mitad. */}
          {campoPlan}

          <label className="campo-lbl" style={{ maxWidth: 240 }}>
            Moneda
            <select
              className="campo"
              value={f.moneda}
              onChange={(e) => set("moneda", e.target.value)}
            >
              {MONEDAS.map((m) => <option key={m}>{m}</option>)}
            </select>
            <small>Es la que se le propone a cada cobro nuevo.</small>
          </label>

          {/* Lo que sigue solo aparece al CONFIGURAR: para dar de alta a
              alguien no hace falta, y pedirlo por adelantado deja campos
              vacíos que igual ocupan pantalla. */}
          {!esNuevo && (
            <>
              <label className="campo-lbl">
                Persona de contacto <span style={{ fontWeight: 400, opacity: 0.7 }}>· opcional</span>
                <input
                  className="campo"
                  placeholder="Ej: Carmen Reyes"
                  value={f.nombre}
                  onChange={(e) => set("nombre", e.target.value)}
                />
                <small>Con quién se habla. El nombre de arriba es el del cliente.</small>
              </label>

              <label className="campo-lbl">
                Servicio ofrecido
                <textarea
                  className="campo"
                  rows={2}
                  placeholder="Landing + Videos IA + Campañas Meta"
                  value={f.concepto}
                  onChange={(e) => set("concepto", e.target.value)}
                />
                <small>Esto es lo que el cliente ve como "qué incluye".</small>
              </label>

              <label className="campo-lbl">
                Página web
                <input
                  className="campo"
                  placeholder="tecnobox.cl"
                  value={f.web_url}
                  onChange={(e) => set("web_url", e.target.value)}
                />
              </label>

              <label className="campo-lbl">
                Notas internas
                <textarea
                  className="campo"
                  rows={3}
                  placeholder="Lo que convenga recordar de este cliente."
                  value={f.notas}
                  onChange={(e) => set("notas", e.target.value)}
                />
                <small>Solo las ve el equipo; el cliente nunca las lee.</small>
              </label>
            </>
          )}

          {esNuevo && (
            <p className="tenue">
              Se crea sin cobros. Después, desde su ficha, puedes configurarlo
              entero y agregarle los cobros que haga falta.
            </p>
          )}

          {error && <p className="error">{error}</p>}
        </div>

        <footer>
          <button type="button" className="btn" onClick={cerrar}>Cancelar</button>
          <button className="btn solido" disabled={guardando}>
            {guardando ? "Guardando…" : esNuevo ? "Crear cliente" : "Guardar"}
          </button>
        </footer>
      </form>
    </div>
  );
}
