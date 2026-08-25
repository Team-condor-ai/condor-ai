// Reexporta la misma compuerta determinista que usa la Edge Function. Tener
// una sola implementación evita que el chat aprenda con reglas distintas a
// las que prueban los tests del motor.
export * from "../../supabase/functions/_shared/barbara-aprendizaje.mjs";
