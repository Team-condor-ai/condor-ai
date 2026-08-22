import { useMemo, useState } from "react";
import { sb, plata } from "../../lib/supabase";
import { Ico } from "../../disenio/iconos";
import { lineasDe, type Asiento, type Cuenta } from "./tipos";
import { filasDeItems, parsearCartola, type Cartola, type LineaCartola } from "./cartola";

/**
 * Importar la cartola del banco.
 *
 * UNA DECISIÓN POR MOVIMIENTO, Y UNA AL FINAL POR EL SALDO
 * ---------------------------------------------------------------------------
 * El importador lee la cartola, decide qué haría con cada línea y lo dice en
 * castellano. Lo único que hace la persona es aceptar o denegar. No hay que
 * entender partida doble para usar esto: la propuesta ya viene armada.
 *
 * Al final va la decisión que cierra todo: la liquidez real. Después de aplicar
 * lo aceptado, el saldo de los libros tiene que quedar igual al saldo que
 * imprime el banco. Si no queda, es que en los libros hay algo que el banco
 * nunca hizo — y ahí se ofrece el ajuste, aparte y explícito, porque cuadrar
 * una cuenta a la fuerza es una decisión contable, no un detalle técnico.
 *
 * LO DENEGADO NO SE GUARDA
 * ---------------------------------------------------------------------------
 * Denegar es "ahora no", no "nunca". No se registra nada, así que el mismo
 * movimiento vuelve a aparecer en la próxima importación. Un cargo del banco
 * sin contabilizar tiene que seguir molestando hasta que alguien lo resuelva;
 * si "denegar" lo silenciara para siempre, un error de clic lo desaparecería.
 *
 * El caso de Meta no tiene código especial: su regla apunta al pasivo 2104, así
 * que el cargo del banco cancela la deuda que dejó el sync en vez de crear un
 * gasto nuevo. Si creara un gasto, la misma publicidad quedaría contada dos
 * veces: una por la API de Meta y otra por la cartola.
 */

type Regla = { id: string; patron: string; cuenta_id: string };
type Decision = {
  estado: "pendiente" | "aceptado" | "denegado";
  cuentaId: string;
  asientoId: string | null;
};
type Candidato = { asiento: Asiento; monto: number; exacto: boolean };
type DecisionLiquidez = "pendiente" | "aceptada" | "denegada";
type PerfilClave = {
  id: string;
  nombre: string;
  clave: string;
  predeterminada: boolean;
};

const CLAVES_STORAGE = "condor.cartola.claves.v1";

function cargarClavesGuardadas(): PerfilClave[] {
  if (typeof window === "undefined") return [];
  try {
    const dato = JSON.parse(window.localStorage.getItem(CLAVES_STORAGE) ?? "[]");
    if (!Array.isArray(dato)) return [];
    return dato.filter(
      (x): x is PerfilClave =>
        typeof x?.id === "string" &&
        typeof x?.nombre === "string" &&
        typeof x?.clave === "string" &&
        typeof x?.predeterminada === "boolean",
    );
  } catch {
    return [];
  }
}

function idClave() {
  return globalThis.crypto?.randomUUID?.() ?? `clave-${Date.now()}`;
}

const diasEntre = (a: string, b: string) =>
  Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86400000);

export function ImportarCartola({
  cuentas,
  asientos,
  recargar,
}: {
  cuentas: Cuenta[];
  asientos: Asiento[];
  recargar: () => void;
}) {
  const liquidas = useMemo(() => cuentas.filter((c) => c.liquida), [cuentas]);
  const contrapartes = useMemo(() => cuentas.filter((c) => !c.liquida), [cuentas]);

  const [cuentaBancoId, setCuentaBancoId] = useState(
    () => cuentas.find((c) => c.codigo === "1102")?.id ?? "",
  );
  const [clavesGuardadas, setClavesGuardadas] = useState<PerfilClave[]>(
    cargarClavesGuardadas,
  );
  const [claveSeleccionada, setClaveSeleccionada] = useState(
    () => clavesGuardadas.find((x) => x.predeterminada)?.id ?? "",
  );
  const [clave, setClave] = useState(
    () => clavesGuardadas.find((x) => x.predeterminada)?.clave ?? "",
  );
  const [mostrarClave, setMostrarClave] = useState(false);
  const [gestionarClave, setGestionarClave] = useState(false);
  const [nombreClave, setNombreClave] = useState(
    () => clavesGuardadas.find((x) => x.predeterminada)?.nombre ?? "",
  );
  const [hacerPredeterminada, setHacerPredeterminada] = useState(
    () => clavesGuardadas.length === 0,
  );
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState("");
  const [cartola, setCartola] = useState<Cartola | null>(null);
  const [reglas, setReglas] = useState<Regla[]>([]);
  const [yaImportadas, setYaImportadas] = useState<Set<string>>(new Set());
  const [asientosYaConciliados, setAsientosYaConciliados] = useState<Set<string>>(
    new Set(),
  );
  const [decisiones, setDecisiones] = useState<Record<number, Decision>>({});
  const [aplicando, setAplicando] = useState(false);
  const [resultado, setResultado] = useState("");

  // La liquidez se decide aparte de los movimientos.
  const [decisionLiquidez, setDecisionLiquidez] =
    useState<DecisionLiquidez>("pendiente");
  const [cuentaAjuste, setCuentaAjuste] = useState(
    () => cuentas.find((c) => c.codigo === "3201")?.id ?? "",
  );

  function persistirClaves(nuevas: PerfilClave[]) {
    try {
      window.localStorage.setItem(CLAVES_STORAGE, JSON.stringify(nuevas));
      setClavesGuardadas(nuevas);
      return true;
    } catch {
      setError("Este navegador no permitió guardar la clave. Puedes seguir usándola esta vez.");
      return false;
    }
  }

  function seleccionarClave(id: string) {
    setClaveSeleccionada(id);
    const perfil = clavesGuardadas.find((x) => x.id === id);
    setClave(perfil?.clave ?? "");
    setNombreClave(perfil?.nombre ?? "");
    setHacerPredeterminada(Boolean(perfil?.predeterminada));
  }

  function guardarClave() {
    const nombre = nombreClave.trim();
    if (!nombre || !clave) {
      setError("Ponle un nombre a esta clave y escribe la clave del PDF antes de guardarla.");
      return;
    }
    const existente = clavesGuardadas.find((x) => x.id === claveSeleccionada);
    const id = existente?.id ?? idClave();
    const restantes = clavesGuardadas.filter((x) => x.id !== id);
    const nuevas = [
      ...restantes.map((x) => ({
        ...x,
        predeterminada: hacerPredeterminada ? false : x.predeterminada,
      })),
      { id, nombre, clave, predeterminada: hacerPredeterminada },
    ];
    if (!persistirClaves(nuevas)) return;
    setClaveSeleccionada(id);
    setGestionarClave(false);
    setError("");
  }

  function eliminarClave() {
    if (!claveSeleccionada) return;
    const nuevas = clavesGuardadas.filter((x) => x.id !== claveSeleccionada);
    persistirClaves(nuevas);
    setClaveSeleccionada("");
    setClave("");
    setNombreClave("");
    setHacerPredeterminada(nuevas.length === 0);
  }

  const identidad = (l: LineaCartola) =>
    [l.fecha, l.detalle, l.cargo, l.abono, l.ordenEnDia].join("|");

  function cambiarCuentaBanco(id: string) {
    setCuentaBancoId(id);
    setCartola(null);
    setDecisiones({});
    setYaImportadas(new Set());
    setAsientosYaConciliados(new Set());
    setResultado("");
    setDecisionLiquidez("pendiente");
  }

  /** La cuenta que sugieren las reglas: gana el patrón más largo, o sea el más específico. */
  function cuentaSugerida(detalle: string): string {
    const texto = detalle.toUpperCase();
    const calzan = reglas
      .filter((r) => texto.includes(r.patron.toUpperCase()))
      .sort((a, b) => b.patron.length - a.patron.length);
    return calzan[0]?.cuenta_id ?? "";
  }

  /** Asientos que ya tocan esta cuenta del banco por el mismo lado y cerca en fecha. */
  function candidatos(l: LineaCartola): Candidato[] {
    const monto = l.cargo || l.abono;
    const salida: Candidato[] = [];
    for (const a of asientos) {
      if (a.origen === "cartola") continue;
      if (asientosYaConciliados.has(a.id)) continue;
      if (cartola?.hasta && a.fecha > cartola.hasta) continue;
      const linea = (a.asiento_lineas ?? []).find((x) => x.cuenta_id === cuentaBancoId);
      if (!linea) continue;
      // Un cargo del banco baja el saldo, así que el banco va al HABER.
      const suyo = l.cargo > 0 ? Number(linea.haber) : Number(linea.debe);
      if (!suyo) continue;
      if (diasEntre(a.fecha, l.fecha) > 3) continue;
      const exacto = suyo === monto;
      // Un asiento con tres o más patas se puede enlazar si ya coincide, pero
      // no se puede reescalar automáticamente sin saber cuál pata estaba mal.
      if (!exacto && (a.asiento_lineas ?? []).length !== 2) continue;
      salida.push({ asiento: a, monto: suyo, exacto });
    }
    return salida.sort(
      (x, y) =>
        Number(y.exacto) - Number(x.exacto) ||
        Math.abs(x.monto - monto) - Math.abs(y.monto - monto) ||
        diasEntre(x.asiento.fecha, l.fecha) - diasEntre(y.asiento.fecha, l.fecha),
    );
  }

  async function elegirArchivo(ev: React.ChangeEvent<HTMLInputElement>) {
    const input = ev.currentTarget;
    const archivo = ev.target.files?.[0];
    if (!archivo) return;
    if (!cuentaBancoId) {
      setError("Primero elige la cuenta contable que representa este banco.");
      input.value = "";
      return;
    }
    setNombreArchivo(archivo.name);
    setError("");
    setCartola(null);
    setResultado("");
    setDecisionLiquidez("pendiente");
    setLeyendo(true);
    try {
      const pdfjs = await import("pdfjs-dist");
      const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

      const doc = await pdfjs.getDocument({
        data: new Uint8Array(await archivo.arrayBuffer()),
        password: clave || undefined,
      }).promise;

      const filasPdf = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const contenido = await (await doc.getPage(n)).getTextContent();
        filasPdf.push(...filasDeItems(contenido.items as never[], (n - 1) * 10_000));
      }
      const leida = parsearCartola(filasPdf);

      const [reglasBd, movs] = await Promise.all([
        sb.from("reglas_banco").select("id, patron, cuenta_id"),
        sb
          .from("movimientos_banco")
          .select("fecha, detalle, cargo, abono, orden_en_dia, asiento_id")
          .eq("cuenta_banco_id", cuentaBancoId),
      ]);
      if (reglasBd.error) throw new Error(reglasBd.error.message);
      if (movs.error) throw new Error(movs.error.message);
      setReglas((reglasBd.data ?? []) as Regla[]);
      setYaImportadas(
        new Set(
          (movs.data ?? []).map((m) =>
            [m.fecha, m.detalle, m.cargo, m.abono, m.orden_en_dia].join("|"),
          ),
        ),
      );
      setAsientosYaConciliados(
        new Set(
          (movs.data ?? [])
            .map((m) => m.asiento_id)
            .filter((id): id is string => typeof id === "string"),
        ),
      );
      setCartola(leida);
      setDecisiones({});
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        /password/i.test(msg)
          ? "La clave del PDF no es correcta. Escríbela arriba y vuelve a elegir el archivo."
          : "No se pudo leer el PDF: " + msg,
      );
    } finally {
      // Permite volver a elegir exactamente el mismo PDF después de corregir
      // una clave errónea; sin esto el navegador no dispara otro `change`.
      input.value = "";
      setLeyendo(false);
    }
  }

  // Se arma acá y no en el estado: así cambiar una cuenta a mano no obliga a
  // rearmar toda la tabla, y las reglas recién cargadas se aplican solas.
  const filas = useMemo(() => {
    if (!cartola) return [];
    const asientosReservados = new Set<string>();
    return cartola.lineas.map((l, i) => {
      const importada = yaImportadas.has(identidad(l));
      const cands = importada
        ? []
        : candidatos(l).filter((c) => !asientosReservados.has(c.asiento.id));
      const exacto = cands.find((c) => c.exacto);
      const sugerida = exacto ? "" : cuentaSugerida(l.detalle);
      // Toda propuesta arranca pendiente, incluso si la regla parece segura:
      // identificar no equivale a autorizar un asiento contable.
      let decision: Decision =
        decisiones[i] ??
        (exacto
          ? { estado: "pendiente", cuentaId: "", asientoId: exacto.asiento.id }
          : { estado: "pendiente", cuentaId: sugerida, asientoId: null });
      // Un asiento existente sólo puede explicar un movimiento del banco. Si
      // dos filas compiten por el mismo, la segunda vuelve a propuesta nueva.
      if (decision.asientoId && asientosReservados.has(decision.asientoId)) {
        decision = {
          estado: "pendiente",
          cuentaId: cuentaSugerida(l.detalle),
          asientoId: null,
        };
      }
      if (decision.asientoId) asientosReservados.add(decision.asientoId);
      return { l, i, importada, cands, decision };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cartola,
    yaImportadas,
    decisiones,
    reglas,
    asientos,
    cuentaBancoId,
    asientosYaConciliados,
  ]);

  const decidir = (i: number, cambio: Partial<Decision>) =>
    setDecisiones((p) => ({
      ...p,
      [i]: { ...filas.find((f) => f.i === i)!.decision, ...cambio },
    }));

  function cambiarPropuesta(i: number, valor: string) {
    if (valor.startsWith("asiento:")) {
      decidir(i, { asientoId: valor.slice("asiento:".length), cuentaId: "" });
      return;
    }
    decidir(i, {
      asientoId: null,
      cuentaId: valor.startsWith("cuenta:") ? valor.slice("cuenta:".length) : "",
      ...(valor ? {} : { estado: "pendiente" as const }),
    });
  }

  function todos(aceptado: boolean) {
    const nuevo: Record<number, Decision> = {};
    for (const f of filas) {
      if (f.importada) continue;
      // No se puede aceptar en bloque lo que todavía no tiene cuenta.
      const puede = Boolean(f.decision.asientoId || f.decision.cuentaId);
      nuevo[f.i] = {
        ...f.decision,
        estado: aceptado ? (puede ? "aceptado" : "pendiente") : "denegado",
      };
    }
    setDecisiones(nuevo);
  }

  /** Qué haría el importador con esta línea, dicho en castellano. */
  function propuesta(f: (typeof filas)[number]) {
    const { l, decision, cands } = f;
    const monto = l.cargo || l.abono;
    if (decision.asientoId) {
      const c = cands.find((x) => x.asiento.id === decision.asientoId);
      if (c?.exacto) return "Ya estaba anotado como “" + c.asiento.glosa + "”. Solo se enlaza.";
      if (c) {
        return (
          "Corrige “" + c.asiento.glosa + "”: " + plata(c.monto) + " → " + plata(monto) +
          ", que es lo que cobró el banco."
        );
      }
    }
    const cuenta = cuentas.find((c) => c.id === decision.cuentaId);
    if (!cuenta) return "No supe clasificarlo. Elige la cuenta y acéptalo.";
    if (cuenta.codigo === "2104") {
      return "Paga la deuda de Meta Ads. No crea un gasto nuevo: ya lo anotó el sync de Meta.";
    }
    return (l.cargo > 0 ? "Egreso nuevo en " : "Ingreso nuevo en ") + cuenta.codigo + " · " + cuenta.nombre;
  }

  const pendientes = filas.filter((f) => !f.importada);
  const aceptadas = pendientes.filter((f) => f.decision.estado === "aceptado");
  const denegadas = pendientes.filter((f) => f.decision.estado === "denegado");
  const porDecidir = pendientes.filter((f) => f.decision.estado === "pendiente");
  const sinClasificar = pendientes.filter(
    (f) => !f.decision.asientoId && !f.decision.cuentaId,
  );

  const saldoLibros = useMemo(() => {
    let s = 0;
    for (const a of asientos) {
      // Una cartola de julio se compara con los libros al cierre de julio. Un
      // asiento posterior no puede contaminar esa cuadratura.
      if (cartola?.hasta && a.fecha > cartola.hasta) continue;
      for (const l of a.asiento_lineas ?? [])
        if (l.cuenta_id === cuentaBancoId) s += Number(l.debe) - Number(l.haber);
    }
    return s;
  }, [asientos, cuentaBancoId, cartola]);

  /** Dónde quedaría el banco en los libros si se aplica todo lo aceptado. */
  const saldoProyectado = useMemo(() => {
    let s = saldoLibros;
    for (const f of aceptadas) {
      const monto = f.l.cargo || f.l.abono;
      const signo = f.l.cargo > 0 ? -1 : 1;
      if (!f.decision.asientoId) {
        s += signo * monto; // asiento nuevo
      } else {
        const c = f.cands.find((x) => x.asiento.id === f.decision.asientoId);
        if (c && !c.exacto) s += signo * (monto - c.monto); // corrección de monto
      }
    }
    return s;
  }, [aceptadas, saldoLibros]);

  const saldoCartola = cartola?.saldoFinal ?? 0;
  const diferencia = saldoCartola - saldoProyectado;
  const faltaDecisionLiquidez = diferencia !== 0 && decisionLiquidez === "pendiente";
  const aplicaAjuste = diferencia !== 0 && decisionLiquidez === "aceptada";

  async function aplicar() {
    if (!cartola || !cuentaBancoId) return;
    setAplicando(true);
    setError("");
    let creados = 0;
    let corregidos = 0;
    let enlazados = 0;

    for (const f of aceptadas) {
      const { l, decision } = f;
      const monto = l.cargo || l.abono;
      let asientoId = decision.asientoId;
      let accion: "creado" | "corregido" | "enlazado";
      let asientoNuevo = false;
      let correccionAnterior: {
        banco: { id: string; debe: number; haber: number };
        otra: { id: string; debe: number; haber: number };
      } | null = null;

      try {
        if (!asientoId) {
          const nuevo = await sb
            .from("asientos")
            .insert({
              fecha: l.fecha,
              glosa: l.detalle,
              origen: "cartola",
              referencia: "cartola:" + identidad(l),
            })
            .select()
            .single();
          if (nuevo.error || !nuevo.data) {
            throw new Error(nuevo.error?.message ?? "no se pudo crear el asiento");
          }
          asientoId = nuevo.data.id;
          asientoNuevo = true;
          const [debe, haber] =
            l.cargo > 0 ? [decision.cuentaId, cuentaBancoId] : [cuentaBancoId, decision.cuentaId];
          const patas = await sb.from("asiento_lineas").insert(
            lineasDe(debe, haber, monto, l.detalle).map((x) => ({
              ...x,
              asiento_id: nuevo.data.id,
            })),
          );
          if (patas.error) {
            await sb.from("asientos").delete().eq("id", nuevo.data.id);
            throw new Error(patas.error.message);
          }
          accion = "creado";
        } else {
          const a = asientos.find((x) => x.id === asientoId);
          if (!a) throw new Error("el asiento propuesto ya no está disponible");
          const lineas = a.asiento_lineas ?? [];
          const banco = lineas.find((x) => x.cuenta_id === cuentaBancoId);
          if (!banco) throw new Error("el asiento propuesto ya no toca la cuenta del banco");
          const suyo = l.cargo > 0 ? Number(banco.haber) : Number(banco.debe);
          // El banco manda sobre cuánto se movió. Solo se corrige un asiento de
          // dos patas: uno con más líneas no se puede reescalar sin decidir cuál
          // de todas estaba mal, y eso el importador no lo puede adivinar.
          if (suyo !== monto && lineas.length === 2) {
            const otra = lineas.find((x) => x.id !== banco.id)!;
            const bancoActualizado = await sb
              .from("asiento_lineas")
              .update(Number(banco.debe) > 0 ? { debe: monto } : { haber: monto })
              .eq("id", banco.id);
            if (bancoActualizado.error) throw new Error(bancoActualizado.error.message);
            const otraActualizada = await sb
              .from("asiento_lineas")
              .update(Number(otra.debe) > 0 ? { debe: monto } : { haber: monto })
              .eq("id", otra.id);
            if (otraActualizada.error) {
              await sb
                .from("asiento_lineas")
                .update({ debe: Number(banco.debe), haber: Number(banco.haber) })
                .eq("id", banco.id);
              throw new Error(otraActualizada.error.message);
            }
            correccionAnterior = {
              banco: { id: banco.id, debe: Number(banco.debe), haber: Number(banco.haber) },
              otra: { id: otra.id, debe: Number(otra.debe), haber: Number(otra.haber) },
            };
            accion = "corregido";
          } else {
            accion = "enlazado";
          }
        }

        const guardado = await sb.from("movimientos_banco").insert({
          cuenta_banco_id: cuentaBancoId,
          fecha: l.fecha,
          detalle: l.detalle,
          cargo: l.cargo,
          abono: l.abono,
          saldo_cartola: l.saldoCartola,
          orden_en_dia: l.ordenEnDia,
          archivo: nombreArchivo,
          periodo_desde: cartola.desde,
          periodo_hasta: cartola.hasta,
          asiento_id: asientoId,
          estado: decision.asientoId ? "conciliado" : "contabilizado",
        });
        if (guardado.error) {
          if (asientoNuevo) await sb.from("asientos").delete().eq("id", asientoId);
          if (correccionAnterior) {
            await Promise.all([
              sb
                .from("asiento_lineas")
                .update({
                  debe: correccionAnterior.banco.debe,
                  haber: correccionAnterior.banco.haber,
                })
                .eq("id", correccionAnterior.banco.id),
              sb
                .from("asiento_lineas")
                .update({
                  debe: correccionAnterior.otra.debe,
                  haber: correccionAnterior.otra.haber,
                })
                .eq("id", correccionAnterior.otra.id),
            ]);
          }
          throw new Error(
            /duplicate|unique/i.test(guardado.error.message)
              ? "este movimiento ya fue aplicado desde otra sesión; se deshizo el duplicado"
              : guardado.error.message,
          );
        }
        if (accion === "creado") creados++;
        if (accion === "corregido") corregidos++;
        if (accion === "enlazado") enlazados++;
      } catch (e) {
        setError(
          "Se detuvo en “" + l.detalle + "” del " + l.fecha + ": " +
            (e instanceof Error ? e.message : String(e)) +
            ". Lo que se aplicó antes quedó guardado; puedes volver a importar el mismo " +
            "PDF y va a seguir donde iba.",
        );
        setAplicando(false);
        recargar();
        return;
      }
    }

    let ajuste = "";
    if (decisionLiquidez === "aceptada" && diferencia !== 0 && cuentaAjuste) {
      const nuevo = await sb
        .from("asientos")
        .insert({
          fecha: cartola.hasta ?? new Date().toISOString().slice(0, 10),
          glosa: "Ajuste de saldo según cartola " + (nombreArchivo || ""),
          origen: "cartola",
          referencia: `cartola:saldo:${cuentaBancoId}:${cartola.hasta ?? nombreArchivo}`,
        })
        .select()
        .single();
      if (nuevo.error || !nuevo.data) {
        setError("Los movimientos se aplicaron, pero el ajuste de saldo falló: " + nuevo.error?.message);
      } else {
        const [debe, haber] =
          diferencia > 0 ? [cuentaBancoId, cuentaAjuste] : [cuentaAjuste, cuentaBancoId];
        const lineasAjuste = await sb.from("asiento_lineas").insert(
          lineasDe(debe, haber, Math.abs(diferencia), "Cuadratura contra la cartola").map((x) => ({
            ...x,
            asiento_id: nuevo.data.id,
          })),
        );
        if (lineasAjuste.error) {
          await sb.from("asientos").delete().eq("id", nuevo.data.id);
          setError(
            "Los movimientos se aplicaron, pero el ajuste de saldo falló: " +
              lineasAjuste.error.message,
          );
        } else {
          ajuste = " Se ajustó el saldo en " + plata(Math.abs(diferencia)) + ".";
        }
      }
    }

    setResultado(
      "Listo: " + creados + " asientos nuevos, " + corregidos + " montos corregidos y " +
        enlazados + " enlazados." + ajuste,
    );
    setCartola(null);
    setDecisiones({});
    setDecisionLiquidez("pendiente");
    setAplicando(false);
    recargar();
  }

  const cuentaBanco = cuentas.find((c) => c.id === cuentaBancoId);

  return (
    <section className="bloque">
      <h3 style={{ marginTop: 0 }}>Importar cartola del banco</h3>
      <p className="conteo">
        Lee el PDF de la cartola, dice qué haría con cada movimiento y espera que lo
        aceptes o lo deniegues. Reimportar el mismo archivo no duplica nada, y lo que
        deniegues vuelve a aparecer la próxima vez.
      </p>

      <div className="cartola-acceso">
        <label className="campo-lbl">
          Cuenta contable del banco
          <select
            className="campo"
            value={cuentaBancoId}
            onChange={(e) => cambiarCuentaBanco(e.target.value)}
          >
            {liquidas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo} · {c.nombre}
              </option>
            ))}
          </select>
        </label>

        <div className="campo-lbl">
          Clave de acceso del PDF
          {clavesGuardadas.length > 0 && (
            <select
              className="campo"
              aria-label="Clave guardada"
              value={claveSeleccionada}
              onChange={(e) => seleccionarClave(e.target.value)}
            >
              <option value="">Escribir otra clave</option>
              {clavesGuardadas.map((perfil) => (
                <option key={perfil.id} value={perfil.id}>
                  {perfil.nombre}{perfil.predeterminada ? " · predeterminada" : ""}
                </option>
              ))}
            </select>
          )}
          <div className="cartola-clave-fila">
            <input
              className="campo"
              type={mostrarClave ? "text" : "password"}
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              placeholder="Escribe la clave que pide el banco"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="btn chico"
              aria-label={mostrarClave ? "Ocultar clave" : "Mostrar clave"}
              aria-pressed={mostrarClave}
              onClick={() => setMostrarClave((x) => !x)}
            >
              {mostrarClave ? "Ocultar" : "Mostrar"}
            </button>
          </div>
          <button
            type="button"
            className="enlace cartola-gestionar-clave"
            onClick={() => setGestionarClave((x) => !x)}
          >
            {gestionarClave
              ? "Cerrar opciones de clave"
              : claveSeleccionada
                ? "Editar esta clave guardada"
                : "Guardar esta clave para la próxima vez"}
          </button>
        </div>
      </div>

      {gestionarClave && (
        <div className="cartola-claves-gestor">
          <label className="campo-lbl">
            Nombre para reconocerla
            <input
              className="campo"
              value={nombreClave}
              onChange={(e) => setNombreClave(e.target.value)}
              placeholder="Ej. Banco de Chile · cuenta 6201"
            />
          </label>
          <label className="cartola-check">
            <input
              type="checkbox"
              checked={hacerPredeterminada}
              onChange={(e) => setHacerPredeterminada(e.target.checked)}
            />
            Usar esta clave automáticamente al abrir la herramienta
          </label>
          <div className="cartola-claves-acciones">
            <button type="button" className="btn chico solido" onClick={guardarClave}>
              {claveSeleccionada ? "Guardar cambios" : "Agregar clave"}
            </button>
            {claveSeleccionada && (
              <button type="button" className="btn chico peligro" onClick={eliminarClave}>
                Eliminar de este navegador
              </button>
            )}
          </div>
          <p className="conteo">
            La clave queda sólo en este navegador y se usa para abrir el PDF aquí mismo;
            no se envía a Supabase ni al servidor. No la guardes en un equipo compartido.
          </p>
        </div>
      )}

      <label
        className={`btn solido cartola-subir${leyendo ? " deshabilitado" : ""}`}
        aria-disabled={leyendo}
      >
        {Ico.subir({ t: 14 })} {leyendo ? "Leyendo…" : "Elegir cartola en PDF"}
        <input
          type="file"
          accept=".pdf,application/pdf"
          hidden
          disabled={leyendo}
          onChange={elegirArchivo}
        />
      </label>
      {nombreArchivo && (
        <span className="conteo" style={{ marginLeft: 8 }}>
          {nombreArchivo}
        </span>
      )}

      {error && <p className="error">{error}</p>}
      {resultado && (
        <p className="pill ok" style={{ marginTop: 10 }}>
          {resultado}
        </p>
      )}

      {cartola && !cartola.cuadra && (
        <div className="error" style={{ marginTop: 12 }}>
          <b>No se importó nada.</b>
          <p style={{ margin: "6px 0 0" }}>{cartola.diagnostico}</p>
          <p className="conteo" style={{ margin: "6px 0 0" }}>
            El importador exige que el saldo recalculado a partir de los movimientos
            coincida exactamente con el saldo final que imprime la cartola. Si no
            coincide, leyó mal alguna columna, y meter eso a la contabilidad es peor que
            no importar nada.
          </p>
        </div>
      )}

      {cartola?.cuadra && (
        <>
          <div className="cartola-revision-cab">
            <div>
              <b>
              {pendientes.length} movimientos por revisar
              {filas.length - pendientes.length > 0 &&
                " · " + (filas.length - pendientes.length) + " ya importados"}
              </b>
              <span className="conteo">
                {aceptadas.length} aceptados · {denegadas.length} denegados ·{" "}
                {porDecidir.length} sin decidir
              </span>
            </div>
            <span className="cartola-acciones-masivas">
              <button type="button" className="btn chico" onClick={() => todos(true)}>
                Aceptar todo
              </button>
              <button type="button" className="btn chico" onClick={() => todos(false)}>
                Denegar todo
              </button>
            </span>
          </div>

          <div className="tabla-caja" style={{ marginTop: 10 }}>
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Movimiento del banco</th>
                  <th className="num">Monto</th>
                  <th>Qué se va a hacer</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const { l, i, importada, decision } = f;
                  const monto = l.cargo || l.abono;
                  const valorPropuesta = decision.asientoId
                    ? "asiento:" + decision.asientoId
                    : decision.cuentaId
                      ? "cuenta:" + decision.cuentaId
                      : "";
                  return (
                    <tr
                      key={i}
                      className={
                        importada
                          ? "cartola-importada"
                          : decision.estado === "aceptado"
                            ? "cartola-aceptada"
                            : decision.estado === "denegado"
                              ? "cartola-denegada"
                              : "cartola-pendiente"
                      }
                    >
                      <td className="conteo">{l.fecha.slice(5)}</td>
                      <td style={{ minWidth: 190 }}>{l.detalle}</td>
                      <td
                        className={`num cartola-monto ${l.cargo ? "cargo" : "abono"}`}
                      >
                        {(l.cargo ? "−" : "+") + plata(monto)}
                      </td>
                      <td className="cartola-propuesta">
                        {!importada && (
                          <select
                            className="campo"
                            aria-label={`Propuesta para ${l.detalle}`}
                            value={valorPropuesta}
                            onChange={(e) => cambiarPropuesta(i, e.target.value)}
                          >
                            <option value="">Elegir qué se va a hacer…</option>
                            {f.cands.length > 0 && (
                              <optgroup label="Usar un asiento que ya existe">
                                {f.cands.map((c) => (
                                  <option key={c.asiento.id} value={"asiento:" + c.asiento.id}>
                                    {c.exacto ? "Enlazar" : "Corregir"} · {c.asiento.fecha} · {c.asiento.glosa}
                                    {c.exacto ? "" : ` (${plata(c.monto)} → ${plata(monto)})`}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            <optgroup label={l.cargo ? "Crear un egreso nuevo" : "Crear un ingreso nuevo"}>
                              {contrapartes.map((c) => (
                                <option key={c.id} value={"cuenta:" + c.id}>
                                  {c.codigo} · {c.nombre}
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        )}
                        <div className="conteo">{propuesta(f)}</div>
                      </td>
                      <td className="cartola-decision-celda">
                        {importada ? (
                          <span className="pill gris">ya importada</span>
                        ) : (
                          <div className="cartola-decision" role="group" aria-label={`Decisión para ${l.detalle}`}>
                            <button
                              type="button"
                              className={decision.estado === "aceptado" ? "aceptar on" : "aceptar"}
                              disabled={!decision.asientoId && !decision.cuentaId}
                              aria-pressed={decision.estado === "aceptado"}
                              onClick={() => decidir(i, { estado: "aceptado" })}
                            >
                              Aceptar
                            </button>
                            <button
                              type="button"
                              className={decision.estado === "denegado" ? "denegar on" : "denegar"}
                              aria-pressed={decision.estado === "denegado"}
                              onClick={() => decidir(i, { estado: "denegado" })}
                            >
                              Denegar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {sinClasificar.length > 0 && (
            <p className="conteo" style={{ marginTop: 8 }}>
              Hay <b>{sinClasificar.length}</b> movimientos que no supe clasificar. Elígeles
              una cuenta si quieres aceptarlos; si no corresponden a la empresa, deniégalos.
            </p>
          )}
          {porDecidir.length > 0 && (
            <p className="aviso cartola-decision-pendiente">
              Revisa los <b>{porDecidir.length}</b> movimientos que siguen sin decisión.
              Puedes resolverlos uno a uno o usar “Aceptar todo” / “Denegar todo”.
            </p>
          )}

          <div className="tile cartola-liquidez">
            <div className="cartola-liquidez-cab">
              <div>
                <span className="sobrelinea">Decisión final</span>
                <h4>Liquidez real de {cuentaBanco?.nombre}</h4>
                <p className="conteo">
                  Se compara al cierre {cartola.hasta ?? "de la cartola"}; los asientos
                  posteriores no entran en esta cuadratura.
                </p>
              </div>
              {decisionLiquidez !== "pendiente" && diferencia !== 0 && (
                <span className={`pill ${decisionLiquidez === "aceptada" ? "ok" : "gris"}`}>
                  {decisionLiquidez === "aceptada" ? "ajuste aceptado" : "ajuste denegado"}
                </span>
              )}
            </div>
            <div className="cartola-liquidez-grid">
              <div>
                <span>Saldo del banco</span>
                <b>{plata(saldoCartola)}</b>
              </div>
              <div>
                <span>Libros antes de importar</span>
                <b>{plata(saldoLibros)}</b>
              </div>
              <div>
                <span>Libros con lo aceptado</span>
                <b>{plata(saldoProyectado)}</b>
              </div>
            </div>

            {diferencia === 0 ? (
              <p className="ok-msg">
                Cuadra: los libros quedan exactamente en lo que dice el banco.
              </p>
            ) : (
              <>
                <p style={{ margin: "10px 0 0" }}>
                  Quedaría una diferencia de <b>{plata(Math.abs(diferencia))}</b>.{" "}
                  {diferencia < 0
                    ? "Los libros tienen más plata que el banco: hay algo anotado que el banco nunca hizo."
                    : "El banco tiene más plata que los libros: falta anotar algo que sí entró."}
                </p>
                <p className="conteo" style={{ margin: "6px 0 0" }}>
                  Aceptar esto crea un asiento de cuadratura que fuerza el saldo a coincidir.
                  No corrige la causa: si la diferencia viene de un asiento mal hecho,
                  conviene arreglar ese asiento en el Libro diario y no tapar el hueco acá.
                </p>
                <div className="cartola-liquidez-decision">
                  <label className="campo-lbl">
                    Contrapartida si aceptas el ajuste
                    <select
                      className="campo"
                      value={cuentaAjuste}
                      onChange={(e) => setCuentaAjuste(e.target.value)}
                    >
                      <option value="">— elegir cuenta —</option>
                      {contrapartes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.codigo} · {c.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="cartola-decision" role="group" aria-label="Decisión sobre la liquidez real">
                    <button
                      type="button"
                      className={decisionLiquidez === "aceptada" ? "aceptar on" : "aceptar"}
                      disabled={!cuentaAjuste}
                      aria-pressed={decisionLiquidez === "aceptada"}
                      onClick={() => setDecisionLiquidez("aceptada")}
                    >
                      Aceptar liquidez
                    </button>
                    <button
                      type="button"
                      className={decisionLiquidez === "denegada" ? "denegar on" : "denegar"}
                      aria-pressed={decisionLiquidez === "denegada"}
                      onClick={() => setDecisionLiquidez("denegada")}
                    >
                      Denegar ajuste
                    </button>
                  </div>
                </div>
                {decisionLiquidez === "pendiente" && (
                  <p className="aviso cartola-decision-pendiente">
                    Falta aceptar o denegar la liquidez antes de aplicar la revisión.
                  </p>
                )}
              </>
            )}
          </div>

          <button
            className="btn solido"
            style={{ marginTop: 14 }}
            disabled={
              aplicando ||
              porDecidir.length > 0 ||
              faltaDecisionLiquidez ||
              (aceptadas.length === 0 && !aplicaAjuste)
            }
            onClick={aplicar}
          >
            {Ico.cheque({ t: 14 })}{" "}
            {aplicando
              ? "Aplicando…"
              : "Aplicar " +
                aceptadas.length +
                (aceptadas.length === 1 ? " movimiento" : " movimientos") +
                (aplicaAjuste ? " y el ajuste de saldo" : "")}
          </button>
        </>
      )}
    </section>
  );
}
