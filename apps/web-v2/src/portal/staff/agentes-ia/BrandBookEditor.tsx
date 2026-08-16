import { useState } from "react";
import { sb } from "../../lib/supabase";
import { Ico } from "../../disenio/iconos";
import { MAX_COLORES_PALETA, type BarbaraBrandBook, type ColorMarca } from "../../agentes-ia/tipos";

type Props = {
  barbaraClienteId: string;
  negocio: string;
  rubro: string | null;
  inicial: BarbaraBrandBook | null;
  onGuardado: () => void;
};

/**
 * Editor del brand book de un cliente de Bárbara: paleta de colores, tipografía,
 * logo (sube a Supabase Storage) y detalles a considerar.
 *
 * EL BOTÓN "GENERAR BORRADOR CON IA" NO GUARDA SOLO
 * ---------------------------------------------------------------------------
 * Llama a la Edge Function `barbara-sugerir-marca` (Claude + web_search) y
 * PRELLENA el formulario con lo que propone. Staff revisa, edita si hace
 * falta, y recién ahí aprieta "Guardar". Nunca se persiste directo desde la
 * IA — eso lo pidió explícitamente el encargo.
 */
export function BrandBookEditor({ barbaraClienteId, negocio, rubro, inicial, onGuardado }: Props) {
  const [paleta, setPaleta] = useState<ColorMarca[]>(inicial?.paleta_colores ?? []);
  const [tipografia, setTipografia] = useState(inicial?.tipografia ?? "");
  const [detalles, setDetalles] = useState(inicial?.detalles ?? "");
  const [logoUrl, setLogoUrl] = useState(inicial?.logo_url ?? "");
  const [subiendoLogo, setSubiendoLogo] = useState(false);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  const [link, setLink] = useState("");
  const [generando, setGenerando] = useState(false);
  const [errorIA, setErrorIA] = useState("");

  function setColor(i: number, campo: keyof ColorMarca, valor: string) {
    const n = [...paleta];
    n[i] = { ...n[i], [campo]: valor };
    setPaleta(n);
  }

  async function subirLogo(archivo: File) {
    setSubiendoLogo(true);
    setError("");
    const limpio = archivo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const ruta = `${barbaraClienteId}/${Date.now()}-${limpio}`;
    const { error } = await sb.storage
      .from("barbara-logos")
      .upload(ruta, archivo, { upsert: true });
    if (error) {
      setSubiendoLogo(false);
      setError(
        /bucket not found/i.test(error.message)
          ? "Falta crear el bucket `barbara-logos` en Supabase Storage."
          : error.message,
      );
      return;
    }
    const { data } = sb.storage.from("barbara-logos").getPublicUrl(ruta);
    setLogoUrl(data.publicUrl);
    setSubiendoLogo(false);
  }

  async function guardar() {
    setGuardando(true);
    setError("");
    setOk(false);
    const { error } = await sb.from("barbara_brand_book").upsert(
      {
        barbara_cliente_id: barbaraClienteId,
        paleta_colores: paleta.filter((c) => c.hex.trim()),
        tipografia: tipografia || null,
        logo_url: logoUrl || null,
        detalles: detalles || null,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: "barbara_cliente_id" },
    );
    setGuardando(false);
    if (error) setError(error.message);
    else {
      setOk(true);
      onGuardado();
    }
  }

  async function generarConIA() {
    setGenerando(true);
    setErrorIA("");
    try {
      const { data, error } = await sb.functions.invoke("barbara-sugerir-marca", {
        body: { negocio, rubro, link: link.trim() || null },
      });
      if (error) throw error;
      const propuesta = (data as { propuesta?: BarbaraBrandBook }).propuesta;
      if (!propuesta) throw new Error("La IA no devolvió una propuesta.");
      // Prellena — NO guarda. Staff revisa y edita antes de "Guardar".
      if (propuesta.paleta_colores?.length) setPaleta(propuesta.paleta_colores);
      if (propuesta.tipografia) setTipografia(propuesta.tipografia);
      if (propuesta.detalles) setDetalles(propuesta.detalles);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorIA(
        /not found|404|failed to send/i.test(msg)
          ? "Falta desplegar la Edge Function `barbara-sugerir-marca`."
          : msg,
      );
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="aviso" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <b>Generar borrador con IA</b>
        <small>
          Pega el link de Instagram o del sitio web del negocio (opcional) y
          Bárbara propone una paleta, tipografía y detalles. Revisa y edita
          antes de guardar — no se guarda solo.
        </small>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="campo"
            placeholder="instagram.com/el-negocio (opcional)"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <button className="btn" onClick={generarConIA} disabled={generando}>
            {generando ? "Generando…" : "Generar borrador"}
          </button>
        </div>
        {errorIA && <p className="error">{errorIA}</p>}
      </div>

      <section className="bloque">
        <h3>Paleta de colores</h3>
        {paleta.map((c, i) => (
          <div className="fila-item" key={i}>
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : "#888888"}
              onChange={(e) => setColor(i, "hex", e.target.value)}
              style={{ width: 40, height: 38, padding: 2, border: "1px solid var(--borde)", borderRadius: 8 }}
            />
            <input
              className="campo corto"
              style={{ width: 100 }}
              placeholder="#C6FF00"
              value={c.hex}
              onChange={(e) => setColor(i, "hex", e.target.value)}
            />
            <input
              className="campo"
              placeholder="Uso: acento, fondo, texto…"
              value={c.uso}
              onChange={(e) => setColor(i, "uso", e.target.value)}
            />
            <button
              className="icono-btn"
              title="Quitar"
              onClick={() => setPaleta(paleta.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
        ))}
        <button
          className="btn"
          onClick={() => setPaleta([...paleta, { hex: "#000000", uso: "" }])}
          disabled={paleta.length >= MAX_COLORES_PALETA}
        >
          {Ico.mas({ t: 14 })} Agregar color
        </button>
        {paleta.length >= MAX_COLORES_PALETA && (
          <p className="conteo" style={{ marginTop: 6 }}>Máximo {MAX_COLORES_PALETA} colores.</p>
        )}
      </section>

      <label className="campo-lbl">
        Tipografía
        <input
          className="campo"
          placeholder="Ej: Poppins para títulos, Inter para texto"
          value={tipografia}
          onChange={(e) => setTipografia(e.target.value)}
        />
      </label>

      <div>
        <label className="campo-lbl">Logo</label>
        {logoUrl && (
          <div style={{ margin: "8px 0" }}>
            <img
              src={logoUrl}
              alt="Logo actual"
              style={{ maxHeight: 64, maxWidth: 180, borderRadius: 8, border: "1px solid var(--borde)" }}
            />
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          disabled={subiendoLogo}
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            if (archivo) subirLogo(archivo);
          }}
        />
        {subiendoLogo && <p className="conteo">Subiendo…</p>}
      </div>

      <label className="campo-lbl">
        Detalles a considerar
        <textarea
          className="campo"
          rows={3}
          placeholder="Restricciones, gustos del dueño, qué NO usar…"
          value={detalles}
          onChange={(e) => setDetalles(e.target.value)}
        />
      </label>

      {error && <p className="error">{error}</p>}
      {ok && <p className="ok-msg">Brand book guardado.</p>}

      <div>
        <button className="btn solido" onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar brand book"}
        </button>
      </div>
    </div>
  );
}
