/** Claim atómico para que dos workflows no paguen la misma pieza. */

export async function reclamarGeneracion(db, {
  barbaraClienteId, tipo, clave, actor = "barbara-clientes",
} = {}) {
  const filas = await db.rpc("barbara_reclamar_generacion", {
    p_barbara_cliente_id: barbaraClienteId,
    p_tipo: tipo,
    p_clave: clave,
    p_actor: actor,
  });
  return Array.isArray(filas) ? filas[0] || null : filas || null;
}

export async function confirmarGeneracion(db, run, { piezaId, detalles = {} } = {}) {
  if (!run?.id || !run?.claim_token || !piezaId) throw new Error("generación sin identidad para confirmar");
  const ok = await db.rpc("barbara_confirmar_generacion", {
    p_generacion_id: run.id,
    p_claim_token: run.claim_token,
    p_memoria_id: piezaId,
    p_detalles: detalles,
  });
  if (ok !== true) throw new Error("el claim de generación ya no era válido");
  return true;
}

export async function fallarGeneracion(db, run, error) {
  if (!run?.id || !run?.claim_token) return false;
  return db.rpc("barbara_fallar_generacion", {
    p_generacion_id: run.id,
    p_claim_token: run.claim_token,
    p_error: String(error?.message || error).slice(0, 1000),
  });
}

export async function cancelarGeneracion(db, run, motivo) {
  if (!run?.id || !run?.claim_token) return false;
  return db.rpc("barbara_cancelar_generacion", {
    p_generacion_id: run.id,
    p_claim_token: run.claim_token,
    p_motivo: String(motivo || "cancelada").slice(0, 500),
  });
}
