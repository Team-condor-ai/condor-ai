/**
 * Crea un cliente real de prueba en un proyecto Supabase.
 *
 * Requiere variables de proceso; nunca lee ni escribe secretos en archivos:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TEST_CLIENT_PASSWORD
 */
import { createClient } from "@supabase/supabase-js";

const url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
const password = String(process.env.TEST_CLIENT_PASSWORD || "");
const email = String(process.env.TEST_CLIENT_EMAIL || "cliente.prueba@condorai.cl")
  .trim()
  .toLowerCase();

if (!url || !key || password.length < 12) {
  throw new Error(
    "Faltan SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o TEST_CLIENT_PASSWORD (mínimo 12 caracteres).",
  );
}

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: usuarios, error: errorLista } = await sb.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (errorLista) throw errorLista;

let usuario = usuarios.users.find((u) => u.email?.toLowerCase() === email);
if (!usuario) {
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { password_set: true, entorno: "prueba_mercadopago" },
  });
  if (error) throw error;
  usuario = data.user;
} else {
  const { error } = await sb.auth.admin.updateUserById(usuario.id, {
    password,
    email_confirm: true,
    user_metadata: { ...usuario.user_metadata, password_set: true, entorno: "prueba_mercadopago" },
  });
  if (error) throw error;
}

let { data: cliente, error: errorCliente } = await sb
  .from("clientes")
  .select("*")
  .eq("email", email)
  .limit(1)
  .maybeSingle();
if (errorCliente) throw errorCliente;

if (!cliente) {
  const resultado = await sb.from("clientes").insert({
    email,
    nombre: "Cliente Prueba",
    negocio: "Demo Mercado Pago",
    plan: "Cuenta de prueba",
    concepto: "Recorrido de cobro y confirmación de Mercado Pago",
    moneda: "CLP",
    archivado: false,
  }).select("*").single();
  if (resultado.error) throw resultado.error;
  cliente = resultado.data;
}

const { data: existente, error: errorCobro } = await sb
  .from("cobros")
  .select("id")
  .eq("cliente_id", cliente.id)
  .eq("titulo", "Prueba Mercado Pago")
  .neq("estado", "anulado")
  .limit(1)
  .maybeSingle();
if (errorCobro) throw errorCobro;

if (!existente) {
  const { data: ultimo } = await sb.from("cobros")
    .select("numero")
    .eq("cliente_id", cliente.id)
    .order("numero", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await sb.from("cobros").insert({
    cliente_id: cliente.id,
    numero: Number(ultimo?.numero || 0) + 1,
    tipo: "unico",
    titulo: "Prueba Mercado Pago",
    monto: 1000,
    moneda: "CLP",
    estado: "pendiente",
    creado_por: "script:prueba-mercadopago",
  });
  if (error) throw error;
}

// Cobro mensual opcional (TEST_CLIENT_MENSUAL=1). Sirve para recorrer el alta
// de suscripcion: el pago unico de arriba solo ejercita Checkout Pro, y la
// mensualidad es justamente la parte que se reescribio.
//
// Se deja pendiente a proposito: "pendiente" es el unico estado en que el
// portal muestra el boton "Activar con Mercado Pago". Si se creara "activa"
// no habria nada que apretar.
if (process.env.TEST_CLIENT_MENSUAL === "1") {
  const { data: yaHay, error: errorMensual } = await sb
    .from("cobros")
    .select("id")
    .eq("cliente_id", cliente.id)
    .eq("titulo", "Prueba mensualidad Mercado Pago")
    .neq("estado", "anulado")
    .limit(1)
    .maybeSingle();
  if (errorMensual) throw errorMensual;

  if (!yaHay) {
    const { data: ultimo } = await sb.from("cobros")
      .select("numero")
      .eq("cliente_id", cliente.id)
      .order("numero", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await sb.from("cobros").insert({
      cliente_id: cliente.id,
      numero: Number(ultimo?.numero || 0) + 1,
      tipo: "mensual",
      titulo: "Prueba mensualidad Mercado Pago",
      monto: 1000,
      moneda: "CLP",
      estado: "pendiente",
      creado_por: "script:prueba-mercadopago",
    });
    if (error) throw error;
  }
}

console.log(JSON.stringify({
  ok: true,
  email,
  mensual: process.env.TEST_CLIENT_MENSUAL === "1",
  cliente_id: cliente.id,
  auth_user_id: usuario.id,
  acceso: `${process.env.PORTAL_URL || "https://condorai.cl/acceso"}`,
}));
