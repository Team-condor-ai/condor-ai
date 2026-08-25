// Contrato compartido con la Edge Function de ingesta. Una sola definición
// evita que el portal/worker interprete distinto los contadores del proveedor.
export * from "../../supabase/functions/_shared/barbara-metricas.mjs";
