import assert from "node:assert/strict";
import test from "node:test";
import {
  ejecutar,
  normalizarCuenta,
  parsearOpciones,
} from "./sincronizar-egresos.mjs";

const ENV = {
  META_ACCESS_TOKEN: "token-de-prueba",
  META_AD_ACCOUNT_ID: "123",
  SUPABASE_URL: "https://proyecto.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-de-prueba",
};

const CUENTA = {
  id: "act_123",
  name: "Condor",
  currency: "CLP",
  timezone_name: "America/Santiago",
};

/** Devuelve las respuestas en orden y guarda cada llamada para inspeccionarla. */
function grabadora(respuestas) {
  const llamadas = [];
  const fetchImpl = async (url, opciones = {}) => {
    llamadas.push({ url: String(url), opciones });
    const body = respuestas.shift();
    return new Response(JSON.stringify(body ?? null), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { llamadas, fetchImpl };
}

test("normaliza el identificador de la cuenta publicitaria", () => {
  assert.equal(normalizarCuenta(" act_123 456 "), "act_123456");
  assert.equal(normalizarCuenta(""), "");
});

test("calcula una ventana inclusiva de 35 dias", () => {
  assert.deepEqual(parsearOpciones([], new Date("2026-08-21T15:00:00Z")), {
    desde: "2026-07-18",
    hasta: "2026-08-21",
    dryRun: false,
  });
});

test("lee Meta y envia un RPC por cada campana y dia con gasto", async () => {
  const { llamadas, fetchImpl } = grabadora([
    [], // sin corte configurado
    CUENTA,
    {
      data: [
        {
          campaign_id: "c1",
          campaign_name: "Chile",
          spend: "1200",
          date_start: "2026-08-20",
          date_stop: "2026-08-20",
        },
        {
          campaign_id: "c2",
          campaign_name: "Peru",
          spend: "0",
          date_start: "2026-08-20",
          date_stop: "2026-08-20",
        },
      ],
    },
    "gasto-uuid",
  ]);

  const resultado = await ejecutar({
    env: ENV,
    argv: ["--desde", "2026-08-20", "--hasta", "2026-08-20"],
    fetchImpl,
  });

  assert.equal(resultado.filas, 1);
  assert.equal(resultado.guardados, 1);
  assert.equal(resultado.omitidos, 0);
  assert.equal(resultado.total, 1200);
  assert.equal(llamadas.length, 4);
  assert.match(llamadas[0].url, /meta_ads_ajustes/);
  assert.match(llamadas[2].url, /time_increment=1/);
  assert.equal(
    llamadas[1].opciones.headers.Authorization,
    "Bearer token-de-prueba",
  );

  const rpc = JSON.parse(llamadas[3].opciones.body);
  assert.equal(rpc.p_campana_id, "c1");
  assert.equal(rpc.p_monto, 1200);
  assert.equal(rpc.p_moneda, "CLP");
});

test("el corte adelanta el inicio de la ventana pedida a Meta", async () => {
  const { llamadas, fetchImpl } = grabadora([
    [{ contabilizar_desde: "2026-09-01" }],
    CUENTA,
    {
      data: [
        {
          campaign_id: "c1",
          campaign_name: "Chile",
          spend: "500",
          date_start: "2026-09-03",
          date_stop: "2026-09-03",
        },
      ],
    },
    "gasto-uuid",
  ]);

  const resultado = await ejecutar({
    env: ENV,
    argv: ["--desde", "2026-08-01", "--hasta", "2026-09-05"],
    fetchImpl,
  });

  assert.equal(resultado.corte, "2026-09-01");
  assert.equal(resultado.desde, "2026-09-01");
  assert.equal(resultado.guardados, 1);
  // Agosto ni siquiera se le pide a Meta.
  assert.match(llamadas[2].url, /2026-09-01/);
  assert.doesNotMatch(llamadas[2].url, /2026-08-01/);
});

test("si toda la ventana es anterior al corte no se consulta Meta", async () => {
  const { llamadas, fetchImpl } = grabadora([
    [{ contabilizar_desde: "2026-09-01" }],
  ]);

  const resultado = await ejecutar({
    env: ENV,
    argv: ["--desde", "2026-08-01", "--hasta", "2026-08-26"],
    fetchImpl,
  });

  assert.equal(resultado.filas, 0);
  assert.equal(resultado.guardados, 0);
  assert.equal(resultado.total, 0);
  assert.equal(llamadas.length, 1);
});

test("cuenta como omitido lo que el RPC descarta por el corte", async () => {
  const { fetchImpl } = grabadora([
    [{ contabilizar_desde: "2026-09-01" }],
    CUENTA,
    {
      data: [
        {
          campaign_id: "c1",
          campaign_name: "Chile",
          spend: "500",
          date_start: "2026-09-02",
          date_stop: "2026-09-02",
        },
      ],
    },
    null, // el RPC responde null: la fecha quedo antes del corte
  ]);

  const resultado = await ejecutar({
    env: ENV,
    argv: ["--desde", "2026-09-01", "--hasta", "2026-09-05"],
    fetchImpl,
  });

  assert.equal(resultado.guardados, 0);
  assert.equal(resultado.omitidos, 1);
});

test("una instalacion sin la tabla de ajustes sigue sincronizando", async () => {
  const llamadas = [];
  const respuestas = [
    CUENTA,
    {
      data: [
        {
          campaign_id: "c1",
          campaign_name: "Chile",
          spend: "300",
          date_start: "2026-08-20",
          date_stop: "2026-08-20",
        },
      ],
    },
    "gasto-uuid",
  ];
  const fetchImpl = async (url, opciones = {}) => {
    const texto = String(url);
    if (texto.includes("meta_ads_ajustes")) {
      return new Response(JSON.stringify({ message: "no existe" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }
    llamadas.push({ url: texto, opciones });
    return new Response(JSON.stringify(respuestas.shift()), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const resultado = await ejecutar({
    env: ENV,
    argv: ["--desde", "2026-08-20", "--hasta", "2026-08-20"],
    fetchImpl,
  });

  assert.equal(resultado.corte, "");
  assert.equal(resultado.desde, "2026-08-20");
  assert.equal(resultado.guardados, 1);
});
