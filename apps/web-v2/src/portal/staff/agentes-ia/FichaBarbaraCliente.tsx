import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { sb, fecha } from "../../lib/supabase";
import { Ico } from "../../disenio/iconos";
import { useSesion } from "../../auth/sesion";
import { ChatVisor } from "../../agentes-ia/ChatVisor";
import { BrandBookEditor } from "./BrandBookEditor";
import { ReglasAprendidas } from "../../agentes-ia/ReglasAprendidas";
import {
  BARBARA_PLANES,
  BARBARA_PLAN_INFO,
  infoPlan,
  TIPOS_CONTENIDO,
  PILARES_CONTENIDO,
  type BarbaraBrandBook,
  type BarbaraCliente,
  type BarbaraCorrecciones,
  type BarbaraFormulario,
} from "../../agentes-ia/tipos";

type Cargado = {
  cliente: BarbaraCliente;
  negocio: string;
  email: string;
  brandBook: BarbaraBrandBook | null;
  formulario: BarbaraFormulario | null;
  correcciones: BarbaraCorrecciones | null;
};

// PostgREST devuelve la fila 1-a-1 como objeto cuando detecta la unique
// constraint, pero a veces (según versión) la manda como arreglo de 1. Se
// normaliza igual que hace `services/barbara/clientes.mjs` del lado del
// motor, para no depender de cuál forma llegó.
function uno<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export function FichaBarbaraCliente() {
  const { id } = useParams();
  const sesion = useSesion();
  const [d, setD] = useState<Cargado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"marca" | "formulario" | "aprendido">("marca");

  // Edición de datos básicos
  const [plan, setPlan] = useState("barbara");
  const [rubro, setRubro] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [activo, setActivo] = useState(true);
  const [guardandoDatos, setGuardandoDatos] = useState(false);
  const [errorDatos, setErrorDatos] = useState("");
  const [okDatos, setOkDatos] = useState(false);

  const [desbloqueando, setDesbloqueando] = useState(false);
  const [errorDesbloqueo, setErrorDesbloqueo] = useState("");

  async function cargar() {
    setCargando(true);
    setError("");
    const { data, error } = await sb
      .from("barbara_clientes")
      .select(
        "*, clientes(negocio,email), barbara_brand_book(*), barbara_formulario(*), barbara_correcciones(*)",
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      setError(error.message);
      setCargando(false);
      return;
    }
    if (!data) {
      setD(null);
      setCargando(false);
      return;
    }

    const fila = data as unknown as BarbaraCliente & {
      clientes: { negocio: string | null; email: string } | null;
      barbara_brand_book: BarbaraBrandBook | BarbaraBrandBook[] | null;
      barbara_formulario: BarbaraFormulario | BarbaraFormulario[] | null;
      barbara_correcciones: BarbaraCorrecciones | BarbaraCorrecciones[] | null;
    };

    const cargado: Cargado = {
      cliente: fila,
      negocio: fila.clientes?.negocio || fila.clientes?.email || "—",
      email: fila.clientes?.email || "",
      brandBook: uno(fila.barbara_brand_book),
      formulario: uno(fila.barbara_formulario),
      correcciones: uno(fila.barbara_correcciones),
    };
    setD(cargado);
    setPlan(cargado.cliente.plan);
    setRubro(cargado.cliente.rubro ?? "");
    setTelegramChatId(cargado.cliente.telegram_chat_id ?? "");
    setActivo(Boolean(cargado.cliente.activo));
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function guardarDatos() {
    setGuardandoDatos(true);
    setErrorDatos("");
    setOkDatos(false);
    const { error } = await sb
      .from("barbara_clientes")
      .update({
        plan,
        rubro: rubro || null,
        telegram_chat_id: telegramChatId.trim() || null,
        activo,
      })
      .eq("id", id);
    setGuardandoDatos(false);
    if (error) setErrorDatos(error.message);
    else {
      setOkDatos(true);
      cargar();
    }
  }

  async function desbloquear() {
    if (!d?.correcciones) return;
    setDesbloqueando(true);
    setErrorDesbloqueo("");
    const { error } = await sb
      .from("barbara_correcciones")
      .update({
        intentos_usados: 0,
        bloqueado: false,
        desbloqueado_por: sesion.email ?? "staff",
        actualizado_en: new Date().toISOString(),
      })
      .eq("barbara_cliente_id", id);
    setDesbloqueando(false);
    if (error) setErrorDesbloqueo(error.message);
    else cargar();
  }

  if (cargando) return <div className="cuerpo"><p className="vacio">Cargando…</p></div>;
  if (error) return <div className="cuerpo"><p className="error">{error}</p></div>;
  if (!d)
    return (
      <div className="cuerpo">
        <p className="vacio">Ese cliente de Bárbara no existe o no tienes acceso.</p>
      </div>
    );

  return (
    <>
      <div className="barra">
        <Link to="/acceso/agentes-ia" className="icono-btn" title="Volver">
          {Ico.volver({ t: 16 })}
        </Link>
        <h1>{d.negocio}</h1>
        <span className={"pill " + infoPlan(d.cliente.plan).pill}>{infoPlan(d.cliente.plan).nombre}</span>
        <span className={"pill " + (d.cliente.activo ? "ok" : "gris")}>
          {d.cliente.activo ? "Activo" : "Inactivo"}
        </span>
      </div>

      <div className="cuerpo">
        {d.correcciones?.bloqueado && (
          <div className="caja-baja" style={{ marginBottom: 18 }}>
            <h4>{Ico.candado({ t: 14 })} Bloqueado por reintentos de corrección</h4>
            <p className="parrafo">
              Este cliente agotó los 3 intentos de corrección y Bárbara dejó
              de generar contenido nuevo para él hasta que se desbloquee.
            </p>
            {errorDesbloqueo && <p className="error">{errorDesbloqueo}</p>}
            <button className="btn peligro" onClick={desbloquear} disabled={desbloqueando}>
              {desbloqueando ? "Desbloqueando…" : "Desbloquear"}
            </button>
          </div>
        )}

        <section className="bloque">
          <h3>Datos</h3>
          <div className="dos">
            <label className="campo-lbl">
              Plan
              <select className="campo" value={plan} onChange={(e) => setPlan(e.target.value)}>
                {BARBARA_PLANES.map((p) => (
                  <option key={p} value={p}>
                    {BARBARA_PLAN_INFO[p].nombre}
                    {BARBARA_PLAN_INFO[p].nota ? ` — ${BARBARA_PLAN_INFO[p].nota}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="campo-lbl">
              Rubro
              <input className="campo" value={rubro} onChange={(e) => setRubro(e.target.value)} />
            </label>
          </div>
          <div className="dos" style={{ marginTop: 12 }}>
            <label className="campo-lbl">
              Telegram chat ID
              <input
                className="campo"
                placeholder="Se completa al crear el grupo de Telegram"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
              />
              <small>Staff lo completa a mano después de crear el grupo del cliente.</small>
            </label>
            <label className="campo-lbl">
              Estado
              <select
                className="campo"
                value={activo ? "activo" : "inactivo"}
                onChange={(e) => setActivo(e.target.value === "activo")}
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </label>
          </div>
          <div className="dato" style={{ marginTop: 12 }}>
            <small>Correo del cliente</small>
            <b>{d.email}</b>
          </div>

          {errorDatos && <p className="error">{errorDatos}</p>}
          {okDatos && <p className="ok-msg">Guardado.</p>}
          <div style={{ marginTop: 12 }}>
            <button className="btn solido" onClick={guardarDatos} disabled={guardandoDatos}>
              {guardandoDatos ? "Guardando…" : "Guardar datos"}
            </button>
          </div>
        </section>

        <section className="bloque">
          <div className="pestanas" style={{ maxWidth: 340, marginBottom: 14 }}>
            <button
              type="button"
              className={"pestana" + (tab === "marca" ? " on" : "")}
              onClick={() => setTab("marca")}
            >
              Brand book
            </button>
            <button
              type="button"
              className={"pestana" + (tab === "formulario" ? " on" : "")}
              onClick={() => setTab("formulario")}
            >
              Formulario de entrada
            </button>
            <button
              type="button"
              className={"pestana" + (tab === "aprendido" ? " on" : "")}
              onClick={() => setTab("aprendido")}
            >
              Lo aprendido
            </button>
          </div>

          {tab === "marca" ? (
            <BrandBookEditor
              barbaraClienteId={d.cliente.id}
              negocio={d.negocio}
              rubro={d.cliente.rubro}
              inicial={d.brandBook}
              onGuardado={cargar}
            />
          ) : tab === "formulario" ? (
            <FormularioSoloLectura formulario={d.formulario} />
          ) : (
            /* Staff SÍ puede apagar una regla: una mal destilada empeora todo
               el contenido siguiente. El cliente solo la ve. */
            <ReglasAprendidas barbaraClienteId={d.cliente.id} puedeApagar />
          )}
        </section>

        <section className="bloque">
          <h3>Conversación</h3>
          <ChatVisor barbaraClienteId={d.cliente.id} />
        </section>
      </div>
    </>
  );
}

/**
 * El formulario lo llena y edita el CLIENTE desde su portal (ver
 * `cliente/Barbara.tsx`) — acá staff solo lo revisa. El dueño principal del
 * dato es el cliente, así que no se ofrece edición doble.
 */
function FormularioSoloLectura({ formulario }: { formulario: BarbaraFormulario | null }) {
  if (!formulario)
    return (
      <p className="vacio">
        El cliente todavía no llenó su formulario de entrada desde el portal.
      </p>
    );

  const tipos = (formulario.tipo_contenido ?? [])
    .map((id) => TIPOS_CONTENIDO.find((t) => t.id === id)?.texto ?? id)
    .join(", ");

  // La mezcla se guarda como pesos crudos, no normalizada (para que el cliente
  // vea los mismos números que puso). Acá se muestra el porcentaje real, que
  // es lo que de verdad va a respetar el motor.
  const pesos = formulario.pilares ?? null;
  const totalPilares = pesos
    ? PILARES_CONTENIDO.reduce((s, p) => s + (pesos[p.id] || 0), 0)
    : 0;
  const mezcla = totalPilares
    ? PILARES_CONTENIDO
        .filter((p) => (pesos?.[p.id] || 0) > 0)
        .map((p) => `${p.nombre} ${Math.round(((pesos![p.id] || 0) / totalPilares) * 100)}%`)
        .join(" · ")
    : "";

  return (
    <div className="rejilla-datos">
      <div className="dato">
        <small>Tipo de contenido</small>
        <b>{tipos || "—"}</b>
      </div>
      <div className="dato">
        <small>Mezcla de contenido</small>
        <b>{mezcla || "— (usa la mezcla por defecto)"}</b>
      </div>
      <div className="dato">
        <small>Público objetivo</small>
        <b>{formulario.publico_objetivo || "—"}</b>
      </div>
      <div className="dato">
        <small>Tono</small>
        <b>{formulario.tono || "—"}</b>
      </div>
      <div className="dato">
        <small>Restricciones</small>
        <b>{formulario.restricciones || "—"}</b>
      </div>
      <div className="dato">
        <small>Ejemplos de referencia</small>
        <b>{formulario.ejemplos_referencia || "—"}</b>
      </div>
      <div className="dato">
        <small>Producto/servicio a destacar</small>
        <b>{formulario.producto_destacar || "—"}</b>
      </div>
      <div className="dato">
        <small>Actualizado</small>
        <b>{fecha(formulario.actualizado_en)}</b>
      </div>
    </div>
  );
}
