import assert from "node:assert/strict";
import test from "node:test";
import {
  ejecutar,
  normalizarCuenta,
  parsearOpciones,
} from "./sincronizar-egresos.mjs";

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
  const llamadas = [];
  const respuestas = [
    {
      id: "act_123",
      name: "Condor",
      currency: "CLP",
      timezone_name: "America/Santiago",
    },
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
  ];
  const fetchImpl = async (url, opciones = {}) => {
    llamadas.push({ url: String(url), opciones });
    const body = respuestas.shift();
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const resultado = await ejecutar({
    env: {
      META_ACCESS_TOKEN: "token-de-prueba",
      META_AD_ACCOUNT_ID: "123",
      SUPABASE_URL: "https://proyecto.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-de-prueba",
    },
    argv: ["--desde", "2026-08-20", "--hasta", "2026-08-20"],
    fetchImpl,
  });

  assert.equal(resultado.filas, 1);
  assert.equal(resultado.guardados, 1);
  assert.equal(resultado.total, 1200);
  assert.equal(llamadas.length, 3);
  assert.match(llamadas[1].url, /time_increment=1/);
  assert.equal(
    llamadas[0].opciones.headers.Authorization,
    "Bearer token-de-prueba",
  );

  const rpc = JSON.parse(llamadas[2].opciones.body);
  assert.equal(rpc.p_campana_id, "c1");
  assert.equal(rpc.p_monto, 1200);
  assert.equal(rpc.p_moneda, "CLP");
});
