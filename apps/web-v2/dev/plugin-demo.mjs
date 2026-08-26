import { crearDatos, CORREO_STAFF, CORREO_CLIENTE } from "./demo-datos.mjs";

/**
 * Modo demo del portal: un Supabase de mentira servido por el propio Vite.
 *
 * PARA QUÉ
 * ---------------------------------------------------------------------------
 * Ver el portal en el computador de uno sin credenciales y sin tocar la base
 * real. Se entra con cualquier correo y cualquier clave.
 *
 * POR QUÉ ESTO NO ES UN AGUJERO DE AUTENTICACIÓN
 * ---------------------------------------------------------------------------
 * No hay ninguna línea en la aplicación que diga "si es localhost, entra". El
 * portal sigue pidiendo login contra el Supabase que le indique
 * `VITE_SUPABASE_URL`; lo único que cambia es que esa URL apunta a este
 * servidor de mentira, que acepta cualquier clave.
 *
 * Tres cierres, y hacen falta los tres:
 *   1. `apply: "serve"` — el plugin NO se carga en `npm run build`.
 *   2. Se activa solo si `VITE_PORTAL_DEMO=1`, y esa variable vive en
 *      `.env.local`, que está en `.gitignore` (`.env.*`). No viaja al repo.
 *   3. Los datos viven en Node, nunca en el bundle del navegador.
 *
 * O sea: el código que deja entrar sin clave **no existe** en el sitio
 * publicado. No está apagado por una bandera, no está.
 *
 * QUIÉN ENTRA COMO QUÉ
 * ---------------------------------------------------------------------------
 * Un correo que empiece con "cliente" entra como CLIENTE; cualquier otro, como
 * equipo. Así se pueden ver las dos caras del portal sin reiniciar nada.
 */

const PREFIJO = "/__demo";
const PUERTO = 5173;

const json = (res, cuerpo, status = 200) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(cuerpo));
};

const uuid = () =>
  "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16),
  );

/** El rol viaja dentro del propio token: no hay estado de sesión que mantener. */
const tokenDe = (email) =>
  `demo.${email.toLowerCase().startsWith("cliente") ? "cliente" : "staff"}.${encodeURIComponent(email)}`;

function sesionDe(email) {
  const esCliente = email.toLowerCase().startsWith("cliente");
  return {
    access_token: tokenDe(email),
    token_type: "bearer",
    expires_in: 3600 * 24,
    expires_at: Math.floor(Date.now() / 1000) + 3600 * 24,
    refresh_token: tokenDe(email),
    user: {
      id: "00000000-0000-4000-8000-000000000900",
      aud: "authenticated",
      role: "authenticated",
      email,
      email_confirmed_at: new Date().toISOString(),
      user_metadata: { password_set: true },
      app_metadata: { provider: "email" },
      created_at: new Date().toISOString(),
    },
    __cliente: esCliente,
  };
}

function quienEs(req) {
  const auth = req.headers["authorization"] || "";
  const t = auth.replace(/^Bearer\s+/i, "");
  const partes = t.split(".");
  if (partes[0] !== "demo") return null;
  // `slice(2).join(".")` y no `partes[2]`: el correo TIENE puntos, así que
  // "demo.cliente.cliente%40demo.cl" se parte en cuatro y quedarse con el
  // tercer trozo devolvía "cliente@demo" — que no calza con ningún cliente y
  // dejaba la pantalla vacía sin decir por qué.
  if (partes.length < 3) return null;
  return { rol: partes[1], email: decodeURIComponent(partes.slice(2).join(".")) };
}

/**
 * Lee `clientes.negocio` sobre una fila con relación incrustada.
 *
 * PostgREST deja filtrar por una columna de la tabla embebida
 * (`?clientes.negocio=eq.Cóndor.AI`, lo que hace `/acceso/barbara` para
 * encontrar la ficha de Cóndor). Acá eso llegaba como la clave literal
 * "clientes.negocio", se resolvía a `undefined` y la consulta devolvía
 * vacío: staff veía "No existe todavía la fila de Cóndor.AI".
 *
 * La relación puede venir como objeto o como arreglo de uno, según cómo la
 * declare cada pantalla; se cubren las dos.
 */
function leerRuta(fila, clave) {
  if (!clave.includes(".")) return fila[clave];
  let actual = fila;
  for (const paso of clave.split(".")) {
    if (actual == null) return undefined;
    if (Array.isArray(actual)) actual = actual[0];
    if (actual == null) return undefined;
    actual = actual[paso];
  }
  return actual;
}

/** Subconjunto de PostgREST: lo que estas pantallas usan y nada más. */
function filtrar(filas, params) {
  let r = [...filas];
  for (const [k, v] of params) {
    if (["select", "order", "limit", "offset", "on_conflict"].includes(k)) continue;
    const m = /^(eq|neq|is|gt|gte|lt|lte|in|like|ilike)\.(.*)$/.exec(v);
    if (!m) continue;
    const [, op, crudo] = m;
    let val = crudo;
    if (val === "true") val = true;
    else if (val === "false") val = false;
    else if (val === "null") val = null;
    else if (/^-?\d+$/.test(val)) val = Number(val);
    r = r.filter((f) => {
      const a = leerRuta(f, k);
      switch (op) {
        case "eq": case "is": return a === val;
        case "neq": return a !== val;
        case "gt": return a > val;
        case "gte": return a >= val;
        case "lt": return a < val;
        case "lte": return a <= val;
        case "in": return String(crudo).replace(/[()]/g, "").split(",").includes(String(a));
        default: return String(a ?? "").toLowerCase().includes(String(crudo).replace(/[%*]/g, "").toLowerCase());
      }
    });
  }
  const order = params.get("order");
  if (order) {
    for (const parte of order.split(",").reverse()) {
      const [col, ...resto] = parte.split(".");
      const desc = resto.includes("desc");
      r.sort((a, b) => {
        const x = a[col], y = b[col];
        const c = typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x ?? "").localeCompare(String(y ?? ""));
        return desc ? -c : c;
      });
    }
  }
  const limit = params.get("limit");
  if (limit) r = r.slice(0, Number(limit));
  return r;
}

/**
 * Lo que RLS haría en la base de verdad.
 *
 * No es decoración: sin esto la vista del cliente mostraría la cartera
 * completa y la demo diría que el portal filtra mal cuando en realidad filtra
 * bien. Un demo que miente sobre la seguridad es peor que no tenerlo.
 */
function comoRLS(tabla, filas, quien, datos) {
  if (!quien || quien.rol !== "cliente") return filas;
  const mio = datos.clientes.find((c) => (c.email ?? "").toLowerCase() === quien.email.toLowerCase());
  if (!mio) return [];
  if (tabla === "clientes") return filas.filter((f) => f.id === mio.id);
  if (tabla === "cobros" || tabla === "pagos")
    return filas.filter((f) => f.cliente_id === mio.id);

  /* Bárbara: `cliente_ve_su_barbara` y las políticas hermanas limitan cada
     tabla a la ficha del cliente dueño de la sesión. Sin esto el cliente
     demo vería la Bárbara de Cóndor —que existe para que staff entre por
     /acceso/barbara— y la demo mentiría justo sobre el aislamiento entre
     marcas, que es el invariante central del producto. */
  if (tabla === "barbara_clientes")
    return filas.filter((f) => f.cliente_id === mio.id);
  if (tabla.startsWith("barbara_")) {
    const mias = new Set(
      datos.barbara_clientes.filter((b) => b.cliente_id === mio.id).map((b) => b.id),
    );
    return filas.filter((f) =>
      f.barbara_cliente_id === undefined || mias.has(f.barbara_cliente_id));
  }
  return filas;
}

async function cuerpoJson(req) {
  const trozos = [];
  for await (const t of req) trozos.push(t);
  if (!trozos.length) return null;
  try { return JSON.parse(Buffer.concat(trozos).toString("utf8")); } catch { return null; }
}

export function pluginPortalDemo() {
  const datos = crearDatos();

  return {
    name: "portal-demo",
    // La llave maestra: en `build` este plugin ni siquiera se ejecuta.
    apply: "serve",

    /**
     * La URL del Supabase falso la pone el PLUGIN, no `.env.local`.
     *
     * Si estuviera en el archivo, `vite build` también la leería —los `.env`
     * se cargan igual en build— y el bundle saldría apuntando a localhost sin
     * que nadie lo note hasta que el portal no cargue en producción. Puesta
     * acá, en un plugin que solo corre en `serve`, ese error no se puede
     * cometer: al compilar, la variable simplemente no existe y el portal cae
     * a la instancia real, como siempre.
     */
    config() {
      return {
        define: {
          "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(`http://localhost:${PUERTO}${PREFIJO}`),
          "import.meta.env.VITE_SUPABASE_ANON": JSON.stringify("demo"),
        },
        // Puerto fijo: la URL de arriba lo lleva escrito. Si estuviera ocupado
        // y Vite saltara al siguiente, el portal hablaría con un puerto donde
        // no hay nadie y el error sería incomprensible. Mejor fallar acá.
        server: { port: PUERTO, strictPort: true },
      };
    },

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const u = new URL(req.url, "http://localhost");
        if (!u.pathname.startsWith(PREFIJO)) return next();

        const ruta = u.pathname.slice(PREFIJO.length);
        const quien = quienEs(req);

        // ── Autenticación de mentira ──
        if (ruta.startsWith("/auth/v1/")) {
          if (ruta.includes("/logout")) { res.statusCode = 204; return res.end(); }
          if (ruta.includes("/user") && req.method === "GET") {
            if (!quien) return json(res, { message: "no autenticado" }, 401);
            return json(res, sesionDe(quien.email).user);
          }
          const b = (await cuerpoJson(req)) ?? {};
          const email = (b.email || quien?.email || CORREO_STAFF).trim();
          if (ruta.includes("/otp")) return json(res, {});   // "te mandamos el código"
          return json(res, sesionDe(email));                  // token / verify / user PUT
        }

        // ── es_admin(): lo mismo que decide el rol en Postgres ──
        if (ruta === "/rest/v1/rpc/es_admin") {
          return json(res, quien ? quien.rol === "staff" : false);
        }

        // ── RPC del calendario de Bárbara ───────────────────────────────
        // En producción estas operaciones son SECURITY DEFINER y verifican
        // propiedad/estado. La demo reproduce la mutación para que crear,
        // arrastrar y editar no sean botones de utilería.
        if (ruta === "/rest/v1/rpc/barbara_crear_planes" && req.method === "POST") {
          if (!quien) return json(res, { message: "no autenticado" }, 401);
          const b = (await cuerpoJson(req)) ?? {};
          const ocurrencias = Array.isArray(b.p_ocurrencias) ? b.p_ocurrencias : [];
          if (!ocurrencias.length || !String(b.p_titulo || "").trim()) return json(res, { message: "plan incompleto" }, 400);
          const serieId = ocurrencias.length > 1 ? uuid() : null;
          const creadas = ocurrencias.map((programada_para) => ({
            id: uuid(), barbara_cliente_id: b.p_barbara_cliente_id, barbara_memoria_id: null,
            tipo: b.p_tipo, plataforma: b.p_plataforma, programada_para,
            estado: "borrador", zona_horaria: b.p_zona_horaria || "America/Santiago",
            motivo_reprogramacion: null,
            razon_planificacion: ocurrencias.length > 1 ? "Serie semanal creada en el portal" : "Plan creado en el portal",
            ultimo_error: null, intentos_publicacion: 0,
            titulo: String(b.p_titulo).trim(), brief: b.p_brief || null,
            configuracion: b.p_configuracion || {}, serie_id: serieId,
            recurrencia_reglas: b.p_recurrencia_reglas || null,
            recurrencia_desde: b.p_recurrencia_desde || null,
            recurrencia_hasta: b.p_recurrencia_hasta || null,
            barbara_memoria: { angulo: String(b.p_titulo).trim() },
            creado_por: quien.email, creado_en: new Date().toISOString(), actualizado_en: new Date().toISOString(),
          }));
          datos.barbara_programaciones.push(...creadas);
          return json(res, creadas);
        }
        if (ruta === "/rest/v1/rpc/barbara_actualizar_plan" && req.method === "POST") {
          if (!quien) return json(res, { message: "no autenticado" }, 401);
          const b = (await cuerpoJson(req)) ?? {};
          const fila = datos.barbara_programaciones.find((p) => p.id === b.p_programacion_id);
          if (!fila) return json(res, { message: "Plan no encontrado" }, 404);
          Object.assign(fila, {
            plataforma: b.p_plataforma, titulo: String(b.p_titulo || "").trim(),
            brief: b.p_brief || null, configuracion: b.p_configuracion || {},
            actualizado_en: new Date().toISOString(),
          });
          return json(res, fila);
        }
        if (ruta === "/rest/v1/rpc/barbara_reprogramar" && req.method === "POST") {
          if (!quien) return json(res, { message: "no autenticado" }, 401);
          const b = (await cuerpoJson(req)) ?? {};
          const fila = datos.barbara_programaciones.find((p) => p.id === b.p_programacion_id);
          if (!fila) return json(res, { message: "Programación no encontrada" }, 404);
          Object.assign(fila, {
            programada_para: b.p_programada_para, motivo_reprogramacion: b.p_motivo || null,
            actualizado_en: new Date().toISOString(),
          });
          return json(res, fila);
        }
        if (ruta === "/rest/v1/rpc/barbara_cambiar_estado_programacion" && req.method === "POST") {
          if (!quien) return json(res, { message: "no autenticado" }, 401);
          const b = (await cuerpoJson(req)) ?? {};
          const fila = datos.barbara_programaciones.find((p) => p.id === b.p_programacion_id);
          if (!fila) return json(res, { message: "Programación no encontrada" }, 404);
          fila.estado = b.p_estado;
          fila.actualizado_en = new Date().toISOString();
          return json(res, fila);
        }

        // ── Tablas ──
        if (ruta.startsWith("/rest/v1/")) {
          const tabla = ruta.slice("/rest/v1/".length).split("?")[0];
          if (!datos[tabla]) datos[tabla] = [];
          const filas = datos[tabla];
          const unico = String(req.headers["accept"] || "").includes("vnd.pgrst.object");

          if (req.method === "GET") {
            const r = comoRLS(tabla, filtrar(filas, u.searchParams), quien, datos);
            // Un `select` con paréntesis pide una relación anidada. Se devuelve
            // vacía en vez de fallar: ninguna pantalla de cobros la usa, pero
            // Reuniones sí, y no tiene por qué reventar en modo demo.
            const sel = u.searchParams.get("select") || "";
            const anidadas = [...sel.matchAll(/(\w+)\s*\(/g)].map((m) => m[1]);
            const salida = r.map((f) => (anidadas.length
              ? { ...f, ...Object.fromEntries(anidadas.map((a) => [a, f[a] ?? []])) }
              : f));
            return json(res, unico ? (salida[0] ?? null) : salida);
          }

          if (quien?.rol === "cliente" && tabla !== "clientes") {
            return json(res, { message: "sin permiso" }, 403);
          }

          const b = await cuerpoJson(req);
          if (req.method === "POST") {
            const nuevas = (Array.isArray(b) ? b : [b]).map((f) => ({
              id: uuid(), creado_en: new Date().toISOString(), ...f,
            }));
            filas.push(...nuevas);
            return json(res, unico ? nuevas[0] : nuevas, 201);
          }
          if (req.method === "PATCH") {
            const objetivo = comoRLS(tabla, filtrar(filas, u.searchParams), quien, datos);
            for (const f of objetivo) Object.assign(f, b);
            return json(res, unico ? (objetivo[0] ?? null) : objetivo);
          }
          if (req.method === "DELETE") {
            const fuera = new Set(filtrar(filas, u.searchParams).map((f) => f.id));
            datos[tabla] = filas.filter((f) => !fuera.has(f.id));
            // En la base hay `on delete cascade`; acá se imita a mano para que
            // borrar un cliente no deje cobros y pagos huérfanos en pantalla.
            if (tabla === "clientes") {
              datos.cobros = datos.cobros.filter((c) => !fuera.has(c.cliente_id));
              datos.pagos = datos.pagos.filter((p) => !fuera.has(p.cliente_id));
            }
            return json(res, []);
          }
          return json(res, []);
        }

        // ── Edge Functions ──
        if (ruta.startsWith("/functions/v1/")) {
          const fn = ruta.slice("/functions/v1/".length);
          if (fn === "crear-pago") {
            const b = (await cuerpoJson(req)) ?? {};
            const cobro = datos.cobros.find((c) => c.id === b.cobro_id);
            if (!cobro) return json(res, { error: "cobro no encontrado" }, 404);
            const paymentId = String(990000000 + Number(cobro.numero));
            const link = `http://localhost:${PUERTO}/acceso/pago/resultado?cobro_id=${cobro.id}` +
              (cobro.tipo === "mensual" ? "" : `&payment_id=${paymentId}`);
            cobro.link = link;
            if (cobro.tipo === "mensual") {
              cobro.mp_preapproval_id = "demo-" + cobro.numero;
              cobro.estado = "activa";
            }
            else {
              const anterior = datos.pagos.find((p) => p.cobro_id === cobro.id && p.estado === "pendiente");
              if (!anterior) datos.pagos.unshift({
                  id: uuid(), cliente_id: cobro.cliente_id, cobro_id: cobro.id,
                  tipo: cobro.tipo, monto: cobro.monto, estado: "pendiente", mp_id: paymentId,
                  detalle: cobro.titulo, fecha: null, metodo: "Mercado Pago", link,
                  periodo: null, cobro_enviado_en: null, creado_en: new Date().toISOString(),
                });
            }
            return json(res, { init_point: link, correo_enviado: !!b.enviar_correo, cobro_id: cobro.id });
          }
          if (fn === "verificar-pago") {
            const b = (await cuerpoJson(req)) ?? {};
            const pago = datos.pagos.find((p) => String(p.mp_id) === String(b.payment_id));
            if (!pago) return json(res, { error: "pago demo no encontrado" }, 404);
            pago.estado = "pagado";
            pago.fecha = new Date().toISOString().slice(0, 10);
            pago.mp_status_detail = "accredited";
            pago.mp_net_received = pago.monto;
            const cobro = datos.cobros.find((c) => c.id === pago.cobro_id);
            if (cobro?.tipo === "unico") cobro.estado = "pagado";
            return json(res, {
              ok: true, estado: "pagado", pago_id: pago.id, cobro_id: pago.cobro_id,
              monto: pago.monto, moneda: cobro?.moneda || "CLP", detalle: pago.detalle,
              fecha: pago.fecha, demo: true,
            });
          }
          if (fn === "gestionar-suscripcion") {
            const b = (await cuerpoJson(req)) ?? {};
            const cobro = datos.cobros.find((c) => c.id === b.cobro_id);
            if (!cobro) return json(res, { error: "suscripción no encontrada" }, 404);
            cobro.estado = b.accion === "pausar" ? "pausada" : b.accion === "reanudar" ? "activa" : "cancelada";
            if (b.accion === "cancelar") cobro.link = null;
            return json(res, { ok: true, estado: cobro.estado, demo: true });
          }
          if (fn === "enviar-correos") {
            const b = (await cuerpoJson(req)) ?? {};
            const campana = datos.email_campanas.find((c) => c.id === b.campana_id);
            const enviados = Array.isArray(b.mensajes) ? b.mensajes.length : 0;
            if (campana) Object.assign(campana, {
              estado: "enviada", enviados, fallidos: 0,
              enviada_en: new Date().toISOString(),
            });
            return json(res, { ok: true, enviados, fallos: [], demo: true });
          }
          if (fn === "barbara-chat") {
            const b = (await cuerpoJson(req)) ?? {};
            if (b.accion === "chat") {
              const pedido = String(b.mensaje || "tu idea").trim();
              return json(res, {
                ok: true,
                demo: true,
                respuesta: `Podemos convertir **${pedido}** en una pieza mucho más concreta.\n\n## Enfoque recomendado\n- Abrir con una tensión real de la audiencia.\n- Resolver una sola idea por publicación.\n- Cerrar con una acción que calce con el objetivo de la marca.\n\n¿Quieres que lo trabajemos como carrusel, historia o video UGC?`,
              });
            }
            return json(res, { ok: true, demo: true });
          }
          if (fn === "reunion-notificar") {
            const b = (await cuerpoJson(req)) ?? {};
            const destinos = Array.isArray(b.invitados_email) ? b.invitados_email : [];
            // No se manda nada: se imprime en la consola de Vite para poder
            // revisar a quien le habria llegado y con que tono.
            console.log(
              `[demo] reunion-notificar (${b.motivo || "nueva"}) · "${b.titulo}" · ` +
                `${destinos.length} destinatario(s): ${destinos.map((d) => d.email).join(", ") || "ninguno"}` +
                (b.meet_url ? ` · link ${b.meet_url}` : ""),
            );
            return json(res, {
              ok: true, demo: true, motivo: b.motivo || "nueva",
              telegram: { ok: true }, emails: { enviados: destinos.length },
            });
          }
          if (fn === "tipo-cambio") return json(res, { tasas: datos.tipos_cambio, refrescado: false });
          if (fn === "mcp-condor-token") return json(res, { token: "demo-token", nombre: "demo" });
          return json(res, { ok: true, demo: true });
        }

        return json(res, {});
      });

      const dir = server.config.server;
      server.httpServer?.once("listening", () => {
        const p = server.httpServer.address()?.port ?? dir.port;
        console.log(
          `\n  \x1b[33m▲ MODO DEMO\x1b[0m  datos falsos, sin tocar la base real.` +
          `\n    Entra en \x1b[36mhttp://localhost:${p}/acceso\x1b[0m con cualquier clave.` +
          `\n    equipo:  \x1b[1m${CORREO_STAFF}\x1b[0m` +
          `\n    cliente: \x1b[1m${CORREO_CLIENTE}\x1b[0m  (cualquier correo que empiece con "cliente")\n`,
        );
      });
    },
  };
}
