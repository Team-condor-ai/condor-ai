import { readFileSync } from "node:fs";

/**
 * Datos de mentira para el modo demo del portal.
 *
 * ESTE ARCHIVO NUNCA VIAJA AL NAVEGADOR
 * ---------------------------------------------------------------------------
 * Lo importa `plugin-demo.mjs`, que corre en el servidor de desarrollo de Vite
 * (`apply: "serve"`). En un `npm run build` el plugin ni se carga, así que nada
 * de acá termina en `dist`. Es la diferencia entre "un modo demo" y "un agujero
 * de autenticación": el código que deja entrar sin clave no existe en el sitio
 * publicado, no es que esté apagado por una variable.
 *
 * Los casos están elegidos para que se vea lo que el modelo viejo no podía:
 * un cliente sin cobros, uno con tres encargos sueltos, un abono parcial, un
 * mensual vencido y una suscripción con meses de historial.
 */

const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const HOY = new Date();

/** El día 12 de hace N meses, en hora local (evita el corrimiento por UTC). */
const mesAtras = (n) =>
  new Date(HOY.getFullYear(), HOY.getMonth() - n, 12)
    .toISOString()
    .slice(0, 10);

const enDias = (n) => {
  const d = new Date(HOY);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const LINK = "https://www.mercadopago.cl/checkout/v1/redirect?pref_id=demo";

/**
 * Convierte la memoria acumulada de Barbara en gasto diario para el demo.
 * El archivo no contiene secretos: solo nombre, fecha y gasto que el workflow
 * de Meta ya guarda. Se calcula la diferencia entre lecturas para no sumar
 * acumulados varias veces.
 */
function gastosMetaDeBarbara() {
  try {
    const ruta = new URL(
      "../../../services/meta-analyzer/campaign-log.json",
      import.meta.url,
    );
    const historial = JSON.parse(readFileSync(ruta, "utf8"));
    const porCampana = new Map();
    for (const fila of historial) {
      if (!fila?.campana || !fila?.fecha || Number(fila.gasto) < 0) continue;
      const grupo = porCampana.get(fila.campana) ?? [];
      grupo.push(fila);
      porCampana.set(fila.campana, grupo);
    }

    const gastos = [];
    for (const [campana, filas] of porCampana) {
      filas.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
      let anterior = 0;
      for (const fila of filas) {
        const acumulado = Math.round(Number(fila.gasto) || 0);
        const monto = Math.max(0, acumulado - anterior);
        anterior = acumulado;
        if (monto > 0) gastos.push({ campana, fecha: fila.fecha, monto });
      }
    }
    return gastos;
  } catch {
    return [];
  }
}

export const CORREO_STAFF = "demo@condorai.cl";
export const CORREO_CLIENTE = "cliente@demo.cl";

export function crearDatos() {
  const clientes = [
    {
      id: uid(1),
      email: CORREO_CLIENTE,
      nombre: "Carmen Reyes",
      telefono: "+56912345678",
      negocio: "Tecnobox",
      plan: "Tienda Shopify",
      concepto: "Theme custom + catálogo + soporte",
      moneda: "CLP",
      web_url: "tecnobox.cl",
      archivado: false,
      notas: "Piden cambios cada semana. Ojo con los plazos.",
      creado_en: mesAtras(6) + "T10:00:00Z",
    },
    {
      id: uid(2),
      email: null,
      nombre: "Joaquín Silva",
      telefono: "+56987654321",
      negocio: "Howden",
      plan: null,
      concepto: "Encargos puntuales, se cobran contra boleta",
      moneda: "CLP",
      web_url: null,
      archivado: false,
      notas: null,
      creado_en: mesAtras(4) + "T10:00:00Z",
    },
    {
      id: uid(3),
      email: "hola@planetashop.cl",
      nombre: "Ana Pérez",
      telefono: "+56911112222",
      negocio: "Planeta Shop",
      plan: "Bárbara Go",
      concepto: "Contenido para redes con IA",
      moneda: "CLP",
      web_url: "planetashop.cl",
      archivado: false,
      notas: null,
      creado_en: mesAtras(2) + "T10:00:00Z",
    },
    {
      id: uid(4),
      email: "team@deltaforce.cl",
      nombre: "Luis Rojas",
      telefono: null,
      negocio: "Delta Force GHL",
      plan: null,
      concepto: null,
      moneda: "CLP",
      web_url: null,
      archivado: false,
      notas: "Recién entró. Todavía no le cobramos nada.",
      creado_en: HOY.toISOString().slice(0, 10) + "T10:00:00Z",
    },
    {
      id: uid(6),
      email: "hi@northpeak.io",
      nombre: "Sarah Kim",
      telefono: null,
      negocio: "North Peak",
      plan: "Landing Express",
      concepto: "Landing + campañas",
      moneda: "USD",
      web_url: null,
      archivado: false,
      notas: "Cobra en dólares: sirve para ver la conversión a CLP.",
      creado_en: mesAtras(3) + "T10:00:00Z",
    },
    {
      id: uid(5),
      email: "viejo@cliente.cl",
      nombre: "Cliente Antiguo",
      telefono: null,
      negocio: "Ex Cliente SpA",
      plan: null,
      concepto: null,
      moneda: "CLP",
      web_url: null,
      archivado: true,
      notas: null,
      creado_en: mesAtras(9) + "T10:00:00Z",
    },
  ];

  // Los campos viejos siguen existiendo en la base (se borran en una segunda
  // migración), así que se rellenan para que nada que todavía los lea explote.
  for (const c of clientes) {
    Object.assign(c, {
      setup_monto: 0,
      mensual_monto: 0,
      setup_estado: "pendiente",
      mensual_estado: "pendiente",
      proximo_cobro: null,
      link_setup: null,
      link_mensual: null,
      link_paypal: null,
      cobra_setup: true,
      cobra_mensual: true,
    });
  }

  const cobro = (
    id,
    cliente_id,
    numero,
    tipo,
    titulo,
    monto,
    estado,
    extra = {},
  ) => ({
    id: uid(id),
    cliente_id,
    numero,
    tipo,
    titulo,
    monto,
    moneda: "CLP",
    estado,
    proximo_cobro: null,
    mp_preapproval_id: null,
    link: null,
    ultimo_recordatorio_en: null,
    creado_por: CORREO_STAFF,
    creado_en: mesAtras(6) + "T10:00:00Z",
    ...extra,
  });

  const cobros = [
    // Tecnobox: setup cerrado + una suscripción que Mercado Pago cobra sola
    cobro(101, uid(1), 1, "unico", "Setup tienda", 1200000, "pagado", {
      link: LINK,
    }),
    cobro(102, uid(1), 2, "mensual", "Mantención mensual", 180000, "activa", {
      proximo_cobro: enDias(9),
      mp_preapproval_id: "2c9380...demo",
      link: LINK,
    }),
    // Cobro abierto para recorrer como cliente el checkout y su retorno
    // verificado, sin tocar Mercado Pago ni la base real.
    cobro(112, uid(1), 3, "unico", "Campaña de lanzamiento", 245000, "pendiente", {
      creado_en: HOY.toISOString(),
    }),

    // Howden: encargos sueltos. El tercero SIN TÍTULO, para ver el "Cobro 3".
    cobro(103, uid(2), 1, "unico", "Landing de junio", 450000, "pagado", {
      creado_en: mesAtras(4) + "T10:00:00Z",
    }),
    cobro(
      104,
      uid(2),
      2,
      "unico",
      "Landing de septiembre",
      520000,
      "pendiente",
      { creado_en: mesAtras(0) + "T10:00:00Z" },
    ),
    cobro(105, uid(2), 3, "unico", null, 90000, "pendiente", {
      creado_en: mesAtras(0) + "T10:00:00Z",
    }),

    // Planeta Shop: mensual VENCIDO (la fecha ya pasó)
    cobro(106, uid(3), 1, "unico", "Setup", 300000, "pagado", {
      link: LINK,
      creado_en: mesAtras(2) + "T10:00:00Z",
    }),
    cobro(107, uid(3), 2, "mensual", "Bárbara Go", 89000, "activa", {
      proximo_cobro: enDias(-11),
      mp_preapproval_id: "2c9380...demo2",
      link: LINK,
      creado_en: mesAtras(2) + "T10:00:00Z",
    }),

    // Delta Force: cliente nuevo, todavía sin cobrarle nada.

    // North Peak paga en USD: en las gráficas tiene que aparecer convertido.
    {
      ...cobro(110, uid(6), 1, "unico", "Landing Express", 1500, "pagado", {
        creado_en: mesAtras(3) + "T10:00:00Z",
      }),
      moneda: "USD",
    },
    {
      ...cobro(111, uid(6), 2, "mensual", "Mantención", 120, "activa", {
        proximo_cobro: enDias(14),
        mp_preapproval_id: "demo-usd",
      }),
      moneda: "USD",
    },
  ];

  const pagos = [];
  let np = 200;
  const pago = (
    cobro_id,
    cliente_id,
    tipo,
    monto,
    f,
    estado = "pagado",
    extra = {},
  ) =>
    pagos.push({
      id: uid(np++),
      cliente_id,
      cobro_id,
      tipo,
      monto,
      estado,
      mp_id: estado === "pagado" ? "demo" : null,
      detalle: extra.detalle ?? null,
      fecha: f,
      metodo: extra.metodo ?? "Mercado Pago",
      link: extra.link ?? null,
      periodo: extra.periodo ?? null,
      cobro_enviado_en: null,
      creado_en: f + "T12:00:00Z",
    });

  pago(uid(101), uid(1), "unico", 1200000, mesAtras(6), "pagado", {
    detalle: "Setup tienda",
  });
  // Seis meses de la suscripción: justo lo que ANTES no quedaba registrado.
  for (let i = 5; i >= 0; i--) {
    pago(uid(102), uid(1), "mensual", 180000, mesAtras(i), "pagado", {
      detalle: "Mantención mensual",
      periodo: mesAtras(i).slice(0, 8) + "01",
    });
  }
  pago(uid(103), uid(2), "unico", 450000, mesAtras(4), "pagado", {
    detalle: "Landing de junio",
    metodo: "Transferencia",
  });
  // Un abono parcial: el cobro queda abierto esperando el resto.
  pago(uid(104), uid(2), "unico", 200000, mesAtras(0), "pagado", {
    detalle: "Primera cuota",
    metodo: "Transferencia",
  });
  pago(uid(106), uid(3), "unico", 300000, mesAtras(2), "pagado", {
    detalle: "Setup",
  });
  for (let i = 2; i >= 1; i--) {
    pago(uid(107), uid(3), "mensual", 89000, mesAtras(i), "pagado", {
      detalle: "Bárbara Go",
      periodo: mesAtras(i).slice(0, 8) + "01",
    });
  }

  pago(uid(110), uid(6), "unico", 1500, mesAtras(3), "pagado", {
    detalle: "Landing Express",
  });
  for (let i = 2; i >= 0; i--) {
    pago(uid(111), uid(6), "mensual", 120, mesAtras(i), "pagado", {
      detalle: "Mantención",
      periodo: mesAtras(i).slice(0, 8) + "01",
    });
  }

  // Rat.IA: producto propio, cobrado por Flow. Sus suscriptores viven aparte
  // de `clientes` — la decisión ya estaba escrita en `ingresos_ratia.sql`.
  const suscriptores_ratia = [
    {
      id: uid(401),
      nombre: "Rodrigo Fuentes",
      email: "rodrigo@gmail.com",
      telegram: "rfuentes",
      telefono: null,
      notas: "Entró por el grupo de ofertas. Pide alertas de zapatillas.",
      plan: "fundador",
      monto: 2990,
      moneda: "CLP",
      estado: "activa",
      inicio: mesAtras(5),
      proximo_cobro: enDias(6),
      flow_subscription_id: "flow-1",
      creado_por: CORREO_STAFF,
      creado_en: mesAtras(5) + "T10:00:00Z",
    },
    {
      id: uid(402),
      nombre: "Camila Soto",
      email: null,
      telegram: "camisoto",
      telefono: "+56955553333",
      notas: null,
      plan: "fundador",
      monto: 2990,
      moneda: "CLP",
      estado: "activa",
      inicio: mesAtras(4),
      proximo_cobro: enDias(19),
      flow_subscription_id: "flow-2",
      creado_por: CORREO_STAFF,
      creado_en: mesAtras(4) + "T10:00:00Z",
    },
    {
      id: uid(403),
      nombre: "Ignacio Vera",
      email: "nacho@vera.cl",
      telegram: null,
      telefono: null,
      notas: "Pidió factura.",
      plan: "regular",
      monto: 4990,
      moneda: "CLP",
      estado: "activa",
      inicio: mesAtras(2),
      proximo_cobro: enDias(11),
      flow_subscription_id: "flow-3",
      creado_por: CORREO_STAFF,
      creado_en: mesAtras(2) + "T10:00:00Z",
    },
    {
      id: uid(404),
      nombre: "Paula Núñez",
      email: "paula@correo.cl",
      telegram: "paunz",
      telefono: null,
      notas: "Pausó por el verano, vuelve en marzo.",
      plan: "regular",
      monto: 4990,
      moneda: "CLP",
      estado: "pausada",
      inicio: mesAtras(6),
      proximo_cobro: null,
      flow_subscription_id: "flow-4",
      creado_por: CORREO_STAFF,
      creado_en: mesAtras(6) + "T10:00:00Z",
    },
    {
      id: uid(405),
      nombre: "Tomás Bravo",
      email: null,
      telegram: "tbravo",
      telefono: null,
      notas: "Se fue: decía que le llegaban muchas alertas.",
      plan: "fundador",
      monto: 2990,
      moneda: "CLP",
      estado: "cancelada",
      inicio: mesAtras(7),
      proximo_cobro: null,
      flow_subscription_id: "flow-5",
      creado_por: CORREO_STAFF,
      creado_en: mesAtras(7) + "T10:00:00Z",
    },
    {
      id: uid(406),
      nombre: "Valentina Ruiz",
      email: "vale@ruiz.cl",
      telegram: "valeruiz",
      telefono: null,
      notas: null,
      plan: "regular",
      monto: 4990,
      moneda: "CLP",
      estado: "activa",
      inicio: mesAtras(0),
      proximo_cobro: enDias(28),
      flow_subscription_id: "flow-6",
      creado_por: CORREO_STAFF,
      creado_en: mesAtras(0) + "T10:00:00Z",
    },
  ];

  // Los ingresos son lo que Flow cobró de verdad: altas y renovaciones. NO se
  // derivan de la lista de arriba, que diría lo que deberían pagar.
  const ingresos_ratia = [];
  let ni = 500;
  const activasEn = [1, 1, 2, 3, 4, 4, 5]; // cuántas cobraron cada mes
  for (let i = 6; i >= 0; i--) {
    const n = activasEn[6 - i];
    for (let k = 0; k < n; k++) {
      ingresos_ratia.push({
        id: uid(ni++),
        monto_bruto: k % 3 === 2 ? 4990 : 2990,
        tipo: k === 0 && i > 4 ? "alta" : "renovacion",
        plan: k % 3 === 2 ? "regular" : "fundador",
        flow_subscription_id: "flow-" + ((k % 5) + 1),
        creado_en: mesAtras(i) + "T09:00:00Z",
      });
    }
  }

  const reuniones = [
    {
      id: uid(590),
      titulo: "Revisión mensual Tecnobox",
      descripcion: "Métricas, catálogo y prioridades del próximo ciclo.",
      fecha_hora: enDias(3) + "T15:30:00-04:00",
      duracion_min: 45,
      cliente: "Tecnobox",
      meet_url: "https://meet.google.com/",
      creado_por: uid(900),
      created_at: mesAtras(0) + "T10:00:00Z",
    },
    {
      id: uid(591),
      titulo: "Kickoff Delta Force",
      descripcion: "Alinear alcance y responsables.",
      fecha_hora: enDias(8) + "T11:00:00-04:00",
      duracion_min: 60,
      cliente: "Delta Force GHL",
      meet_url: null,
      creado_por: uid(900),
      created_at: mesAtras(0) + "T10:00:00Z",
    },
    {
      id: uid(592),
      titulo: "Demo Bárbara",
      descripcion: "Presentación del flujo de contenidos.",
      fecha_hora: enDias(-5) + "T12:00:00-04:00",
      duracion_min: 30,
      cliente: "Planeta Shop",
      meet_url: null,
      creado_por: uid(900),
      created_at: mesAtras(1) + "T10:00:00Z",
    },
  ];

  const tareas = [
    {
      id: uid(601),
      titulo: "Cerrar propuesta para Delta Force",
      descripcion: "Definir alcance y conectar el producto correcto.",
      estado: "por_hacer",
      prioridad: "alta",
      asignado_a: "Joaquín",
      cliente_id: uid(4),
      inicio: enDias(1),
      vence: enDias(2),
      etiquetas: ["ventas"],
      orden: 10,
      hecha_en: null,
      creado_en: mesAtras(0) + "T10:00:00Z",
    },
    {
      id: uid(602),
      titulo: "Revisar carruseles de agosto",
      descripcion: "QA de tono y ortografía antes de programar.",
      estado: "en_curso",
      prioridad: "media",
      asignado_a: "Bárbara",
      cliente_id: uid(3),
      inicio: enDias(1),
      vence: enDias(1),
      etiquetas: ["contenido", "qa"],
      orden: 10,
      hecha_en: null,
      creado_en: mesAtras(0) + "T10:00:00Z",
    },
    {
      id: uid(603),
      titulo: "Esperar accesos de Shopify",
      descripcion: "Carmen debe enviar permisos de colaborador.",
      estado: "bloqueada",
      prioridad: "urgente",
      asignado_a: "Alejandro",
      cliente_id: uid(1),
      inicio: enDias(-2),
      vence: enDias(-1),
      etiquetas: ["cliente"],
      orden: 10,
      hecha_en: null,
      creado_en: mesAtras(0) + "T10:00:00Z",
    },
    {
      id: uid(604),
      titulo: "Conciliar pagos de julio",
      descripcion: null,
      estado: "hecha",
      prioridad: "media",
      asignado_a: "Maximiliano",
      cliente_id: null,
      inicio: enDias(-5),
      vence: enDias(-5),
      etiquetas: ["finanzas"],
      orden: 10,
      hecha_en: enDias(-4) + "T18:00:00Z",
      creado_en: mesAtras(1) + "T10:00:00Z",
    },
  ];
  const metas = [
    {
      id: uid(620),
      titulo: "Llegar a $1,5M recurrentes",
      detalle: "Con servicios activos y suscripciones cobrando.",
      metrica: "recurrente",
      objetivo: 1500000,
      avance: 0,
      hasta: enDias(90),
      estado: "activa",
      creado_en: mesAtras(1) + "T10:00:00Z",
    },
    {
      id: uid(621),
      titulo: "10 suscriptores Rat.IA",
      detalle: "Validar retención antes de escalar adquisición.",
      metrica: "suscriptores_ratia",
      objetivo: 10,
      avance: 0,
      hasta: enDias(60),
      estado: "activa",
      creado_en: mesAtras(1) + "T10:00:00Z",
    },
  ];

  const email_contactos = clientes
    .filter((c) => c.email && !c.archivado)
    .map((c, i) => ({
      id: uid(700 + i),
      email: c.email,
      nombre: c.nombre,
      empresa: c.negocio,
      cliente_id: c.id,
      estado: i < 3 ? "suscrito" : "no_suscrito",
      etiquetas: ["cliente", c.plan ? "activo" : "prospecto"],
      fuente: "clientes",
      consentimiento_en: i < 3 ? mesAtras(2) + "T10:00:00Z" : null,
      creado_en: mesAtras(3) + "T10:00:00Z",
    }));
  const email_campanas = [
    {
      id: uid(750),
      nombre: "Novedades de julio",
      asunto: "Lo nuevo en Cóndor",
      preheader: "Productos y mejoras del mes",
      cuerpo: "Hola {{nombre}},\n\nEstas son las novedades.",
      estado: "enviada",
      programada_para: mesAtras(1) + "T14:00:00Z",
      destinatarios: email_contactos
        .filter((x) => x.estado === "suscrito")
        .map((x) => x.id),
      total_destinatarios: 3,
      enviados: 3,
      fallidos: 0,
      creado_en: mesAtras(1) + "T10:00:00Z",
      enviada_en: mesAtras(1) + "T14:01:00Z",
    },
  ];

  const gastosMetaSemilla = gastosMetaDeBarbara();
  const campanaIds = new Map(
    [...new Set(gastosMetaSemilla.map((g) => g.campana))].map((nombre, i) => [
      nombre,
      `campana-demo-${i + 1}`,
    ]),
  );

  const cuentas = [
    {
      id: uid(801),
      codigo: "1101",
      nombre: "Caja",
      tipo: "activo",
      corriente: true,
      liquida: true,
      activa: true,
      orden: 10,
    },
    {
      id: uid(802),
      codigo: "1102",
      nombre: "Banco",
      tipo: "activo",
      corriente: true,
      liquida: true,
      activa: true,
      orden: 20,
    },
    {
      id: uid(803),
      codigo: "2101",
      nombre: "Proveedores por pagar",
      tipo: "pasivo",
      corriente: true,
      liquida: false,
      activa: true,
      orden: 30,
    },
    {
      id: uid(804),
      codigo: "3101",
      nombre: "Capital",
      tipo: "patrimonio",
      corriente: false,
      liquida: false,
      activa: true,
      orden: 40,
    },
    {
      id: uid(805),
      codigo: "4101",
      nombre: "Ventas de servicios",
      tipo: "ingreso",
      corriente: true,
      liquida: false,
      activa: true,
      orden: 50,
    },
    {
      id: uid(806),
      codigo: "5101",
      nombre: "Sueldos y honorarios",
      tipo: "gasto",
      corriente: true,
      liquida: false,
      activa: true,
      orden: 60,
    },
    {
      id: uid(807),
      codigo: "5103",
      nombre: "Herramientas y software",
      tipo: "gasto",
      corriente: true,
      liquida: false,
      activa: true,
      orden: 70,
    },
    {
      id: uid(808),
      codigo: "2104",
      nombre: "Meta Ads por pagar",
      tipo: "pasivo",
      corriente: true,
      liquida: false,
      activa: true,
      orden: 80,
    },
    {
      id: uid(809),
      codigo: "5104",
      nombre: "Publicidad y campanas",
      tipo: "gasto",
      corriente: true,
      liquida: false,
      activa: true,
      orden: 90,
    },
  ];
  const linea = (id, cuenta_id, debe, haber) => ({
    id: uid(id),
    cuenta_id,
    debe,
    haber,
    detalle: null,
  });
  const asientosMeta = gastosMetaSemilla.map((g, i) => ({
    id: uid(9000 + i * 3),
    fecha: g.fecha,
    glosa: `Meta Ads - ${g.campana}`,
    origen: "meta_ads",
    referencia: `meta-demo:${g.campana}:${g.fecha}`,
    documento: null,
    creado_en: g.fecha + "T23:00:00Z",
    asiento_lineas: [
      linea(9001 + i * 3, uid(809), g.monto, 0),
      linea(9002 + i * 3, uid(808), 0, g.monto),
    ],
  }));
  const asientos = [
    {
      id: uid(820),
      fecha: mesAtras(0),
      glosa: "Cobros del mes",
      origen: "cobro",
      documento: null,
      creado_en: mesAtras(0) + "T12:00:00Z",
      asiento_lineas: [
        linea(821, uid(802), 1167000, 0),
        linea(822, uid(805), 0, 1167000),
      ],
    },
    {
      id: uid(823),
      fecha: enDias(-6),
      glosa: "Herramientas de IA",
      origen: "manual",
      documento: "F-204",
      creado_en: enDias(-6) + "T12:00:00Z",
      asiento_lineas: [
        linea(824, uid(807), 145000, 0),
        linea(825, uid(802), 0, 145000),
      ],
    },
    {
      id: uid(826),
      fecha: enDias(-3),
      glosa: "Honorarios",
      origen: "fijo",
      documento: null,
      creado_en: enDias(-3) + "T12:00:00Z",
      asiento_lineas: [
        linea(827, uid(806), 480000, 0),
        linea(828, uid(802), 0, 480000),
      ],
    },
    ...asientosMeta,
  ];
  const asiento_lineas = asientos.flatMap((a) =>
    a.asiento_lineas.map((l) => ({ ...l, asiento_id: a.id })),
  );
  const gastos_meta = gastosMetaSemilla.map((g, i) => ({
    id: uid(12000 + i),
    fecha: g.fecha,
    cuenta_publicitaria: "act_demo",
    nombre_cuenta: "Condor AI",
    campana_id: campanaIds.get(g.campana),
    campana_nombre: g.campana,
    monto_original: g.monto,
    moneda_original: "CLP",
    tasa_a_clp: 1,
    monto_clp: g.monto,
    asiento_id: uid(9000 + i * 3),
    datos: { plataforma: "meta", fuente: "campaign-log.json" },
    sincronizado_en: g.fecha + "T23:00:00Z",
  }));
  const saldos_cuentas = cuentas.map((c) => {
    const ls = asiento_lineas.filter((l) => l.cuenta_id === c.id);
    const debe = ls.reduce((t, l) => t + l.debe, 0),
      haber = ls.reduce((t, l) => t + l.haber, 0);
    return {
      ...c,
      total_debe: debe,
      total_haber: haber,
      saldo: ["activo", "gasto"].includes(c.tipo) ? debe - haber : haber - debe,
    };
  });
  const gastos_fijos = [
    {
      id: uid(840),
      nombre: "Honorarios del equipo",
      monto: 480000,
      moneda: "CLP",
      cuenta_id: uid(806),
      dia_del_mes: 28,
      activo: true,
      notas: null,
      creado_en: mesAtras(4) + "T10:00:00Z",
    },
    {
      id: uid(841),
      nombre: "Herramientas de IA",
      monto: 145000,
      moneda: "CLP",
      cuenta_id: uid(807),
      dia_del_mes: 5,
      activo: true,
      notas: "APIs y software",
      creado_en: mesAtras(3) + "T10:00:00Z",
    },
    {
      id: uid(842),
      nombre: "Publicidad base",
      monto: 120000,
      moneda: "CLP",
      cuenta_id: uid(809),
      dia_del_mes: 10,
      activo: true,
      notas: null,
      creado_en: mesAtras(2) + "T10:00:00Z",
    },
  ];

  const admin_profiles = [
    {
      id: uid(900),
      email: CORREO_STAFF,
      nombre: "demo",
      created_at: mesAtras(9) + "T10:00:00Z",
    },
  ];

  // Valores reales del 21-ago-2026, para que el demo muestre cifras creíbles.
  const tipos_cambio = [
    {
      moneda: "CLP",
      a_clp: 1,
      fuente: "fijo",
      actualizado_en: new Date().toISOString(),
    },
    {
      moneda: "USD",
      a_clp: 922.31,
      fuente: "demo",
      actualizado_en: new Date().toISOString(),
    },
    {
      moneda: "COP",
      a_clp: 0.3015,
      fuente: "demo",
      actualizado_en: new Date().toISOString(),
    },
    {
      moneda: "PEN",
      a_clp: 274.98,
      fuente: "demo",
      actualizado_en: new Date().toISOString(),
    },
  ];

  const api_creditos = [
    {
      proveedor: "anthropic", nombre: "Anthropic", estado: "ok", saldo: null,
      unidad_saldo: null, uso_periodo: null, unidad_uso: "tokens",
      tokens_entrada: 842300, tokens_salida: 126400, costo_usd: 7.84,
      periodo_desde: mesAtras(1) + "T00:00:00Z", detalle: "Datos de demostración.",
      fuente: "Usage & Cost Admin API · demo", actualizado_en: new Date().toISOString(), orden: 10,
    },
    {
      proveedor: "higgsfield", nombre: "Higgsfield", estado: "ok", saldo: 1240,
      unidad_saldo: "créditos", uso_periodo: 286, unidad_uso: "créditos",
      tokens_entrada: null, tokens_salida: null, costo_usd: null,
      periodo_desde: mesAtras(1) + "T00:00:00Z", detalle: "Datos de demostración.",
      fuente: "Higgsfield CLI · demo", actualizado_en: new Date().toISOString(), orden: 20,
    },
    {
      proveedor: "blotato", nombre: "Blotato", estado: "advertencia", saldo: null,
      unidad_saldo: "créditos", uso_periodo: null, unidad_uso: null,
      tokens_entrada: null, tokens_salida: null, costo_usd: null,
      periodo_desde: mesAtras(1) + "T00:00:00Z",
      detalle: "Conexión verificada; Blotato no expone el saldo por API.",
      fuente: "Blotato API · demo", actualizado_en: new Date().toISOString(), orden: 30,
    },
  ];

  return {
    clientes,
    cobros,
    pagos,
    admin_profiles,
    tipos_cambio,
    suscriptores_ratia,
    ingresos_ratia,
    reuniones,
    tareas,
    metas,
    api_creditos,
    email_contactos,
    email_campanas,
    email_envios: [],
    cuentas,
    saldos_cuentas,
    asientos,
    asiento_lineas,
    asientos_descuadrados: [],
    gastos_fijos,
    gastos_meta,
  };
}
