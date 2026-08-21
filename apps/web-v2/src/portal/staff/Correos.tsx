import { useEffect, useMemo, useRef, useState } from "react";
import { sb, fecha } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import type { Cliente } from "./tipos";

type Contacto = {
  id: string;
  email: string;
  nombre: string | null;
  empresa: string | null;
  estado: "suscrito" | "no_suscrito" | "baja" | "rebotado";
  etiquetas: string[];
  fuente: string;
  consentimiento_en: string | null;
};
type Campana = {
  id: string;
  nombre: string;
  asunto: string;
  cuerpo: string;
  preheader: string | null;
  estado: "borrador" | "programada" | "enviando" | "enviada" | "cancelada";
  programada_para: string | null;
  enviados: number;
  fallidos: number;
  creado_en: string;
};
type Vista = "componer" | "audiencia" | "historial";
const VARS = ["{{nombre}}", "{{empresa}}", "{{email}}"];

function filaCSV(linea: string, separador: string) {
  const celdas: string[] = [];
  let actual = "",
    comillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"' && comillas && linea[i + 1] === '"') {
      actual += '"';
      i++;
    } else if (c === '"') comillas = !comillas;
    else if (c === separador && !comillas) {
      celdas.push(actual.trim());
      actual = "";
    } else actual += c;
  }
  celdas.push(actual.trim());
  return celdas;
}

export function Correos() {
  const [vista, setVista] = useState<Vista>("componer");
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [campanas, setCampanas] = useState<Campana[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [nombre, setNombre] = useState("");
  const [asunto, setAsunto] = useState("");
  const [preheader, setPreheader] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [programada, setProgramada] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [importando, setImportando] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);

  async function cargar() {
    const [co, cl, ca] = await Promise.all([
      sb
        .from("email_contactos")
        .select("*")
        .order("creado_en", { ascending: false }),
      sb.from("clientes").select("*"),
      sb
        .from("email_campanas")
        .select("*")
        .order("creado_en", { ascending: false }),
    ]);
    setContactos((co.data ?? []) as Contacto[]);
    setClientes((cl.data ?? []) as Cliente[]);
    setCampanas((ca.data ?? []) as Campana[]);
    if (co.error)
      setError(
        "Falta aplicar la migración de email marketing: " + co.error.message,
      );
  }
  useEffect(() => {
    const timer = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const audiencia = useMemo(() => {
    const mapa = new Map<string, Contacto>();
    contactos.forEach((c) => mapa.set(c.email.toLowerCase(), c));
    clientes
      .filter((c) => c.email && !c.archivado)
      .forEach((c) => {
        if (!mapa.has(c.email!.toLowerCase()))
          mapa.set(c.email!.toLowerCase(), {
            id: `cliente:${c.id}`,
            email: c.email!,
            nombre: c.nombre,
            empresa: c.negocio,
            estado: "no_suscrito",
            etiquetas: ["cliente"],
            fuente: "clientes",
            consentimiento_en: null,
          });
      });
    return [...mapa.values()];
  }, [contactos, clientes]);
  const elegidos = audiencia.filter(
    (c) => sel.has(c.id) && c.estado === "suscrito",
  );
  const insertar = (v: string) =>
    setCuerpo((t) => t + (t && !t.endsWith(" ") ? " " : "") + v);
  const render = (t: string, c?: Contacto) =>
    t
      .replaceAll("{{nombre}}", c?.nombre?.split(" ")[0] || "Hola")
      .replaceAll("{{empresa}}", c?.empresa || "tu negocio")
      .replaceAll("{{email}}", c?.email || "correo@ejemplo.cl");

  async function sincronizarClientes() {
    const filas = clientes
      .filter((c) => c.email && !c.archivado)
      .map((c) => ({
        email: c.email!.toLowerCase(),
        nombre: c.nombre,
        empresa: c.negocio,
        cliente_id: c.id,
        fuente: "clientes",
        estado: "no_suscrito",
        etiquetas: ["cliente"],
      }));
    const { error } = await sb
      .from("email_contactos")
      .upsert(filas, { onConflict: "email", ignoreDuplicates: true });
    if (error) setError(error.message);
    else {
      setOk(
        `${filas.length} clientes sincronizados. Quedan como “sin consentimiento” hasta confirmarlo.`,
      );
      cargar();
    }
  }

  async function importarCSV(file?: File) {
    if (!file) return;
    setImportando(true);
    setError("");
    const txt = await file.text();
    const lineas = txt
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .filter(Boolean);
    if (lineas.length < 2) {
      setError("El CSV está vacío.");
      setImportando(false);
      return;
    }
    const sep = lineas[0].includes(";") ? ";" : ",";
    const headers = filaCSV(lineas[0], sep).map((x) => x.toLowerCase());
    const idx = (n: string[]) => headers.findIndex((h) => n.includes(h));
    const ie = idx(["email", "correo", "e-mail"]),
      inn = idx(["nombre", "name"]),
      iem = idx(["empresa", "negocio", "company"]),
      iet = idx(["etiquetas", "tags"]);
    if (ie < 0) {
      setError("El CSV necesita una columna email o correo.");
      setImportando(false);
      return;
    }
    const filas = lineas
      .slice(1)
      .map((l) => {
        const c = filaCSV(l, sep);
        return {
          email: c[ie]?.toLowerCase(),
          nombre: inn >= 0 ? c[inn] || null : null,
          empresa: iem >= 0 ? c[iem] || null : null,
          etiquetas:
            iet >= 0
              ? c[iet]
                  .split("|")
                  .map((x) => x.trim())
                  .filter(Boolean)
              : [],
          estado: "suscrito",
          fuente: "csv",
          consentimiento_en: new Date().toISOString(),
        };
      })
      .filter((x) => /.+@.+\..+/.test(x.email));
    const { error } = await sb
      .from("email_contactos")
      .upsert(filas, { onConflict: "email" });
    setImportando(false);
    if (error) setError(error.message);
    else {
      setOk(
        `${filas.length} contactos importados con consentimiento registrado.`,
      );
      cargar();
    }
  }

  async function guardarProgramar(enviarAhora = false) {
    setError("");
    setOk("");
    if (!nombre.trim() || !asunto.trim() || !cuerpo.trim())
      return setError("Completa nombre interno, asunto y mensaje.");
    if (!elegidos.length)
      return setError("Elige al menos un contacto suscrito.");
    if (!enviarAhora && !programada)
      return setError("Elige fecha y hora de envío.");
    setEnviando(true);
    const estado = enviarAhora ? "enviando" : "programada";
    const { data: ca, error: ec } = await sb
      .from("email_campanas")
      .insert({
        nombre: nombre.trim(),
        asunto,
        preheader: preheader.trim() || null,
        cuerpo,
        estado,
        programada_para: enviarAhora
          ? new Date().toISOString()
          : new Date(programada).toISOString(),
        destinatarios: elegidos.map((c) => c.id),
        total_destinatarios: elegidos.length,
      })
      .select()
      .single();
    if (ec || !ca) {
      setEnviando(false);
      setError(ec?.message ?? "No se pudo guardar la campaña");
      return;
    }
    if (!enviarAhora) {
      setEnviando(false);
      setOk(
        `Campaña programada para ${new Date(programada).toLocaleString("es-CL")}.`,
      );
      cargar();
      setVista("historial");
      return;
    }
    const { data, error } = await sb.functions.invoke("enviar-correos", {
      body: {
        campana_id: ca.id,
        mensajes: elegidos.map((c) => ({
          contacto_id: c.id.startsWith("cliente:") ? null : c.id,
          para: c.email,
          asunto: render(asunto, c),
          cuerpo: render(cuerpo, c),
          preheader: render(preheader, c),
        })),
      },
    });
    setEnviando(false);
    if (error) setError(error.message);
    else {
      setOk(
        `Campaña enviada a ${(data as { enviados?: number })?.enviados ?? elegidos.length} contactos.`,
      );
      cargar();
      setVista("historial");
    }
  }

  return (
    <>
      <div className="barra">
        <div>
          <h1>Email marketing</h1>
          <small className="subtitulo-barra">
            Audiencias con consentimiento, campañas y envíos automáticos
          </small>
        </div>
        {vista === "audiencia" && (
          <>
            <input
              ref={archivo}
              hidden
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => importarCSV(e.target.files?.[0])}
            />
            <button
              className="btn"
              onClick={() => archivo.current?.click()}
              disabled={importando}
            >
              {Ico.subir({ t: 15 })}{" "}
              {importando ? "Importando…" : "Importar CSV"}
            </button>
          </>
        )}
      </div>
      <div className="cuerpo email-marketing">
        {error && <p className="error">{error}</p>}
        {ok && <p className="ok-msg">{ok}</p>}
        <div className="subnav-organizacion">
          <button
            className={vista === "componer" ? "on" : ""}
            onClick={() => setVista("componer")}
          >
            {Ico.correos({ t: 15 })} Crear campaña
          </button>
          <button
            className={vista === "audiencia" ? "on" : ""}
            onClick={() => setVista("audiencia")}
          >
            {Ico.clientes({ t: 15 })} Audiencia{" "}
            <span>
              {audiencia.filter((x) => x.estado === "suscrito").length}
            </span>
          </button>
          <button
            className={vista === "historial" ? "on" : ""}
            onClick={() => setVista("historial")}
          >
            {Ico.repetir({ t: 15 })} Historial
          </button>
        </div>
        {vista === "componer" ? (
          <div className="campana-layout">
            <section className="bloque campana-editor">
              <div className="form-seccion">
                <b>Campaña</b>
                <span>El nombre es interno; el contacto ve el asunto.</span>
              </div>
              <label className="campo-lbl">
                Nombre interno
                <input
                  className="campo"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Lanzamiento Bárbara · agosto"
                />
              </label>
              <label className="campo-lbl">
                Asunto
                <input
                  className="campo"
                  value={asunto}
                  onChange={(e) => setAsunto(e.target.value)}
                  placeholder="{{nombre}}, tenemos algo nuevo para {{empresa}}"
                />
              </label>
              <label className="campo-lbl">
                Texto de vista previa
                <input
                  className="campo"
                  value={preheader}
                  onChange={(e) => setPreheader(e.target.value)}
                  maxLength={140}
                  placeholder="Aparece junto al asunto en la bandeja"
                />
              </label>
              <label className="campo-lbl">
                Mensaje
                <textarea
                  className="campo editor-email"
                  rows={12}
                  value={cuerpo}
                  onChange={(e) => setCuerpo(e.target.value)}
                  placeholder={"Hola {{nombre}},\n\nEscribe aquí tu mensaje…"}
                />
              </label>
              <div className="chips variables">
                {VARS.map((v) => (
                  <button className="chip" key={v} onClick={() => insertar(v)}>
                    {v}
                  </button>
                ))}
              </div>
              <div className="programar">
                <label className="campo-lbl">
                  Programar envío
                  <input
                    className="campo"
                    type="datetime-local"
                    value={programada}
                    min={new Date().toISOString().slice(0, 16)}
                    onChange={(e) => setProgramada(e.target.value)}
                  />
                </label>
                <button
                  className="btn"
                  disabled={enviando}
                  onClick={() => guardarProgramar(false)}
                >
                  {Ico.reuniones({ t: 15 })} Programar
                </button>
                <button
                  className="btn solido"
                  disabled={enviando}
                  onClick={() => guardarProgramar(true)}
                >
                  {Ico.correos({ t: 15 })}{" "}
                  {enviando ? "Enviando…" : `Enviar ahora · ${elegidos.length}`}
                </button>
              </div>
            </section>
            <section className="bloque audiencia-selector">
              <h3>Destinatarios</h3>
              <p className="tenue">
                Solo se envía a quienes tienen consentimiento activo.
              </p>
              <div className="chips">
                <button
                  className="chip"
                  onClick={() =>
                    setSel(
                      new Set(
                        audiencia
                          .filter((x) => x.estado === "suscrito")
                          .map((x) => x.id),
                      ),
                    )
                  }
                >
                  Todos los suscritos
                </button>
                <button className="chip" onClick={() => setSel(new Set())}>
                  Ninguno
                </button>
              </div>
              <div className="lista-sel">
                {audiencia.map((c) => (
                  <label
                    className={
                      "fila-sel" +
                      (c.estado !== "suscrito" ? " deshabilitada" : "")
                    }
                    key={c.id}
                  >
                    <input
                      type="checkbox"
                      disabled={c.estado !== "suscrito"}
                      checked={sel.has(c.id)}
                      onChange={() => {
                        const n = new Set(sel);
                        if (n.has(c.id)) n.delete(c.id);
                        else n.add(c.id);
                        setSel(n);
                      }}
                    />
                    <span>
                      <b>{c.nombre || c.empresa || c.email}</b>
                      <small>
                        {c.email} · {c.estado.replace("_", " ")}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
              <div className="email-preview">
                <small>Vista previa</small>
                <b>{render(asunto, elegidos[0]) || "Tu asunto aparece aquí"}</b>
                {preheader && <em>{render(preheader, elegidos[0])}</em>}
                <p>
                  {render(cuerpo, elegidos[0]) || "Tu mensaje aparece aquí."}
                </p>
                <a>Cancelar suscripción</a>
              </div>
            </section>
          </div>
        ) : vista === "audiencia" ? (
          <section className="bloque">
            <div className="audiencia-cab">
              <div>
                <h3>Audiencia principal</h3>
                <p>
                  Una sola lista, organizada con etiquetas y estado de
                  consentimiento.
                </p>
              </div>
              <button className="btn" onClick={sincronizarClientes}>
                Sincronizar clientes
              </button>
            </div>
            <div className="aviso-consentimiento">
              <b>Importación responsable</b>
              <span>
                Al importar un CSV confirmas que estas personas aceptaron
                recibir marketing. Las bajas y rebotes nunca se reactivan
                automáticamente.
              </span>
            </div>
            <div className="tabla-caja scroll-x">
              <table>
                <thead>
                  <tr>
                    <th>Contacto</th>
                    <th>Empresa</th>
                    <th>Etiquetas</th>
                    <th>Fuente</th>
                    <th>Consentimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {audiencia.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <b>{c.nombre || "Sin nombre"}</b>
                        <small>{c.email}</small>
                      </td>
                      <td>{c.empresa || "—"}</td>
                      <td>
                        <div className="etiquetas">
                          {c.etiquetas?.map((x) => (
                            <em key={x}>{x}</em>
                          ))}
                        </div>
                      </td>
                      <td>{c.fuente}</td>
                      <td>
                        <span
                          className={
                            "pill " +
                            (c.estado === "suscrito"
                              ? "ok"
                              : c.estado === "baja" || c.estado === "rebotado"
                                ? "mal"
                                : "gris")
                          }
                        >
                          {c.estado.replace("_", " ")}
                        </span>
                        {c.consentimiento_en && (
                          <small>{fecha(c.consentimiento_en)}</small>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <section className="bloque">
            <h3>Historial de campañas</h3>
            {campanas.length === 0 ? (
              <p className="vacio">Todavía no hay campañas guardadas.</p>
            ) : (
              <div className="tabla-caja">
                <table>
                  <thead>
                    <tr>
                      <th>Campaña</th>
                      <th>Fecha</th>
                      <th>Estado</th>
                      <th className="num">Enviados</th>
                      <th className="num">Fallidos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campanas.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <b>{c.nombre}</b>
                          <small>{c.asunto}</small>
                        </td>
                        <td>{fecha(c.programada_para ?? c.creado_en)}</td>
                        <td>
                          <span
                            className={
                              "pill " +
                              (c.estado === "enviada"
                                ? "ok"
                                : c.estado === "programada"
                                  ? "azul"
                                  : c.estado === "cancelada"
                                    ? "mal"
                                    : "gris")
                            }
                          >
                            {c.estado}
                          </span>
                        </td>
                        <td className="num">{c.enviados ?? 0}</td>
                        <td className="num">{c.fallidos ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}
