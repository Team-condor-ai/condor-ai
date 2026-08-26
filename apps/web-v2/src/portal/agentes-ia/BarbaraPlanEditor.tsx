import { useMemo, useState, type FormEvent } from "react";
import { sb } from "../lib/supabase";
import { BARBARA_CUOTAS, PILARES_CONTENIDO, PLANTILLAS_CARRUSEL } from "./tipos";
import {
  crearOcurrenciasContenido,
  DIAS_CONTENIDO,
  fechaLocal,
  inputEnZona,
  resumenReglas,
  sumarMeses,
  type ReglaSemanalContenido,
} from "./barbaraCalendarioUtils";

export type TipoPlanBarbara = "carrusel" | "historia" | "ugc";

export type PlanBarbaraEditable = {
  id: string;
  tipo: TipoPlanBarbara;
  plataforma: string;
  programada_para: string;
  zona_horaria: string;
  titulo: string | null;
  brief: string | null;
  configuracion: Record<string, unknown> | null;
};

type Props = {
  barbaraClienteId: string;
  plan: string;
  zonaHoraria: string;
  existente?: PlanBarbaraEditable | null;
  cerrar: () => void;
  guardado: () => void;
};

const FORMATOS: { id: TipoPlanBarbara; nombre: string; ayuda: string }[] = [
  { id: "carrusel", nombre: "Carrusel", ayuda: "Secuencia editorial de 4–10 slides." },
  { id: "historia", nombre: "Historia", ayuda: "Pieza vertical con interacción opcional." },
  { id: "ugc", nombre: "Video UGC", ayuda: "Reel 9:16 con 2–3 tomas a cámara." },
];

const CANALES: Record<TipoPlanBarbara, { id: string; nombre: string }[]> = {
  carrusel: [
    { id: "instagram", nombre: "Instagram" },
    { id: "facebook", nombre: "Facebook" },
    { id: "linkedin", nombre: "LinkedIn" },
  ],
  historia: [
    { id: "instagram", nombre: "Instagram" },
    { id: "facebook", nombre: "Facebook" },
  ],
  ugc: [
    { id: "instagram", nombre: "Instagram Reels" },
    { id: "tiktok", nombre: "TikTok" },
  ],
};

const configuracionInicial = (tipo: TipoPlanBarbara): Record<string, unknown> => ({
  objetivo: "educar",
  pilar: "educar",
  mensaje_clave: "",
  llamada_accion: "",
  incluir: "",
  evitar: "",
  ...(tipo === "carrusel" ? { slides: 6, plantilla: "editorial" } : {}),
  ...(tipo === "historia" ? { interaccion: "ninguna", texto_interaccion: "" } : {}),
  ...(tipo === "ugc" ? {
    tomas: 3, segundos_por_toma: 5, hook: "", escenario: "",
    estilo: "selfie natural", privacidad: "PUBLIC_TO_EVERYONE",
    permitir_comentarios: true, permitir_duet: false, permitir_stitch: false,
    contenido_ia: true,
  } : {}),
});

function manana() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return fechaLocal(d);
}

export function BarbaraPlanEditor({
  barbaraClienteId, plan, zonaHoraria, existente, cerrar, guardado,
}: Props) {
  const cuotas = BARBARA_CUOTAS[plan] ?? BARBARA_CUOTAS.barbara;
  const primerFormato = FORMATOS.find((f) => (cuotas[f.id] ?? 0) > 0)?.id ?? "carrusel";
  const [tipo, setTipo] = useState<TipoPlanBarbara>(existente?.tipo ?? primerFormato);
  const [plataforma, setPlataforma] = useState(existente?.plataforma ?? CANALES[existente?.tipo ?? primerFormato][0].id);
  const [titulo, setTitulo] = useState(existente?.titulo ?? "");
  const [brief, setBrief] = useState(existente?.brief ?? "");
  const [configuracion, setConfiguracion] = useState<Record<string, unknown>>(
    () => ({ ...configuracionInicial(existente?.tipo ?? primerFormato), ...(existente?.configuracion ?? {}) }),
  );
  const fechaExistente = existente ? inputEnZona(existente.programada_para, existente.zona_horaria) : null;
  const [fecha, setFecha] = useState(fechaExistente?.slice(0, 10) ?? manana());
  const [hora, setHora] = useState(fechaExistente?.slice(11, 16) ?? "10:00");
  const [repite, setRepite] = useState(false);
  const [desde, setDesde] = useState(manana());
  const [hasta, setHasta] = useState(() => sumarMeses(manana(), 2));
  const [reglas, setReglas] = useState<ReglaSemanalContenido[]>([{ dia: 4, hora: "18:00" }]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const limite = cuotas[tipo] ?? 0;
  const resumen = useMemo(() => resumenReglas(reglas), [reglas]);

  const poner = (clave: string, valor: unknown) =>
    setConfiguracion((actual) => ({ ...actual, [clave]: valor }));

  function cambiarTipo(nuevo: TipoPlanBarbara) {
    setTipo(nuevo);
    setPlataforma(CANALES[nuevo][0].id);
    setConfiguracion(configuracionInicial(nuevo));
  }

  function alternarDia(dia: number) {
    setReglas((actuales) => actuales.some((r) => r.dia === dia)
      ? actuales.filter((r) => r.dia !== dia)
      : [...actuales, { dia, hora: "10:00" }]);
  }

  function cambiarHoraDia(dia: number, nueva: string) {
    setReglas((actuales) => actuales.map((r) => r.dia === dia ? { ...r, hora: nueva } : r));
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError("");
    if (!limite) {
      setError(`El plan actual no incluye ${FORMATOS.find((f) => f.id === tipo)?.nombre}.`);
      return;
    }
    setGuardando(true);
    try {
      if (existente) {
        const { error: errorPlan } = await sb.rpc("barbara_actualizar_plan", {
          p_programacion_id: existente.id,
          p_plataforma: plataforma,
          p_titulo: titulo.trim(),
          p_brief: brief.trim() || null,
          p_configuracion: configuracion,
        });
        if (errorPlan) throw errorPlan;
        const nuevaFecha = crearOcurrenciasContenido({
          repite: false, fecha, hora, desde, hasta, reglas, zonaHoraria,
        })[0];
        if (nuevaFecha !== existente.programada_para) {
          const { error: errorHora } = await sb.rpc("barbara_reprogramar", {
            p_programacion_id: existente.id,
            p_programada_para: nuevaFecha,
            p_motivo: "Edición del plan desde el calendario",
          });
          if (errorHora) throw errorHora;
        }
      } else {
        const ocurrencias = crearOcurrenciasContenido({
          repite, fecha, hora, desde, hasta, reglas, zonaHoraria,
        });
        const { error: errorCrear } = await sb.rpc("barbara_crear_planes", {
          p_barbara_cliente_id: barbaraClienteId,
          p_tipo: tipo,
          p_plataforma: plataforma,
          p_ocurrencias: ocurrencias,
          p_zona_horaria: zonaHoraria,
          p_titulo: titulo.trim(),
          p_brief: brief.trim() || null,
          p_configuracion: configuracion,
          p_recurrencia_reglas: repite ? reglas : null,
          p_recurrencia_desde: repite ? desde : null,
          p_recurrencia_hasta: repite ? hasta : null,
        });
        if (errorCrear) throw errorCrear;
      }
      guardado();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : String((fallo as { message?: string })?.message || "No se pudo guardar el plan."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="velo" onClick={cerrar}>
      <form className="panel-modal barbara-plan-editor" onClick={(e) => e.stopPropagation()} onSubmit={enviar}>
        <header>
          <div>
            <span className="barbara-rotulo">Planificación editorial</span>
            <h2>{existente ? "Editar contenido" : "Crear contenido"}</h2>
          </div>
          <span className="pill gris">{zonaHoraria}</span>
        </header>

        <div className="contenido">
          {!existente && (
            <div className="barbara-plan-formatos" aria-label="Formato de contenido">
              {FORMATOS.map((formato) => {
                const disponible = (cuotas[formato.id] ?? 0) > 0;
                return (
                  <button key={formato.id} type="button" disabled={!disponible}
                    className={tipo === formato.id ? "activo" : ""}
                    onClick={() => cambiarTipo(formato.id)}>
                    <b>{formato.nombre}</b>
                    <small>{disponible ? formato.ayuda : "No incluido en tu plan"}</small>
                  </button>
                );
              })}
            </div>
          )}

          <div className="barbara-plan-dos">
            <label className="campo-lbl">Nombre del plan
              <input className="campo" autoFocus required maxLength={180} value={titulo}
                onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Errores comunes al vender por Instagram" />
            </label>
            <label className="campo-lbl">Canal
              <select className="campo" value={plataforma} onChange={(e) => setPlataforma(e.target.value)}>
                {CANALES[tipo].map((canal) => <option key={canal.id} value={canal.id}>{canal.nombre}</option>)}
              </select>
            </label>
          </div>

          <label className="campo-lbl">Brief para Bárbara
            <textarea className="campo" rows={3} maxLength={4000} value={brief} onChange={(e) => setBrief(e.target.value)}
              placeholder="Qué debe entender la audiencia, contexto de la campaña y cualquier dato verificable que deba usar." />
          </label>

          <section className="barbara-plan-personalizacion">
            <header><b>Dirección creativa</b><small>Estos datos entrarán al prompt cuando Bárbara produzca la pieza.</small></header>
            <div className="barbara-plan-tres">
              <label className="campo-lbl">Pilar
                <select className="campo" value={String(configuracion.pilar ?? "educar")} onChange={(e) => poner("pilar", e.target.value)}>
                  {PILARES_CONTENIDO.map((p) => <option value={p.id} key={p.id}>{p.nombre}</option>)}
                </select>
              </label>
              <label className="campo-lbl">Objetivo
                <select className="campo" value={String(configuracion.objetivo ?? "educar")} onChange={(e) => poner("objetivo", e.target.value)}>
                  <option value="educar">Educar</option><option value="alcance">Ganar alcance</option>
                  <option value="interaccion">Generar interacción</option><option value="conversion">Convertir</option>
                </select>
              </label>
              <label className="campo-lbl">Llamado a la acción
                <input className="campo" value={String(configuracion.llamada_accion ?? "")} onChange={(e) => poner("llamada_accion", e.target.value)} placeholder="Ej. Guarda esta guía" />
              </label>
            </div>
            <label className="campo-lbl">Mensaje clave
              <input className="campo" value={String(configuracion.mensaje_clave ?? "")} onChange={(e) => poner("mensaje_clave", e.target.value)} placeholder="La idea que debe quedar después de ver la pieza" />
            </label>

            {tipo === "carrusel" && (
              <div className="barbara-plan-dos">
                <label className="campo-lbl">Cantidad de slides
                  <input className="campo" type="number" min={4} max={10} value={Number(configuracion.slides ?? 6)} onChange={(e) => poner("slides", Number(e.target.value))} />
                </label>
                <label className="campo-lbl">Plantilla
                  <select className="campo" value={String(configuracion.plantilla ?? "editorial")} onChange={(e) => poner("plantilla", e.target.value)}>
                    {PLANTILLAS_CARRUSEL.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </label>
              </div>
            )}

            {tipo === "historia" && (
              <div className="barbara-plan-dos">
                <label className="campo-lbl">Interacción
                  <select className="campo" value={String(configuracion.interaccion ?? "ninguna")} onChange={(e) => poner("interaccion", e.target.value)}>
                    <option value="ninguna">Sin sticker</option><option value="encuesta">Encuesta</option>
                    <option value="preguntas">Caja de preguntas</option><option value="link">Enlace</option>
                  </select>
                </label>
                <label className="campo-lbl">Texto de interacción
                  <input className="campo" value={String(configuracion.texto_interaccion ?? "")} onChange={(e) => poner("texto_interaccion", e.target.value)} placeholder="Pregunta, opciones o URL" />
                </label>
              </div>
            )}

            {tipo === "ugc" && (
              <>
                <div className="barbara-plan-tres">
                  <label className="campo-lbl">Tomas
                    <select className="campo" value={Number(configuracion.tomas ?? 3)} onChange={(e) => poner("tomas", Number(e.target.value))}>
                      <option value={2}>2 tomas</option><option value={3}>3 tomas</option>
                    </select>
                  </label>
                  <label className="campo-lbl">Segundos por toma
                    <select className="campo" value={Number(configuracion.segundos_por_toma ?? 5)} onChange={(e) => poner("segundos_por_toma", Number(e.target.value))}>
                      <option value={4}>4 s</option><option value={5}>5 s</option><option value={6}>6 s</option>
                    </select>
                  </label>
                  <label className="campo-lbl">Estilo
                    <select className="campo" value={String(configuracion.estilo ?? "selfie natural")} onChange={(e) => poner("estilo", e.target.value)}>
                      <option>selfie natural</option><option>demostración de producto</option><option>testimonio</option><option>voice-over</option>
                    </select>
                  </label>
                </div>
                <div className="barbara-plan-dos">
                  <label className="campo-lbl">Hook de los primeros segundos
                    <input className="campo" value={String(configuracion.hook ?? "")} onChange={(e) => poner("hook", e.target.value)} placeholder="Frase exacta o intención del gancho" />
                  </label>
                  <label className="campo-lbl">Escenario / producto en cámara
                    <input className="campo" value={String(configuracion.escenario ?? "")} onChange={(e) => poner("escenario", e.target.value)} placeholder="Lugar, persona y producto que debe aparecer" />
                  </label>
                </div>
                {plataforma === "tiktok" && (
                  <div className="barbara-plan-tiktok">
                    <label className="campo-lbl">Privacidad
                      <select className="campo" value={String(configuracion.privacidad ?? "PUBLIC_TO_EVERYONE")} onChange={(e) => poner("privacidad", e.target.value)}>
                        <option value="PUBLIC_TO_EVERYONE">Público</option><option value="MUTUAL_FOLLOW_FRIENDS">Amigos</option>
                        <option value="FOLLOWER_OF_CREATOR">Seguidores</option><option value="SELF_ONLY">Sólo yo</option>
                      </select>
                    </label>
                    <label><input type="checkbox" checked={Boolean(configuracion.permitir_comentarios)} onChange={(e) => poner("permitir_comentarios", e.target.checked)} /> Comentarios</label>
                    <label><input type="checkbox" checked={Boolean(configuracion.permitir_duet)} onChange={(e) => poner("permitir_duet", e.target.checked)} /> Duet</label>
                    <label><input type="checkbox" checked={Boolean(configuracion.permitir_stitch)} onChange={(e) => poner("permitir_stitch", e.target.checked)} /> Stitch</label>
                    <label><input type="checkbox" checked={Boolean(configuracion.contenido_ia)} onChange={(e) => poner("contenido_ia", e.target.checked)} /> Etiquetar IA</label>
                  </div>
                )}
              </>
            )}

            <div className="barbara-plan-dos">
              <label className="campo-lbl">Debe incluir
                <input className="campo" value={String(configuracion.incluir ?? "")} onChange={(e) => poner("incluir", e.target.value)} placeholder="Datos, producto, oferta o frase obligatoria" />
              </label>
              <label className="campo-lbl">Debe evitar
                <input className="campo" value={String(configuracion.evitar ?? "")} onChange={(e) => poner("evitar", e.target.value)} placeholder="Claims, palabras, visuales o temas prohibidos" />
              </label>
            </div>
          </section>

          {!existente && (
            <div className="selector-recurrencia" aria-label="Frecuencia del contenido">
              <button type="button" className={!repite ? "activo" : ""} onClick={() => setRepite(false)}>Una vez</button>
              <button type="button" className={repite ? "activo" : ""} onClick={() => setRepite(true)}>Se repite</button>
            </div>
          )}

          {!repite || existente ? (
            <div className="barbara-plan-dos">
              <label className="campo-lbl">Fecha<input className="campo" type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
              <label className="campo-lbl">Hora<input className="campo" type="time" step="300" required value={hora} onChange={(e) => setHora(e.target.value)} /></label>
            </div>
          ) : (
            <section className="barbara-plan-recurrencia">
              <div className="barbara-plan-dos">
                <label className="campo-lbl">Desde<input className="campo" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
                <label className="campo-lbl">Hasta<input className="campo" type="date" min={desde} value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
              </div>
              <div className="barbara-plan-reglas">
                {DIAS_CONTENIDO.map((dia) => {
                  const regla = reglas.find((r) => r.dia === dia.dia);
                  return (
                    <div className={regla ? "elegida" : ""} key={dia.dia}>
                      <button type="button" aria-pressed={Boolean(regla)} onClick={() => alternarDia(dia.dia)}>{dia.corto}</button>
                      <input className="campo" type="time" disabled={!regla} value={regla?.hora ?? "10:00"} onChange={(e) => cambiarHoraDia(dia.dia, e.target.value)} />
                    </div>
                  );
                })}
              </div>
              <p>{reglas.length ? `Se planificará todos los ${resumen}.` : "Elige uno o más días."}</p>
            </section>
          )}

          <p className="barbara-plan-cuota">Tu plan contempla hasta <b>{limite}</b> {FORMATOS.find((f) => f.id === tipo)?.nombre.toLowerCase()} por mes. Planificar no consume la cuota; generar la pieza sí.</p>
          {error && <p className="error" role="alert">{error}</p>}
        </div>

        <footer>
          <button className="btn" type="button" onClick={cerrar}>Cancelar</button>
          <button className="btn solido" disabled={guardando || !titulo.trim()}>
            {guardando ? "Guardando…" : existente ? "Guardar cambios" : repite ? "Crear serie" : "Crear contenido"}
          </button>
        </footer>
      </form>
    </div>
  );
}
