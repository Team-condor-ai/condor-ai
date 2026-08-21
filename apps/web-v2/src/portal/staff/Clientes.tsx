import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { sb, plata, fecha, enlaceWeb } from "../lib/supabase";
import { Ico } from "../disenio/iconos";
import { MenuAcciones } from "../disenio/MenuAcciones";
import { BarraLista } from "./BarraLista";
import { EditorCliente } from "./EditorCliente";
import { PanelCliente } from "./PanelCliente";
import { Resumen, type PagoResumen } from "./Resumen";
import type { Cliente, Cobro } from "./tipos";

const FILTROS = [
  { id: "todos", texto: "Todos" },
  { id: "al_dia", texto: "Al día" },
  { id: "pendiente", texto: "Pendiente" },
  { id: "vencido", texto: "Vencido" },
  { id: "sin_cobros", texto: "Sin cobros" },
  { id: "archivado", texto: "Archivados" },
] as const;

type Filtro = (typeof FILTROS)[number]["id"];

/** Lo que hay que saber de un cliente para la lista, sacado de sus cobros. */
type Estado = "al_dia" | "pendiente" | "vencido" | "sin_cobros";

function Pill({ v }: { v: Estado }) {
  const mapa: Record<Estado, [string, string]> = {
    al_dia: ["ok", "al día"],
    pendiente: ["warn", "pendiente"],
    vencido: ["mal", "vencido"],
    sin_cobros: ["gris", "sin cobros"],
  };
  const [clase, texto] = mapa[v];
  return <span className={`pill ${clase}`}>{texto}</span>;
}

export function Clientes() {
  const [filas, setFilas] = useState<Cliente[]>([]);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [pagos, setPagos] = useState<PagoResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [orden, setOrden] = useState("recientes");
  const [editando, setEditando] = useState<Cliente | "nuevo" | null>(null);
  // EL PANEL NO NAVEGA
  // ---------------------------------------------------------------------------
  // Abrirlo cambiaba la URL (`?ver=<id>`), y eso hace que React Router vuelva a
  // montar la ruta: la lista se recargaba entera y la página saltaba al tope.
  // Se sentía como entrar a otra pantalla, que es justo lo que el panel venía a
  // evitar. Ahora es estado local y la lista ni se entera.
  //
  // El `?ver=` de la URL se sigue leyendo UNA vez al entrar, para que los
  // enlaces del Panel, de Cobros y del Mapa sigan llevando a un cliente.
  const [params] = useSearchParams();
  const [viendo, setViendo] = useState<string | null>(() => params.get("ver"));
  const verCliente = (id: string | null) => setViendo(id);

  async function cargar(silencioso = false) {
    if (!silencioso) setCargando(true);
    const [{ data, error }, { data: co, error: eco }, { data: pa }] = await Promise.all([
      sb.from("clientes").select("*").order("creado_en", { ascending: false }),
      sb.from("cobros").select("*"),
      // Solo las columnas que usan el resumen y la lista: traer `*` de una
      // tabla que crece con cada mes cobrado no aporta nada acá.
      sb.from("pagos").select("cliente_id,cobro_id,monto,estado,fecha,creado_en"),
    ]);
    // Se muestra el error REAL de Supabase, no un "algo salió mal": si RLS
    // rechaza o falta una columna, hay que poder leerlo sin abrir la consola.
    if (error) setError(error.message);
    else if (eco) setError("No se pudieron cargar los cobros: " + eco.message);
    else setError("");

    setFilas((data ?? []) as Cliente[]);
    setCobros((co ?? []) as Cobro[]);
    setPagos((pa ?? []) as PagoResumen[]);
    if (!silencioso) setCargando(false);
  }

  useEffect(() => {
    // La carga inicial sincroniza la vista con Supabase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, []);

  /**
   * El estado ya NO sale de `clientes.mensual_estado`, sino de los cobros del
   * cliente. Esa columna solo sabía de UNA mensualidad; ahora puede haber
   * varias, o ninguna, o solo cobros únicos.
   */
  const resumenDe = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    const m = new Map<
      string,
      { estado: Estado; recibido: number; proximo: string | null; n: number; nMensual: number }
    >();

    for (const c of filas) {
      const suyos = cobros.filter((x) => x.cliente_id === c.id);
      const recibido = pagos
        .filter((p) => p.cliente_id === c.id && p.estado === "pagado")
        .reduce((t, p) => t + (p.monto ?? 0), 0);

      const mensualesVivos = suyos.filter(
        (x) => x.tipo === "mensual" && (x.estado === "activa" || x.estado === "pendiente"),
      );
      const proximo = mensualesVivos
        .map((x) => x.proximo_cobro)
        .filter((f): f is string => !!f)
        .sort()[0] ?? null;

      let estado: Estado;
      if (suyos.length === 0) estado = "sin_cobros";
      else if (proximo && proximo < hoy) estado = "vencido";
      else if (suyos.some((x) => x.estado === "pendiente")) estado = "pendiente";
      else estado = "al_dia";

      m.set(c.id, {
        estado,
        recibido,
        proximo,
        n: suyos.length,
        nMensual: suyos.filter((x) => x.tipo === "mensual").length,
      });
    }
    return m;
  }, [filas, cobros, pagos]);

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return filas.filter((c) => {
      const archivado = Boolean(c.archivado);
      if (filtro === "archivado") {
        if (!archivado) return false;
      } else {
        if (archivado) return false;
        if (filtro !== "todos" && resumenDe.get(c.id)?.estado !== filtro) return false;
      }
      if (!q) return true;
      // Se busca en TODO lo que identifica a un cliente. El teléfono se compara
      // también sin separadores: nadie escribe "+56 9 1234 5678" tal cual.
      const campos = [c.negocio, c.nombre, c.email, c.telefono, c.plan, c.concepto, c.notas, c.web_url];
      const soloDigitos = q.replace(/\D/g, "");
      return (
        campos.filter(Boolean).some((t) => String(t).toLowerCase().includes(q)) ||
        (soloDigitos.length >= 3 && (c.telefono ?? "").replace(/\D/g, "").includes(soloDigitos))
      );
    });
  }, [filas, busca, filtro, resumenDe]);

  const ordenados = useMemo(() => {
    const r = [...visibles];
    const dato = (c: Cliente) => resumenDe.get(c.id);
    const orden3 = { vencido: 0, pendiente: 1, al_dia: 2, sin_cobros: 3 } as Record<string, number>;
    r.sort((a, b) => {
      switch (orden) {
        case "recaudado":
          return (dato(b)?.recibido ?? 0) - (dato(a)?.recibido ?? 0);
        case "proximo": {
          // Sin fecha va al final: "no tiene próximo cobro" no es "el más
          // próximo", que es lo que pasaría ordenando cadenas vacías primero.
          const x = dato(a)?.proximo, y = dato(b)?.proximo;
          if (!x && !y) return 0;
          if (!x) return 1;
          if (!y) return -1;
          return x.localeCompare(y);
        }
        case "vencidos":
          return (orden3[dato(a)?.estado ?? "sin_cobros"] ?? 9) - (orden3[dato(b)?.estado ?? "sin_cobros"] ?? 9);
        case "nombre":
          return (a.negocio || a.nombre || "").localeCompare(b.negocio || b.nombre || "");
        default:
          return String(b.creado_en ?? "").localeCompare(String(a.creado_en ?? ""));
      }
    });
    return r;
  }, [visibles, orden, resumenDe]);

  const cuenta = useMemo(() => {
    const n: Record<string, number> = { todos: 0, archivado: 0 };
    for (const c of filas) {
      if (c.archivado) n.archivado++;
      else {
        n.todos++;
        const e = resumenDe.get(c.id)?.estado ?? "sin_cobros";
        n[e] = (n[e] ?? 0) + 1;
      }
    }
    return n;
  }, [filas, resumenDe]);

  async function archivar(c: Cliente, valor: boolean) {
    // Se ARCHIVA, no se borra. `pagos` y `cobros` cuelgan de `clientes` con
    // `on delete cascade`: borrar la ficha se lleva el historial, y un cliente
    // que se fue sigue siendo contabilidad.
    const { error } = await sb.from("clientes").update({ archivado: valor }).eq("id", c.id);
    if (error) setError(error.message);
    else void cargar(true);
  }

  async function eliminar(c: Cliente) {
    // Esto SÍ borra, y se lleva cobros e historial de pagos por el cascade. Por
    // eso pide confirmación con el nombre a la vista: no hay deshacer.
    const nombre = c.negocio || c.nombre || c.email || "este cliente";
    const r = resumenDe.get(c.id);
    const ok = window.confirm(
      `Vas a eliminar "${nombre}" para siempre, junto con sus ${r?.n ?? 0} cobro(s) y ` +
        `todo su historial de pagos (${plata(r?.recibido ?? 0, c.moneda)} recibidos).\n\n` +
        `Esto NO se puede deshacer. Si solo quieres dejar de verlo en la lista, ` +
        `usa "Archivar" en vez de esto.\n\n¿Eliminar de todas formas?`,
    );
    if (!ok) return;
    const { error } = await sb.from("clientes").delete().eq("id", c.id);
    if (error) setError(error.message);
    else void cargar(true);
  }

  return (
    <>
      <div className="barra">
        <h1>Clientes</h1>
        <button className="btn solido" onClick={() => setEditando("nuevo")}>
          {Ico.mas({ t: 15 })} Nuevo cliente
        </button>
      </div>


      <div className="cuerpo">
        {error && <p className="error">{error}</p>}

        {!cargando && filas.length > 0 && (
          <Resumen clientes={filas} cobros={cobros} pagos={pagos} />
        )}

        {/* La barra vive DONDE están los clientes, no al tope de la
            pantalla: allá queda lejos de lo que filtra, con las gráficas en
            medio, y ni siquiera se ven juntos. */}
        <BarraLista
          busca={busca}
          setBusca={setBusca}
          marcador="Buscar por nombre, correo, teléfono, plan o nota…"
          orden={orden}
          setOrden={setOrden}
          ordenes={[
            { id: "recientes", texto: "Más recientes" },
            { id: "recaudado", texto: "Más recaudado" },
            { id: "proximo", texto: "Cobro más próximo" },
            { id: "vencidos", texto: "Vencidos primero" },
            { id: "nombre", texto: "Nombre (A-Z)" },
          ]}
          resultado={busca ? `${ordenados.length} de ${filas.length}` : undefined}
          chips={FILTROS.map((f) => (
            <button
              key={f.id}
              className={"chip" + (filtro === f.id ? " on" : "")}
              onClick={() => setFiltro(f.id)}
            >
              {f.texto}
              <span>{cuenta[f.id] ?? 0}</span>
            </button>
          ))}
        />

        {cargando && <p className="vacio">Cargando…</p>}

        {!cargando && ordenados.length === 0 && (
          <p className="vacio">
            {filas.length === 0
              ? "Todavía no hay clientes. Crea el primero."
              : "Ningún cliente calza con ese filtro."}
          </p>
        )}

        {!cargando && ordenados.length > 0 && (
          <div className="tabla-caja">
            <table>
              <thead>
                <tr>
                  <th>Negocio</th>
                  <th>Plan</th>
                  <th>Cobros</th>
                  <th className="num">Recibido</th>
                  <th>Estado</th>
                  <th>Próximo cobro</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {ordenados.map((c) => {
                  const r = resumenDe.get(c.id);
                  return (
                    <tr key={c.id}>
                      <td>
                        <button
                          className="enlace-tabla"
                          onClick={() => verCliente(c.id)}
                          style={{ background: "none", border: 0, padding: 0, font: "inherit", cursor: "pointer", textAlign: "left", width: "100%" }}
                        >
                          <b>{c.negocio || c.nombre || "—"}</b>
                          {/* Debajo va el contacto: el correo si lo hay, si no
                              el nombre. Sin correo se dice explícitamente, para
                              no confundir "no tiene" con "no se cargó". */}
                          <small>
                            {c.email || (c.negocio && c.nombre) || "sin correo · no entra al portal"}
                          </small>
                        </button>
                      </td>
                      <td>{c.plan || "—"}</td>
                      <td>
                        {r?.n
                          ? `${r.n}${r.nMensual ? ` · ${r.nMensual} mensual${r.nMensual === 1 ? "" : "es"}` : ""}`
                          : "—"}
                      </td>
                      <td className="num">{plata(r?.recibido, c.moneda)}</td>
                      <td><Pill v={r?.estado ?? "sin_cobros"} /></td>
                      <td>{r?.proximo ? fecha(r.proximo) : "—"}</td>
                      <td className="acciones">
                        {/* "Ver" va SUELTO y no dentro de los tres puntitos:
                            es lo que se hace todo el rato, y esconder la
                            acción principal detrás de un menú la cobra dos
                            clics cada vez. Lo demás sí va adentro. */}
                        <button className="btn chico" onClick={() => verCliente(c.id)}>
                          Ver
                        </button>
                        <MenuAcciones
                          etiqueta={`Acciones de ${c.negocio || c.nombre || "el cliente"}`}
                          acciones={[
                            ...(c.telefono
                              ? [{
                                  texto: "Escribir por WhatsApp",
                                  icono: Ico.chat({ t: 15 }),
                                  href: `https://wa.me/${c.telefono.replace(/\D/g, "")}`,
                                }]
                              : []),
                            ...(c.web_url
                              ? [{
                                  texto: "Abrir su sitio web",
                                  icono: Ico.abrirWeb({ t: 15 }),
                                  href: enlaceWeb(c.web_url),
                                }]
                              : []),
                            {
                              texto: c.archivado ? "Restaurar" : "Archivar",
                              icono: c.archivado ? Ico.volver({ t: 15 }) : Ico.archivar({ t: 15 }),
                              onClick: () => archivar(c, !c.archivado),
                              separar: true,
                            },
                            {
                              texto: "Eliminar para siempre",
                              icono: Ico.eliminar({ t: 15 }),
                              onClick: () => eliminar(c),
                              peligro: true,
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viendo && (
        <PanelCliente
          id={viendo}
          cerrar={() => setViendo(null)}
          cambiado={() => void cargar(true)}
        />
      )}

      {editando && (
        <EditorCliente
          cliente={editando === "nuevo" ? null : editando}
          cerrar={() => setEditando(null)}
          guardado={() => {
            setEditando(null);
            void cargar(true);
          }}
        />
      )}
    </>
  );
}
