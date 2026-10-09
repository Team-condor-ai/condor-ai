/* Campos de formulario.
   <label class="campo" data-tipo="rut|correo|telefono|texto" data-requerido>
     <input placeholder=" "><span class="campo-etiqueta">RUT</span><small class="campo-ayuda">…</small></label>
   El error aparece al SALIR del campo (no mientras se escribe) y dice cómo arreglarlo.
   Además: textarea con contador, código de 6 dígitos y zona de archivos. */

// ── RUT chileno: formato y dígito verificador ──
/** Solo dígitos y una K final (como mucho 8 dígitos de cuerpo + verificador). */
export function limpiarRut(v) {
  const l = v.replace(/[^0-9kK]/g, "").toUpperCase();
  const cuerpo = l.slice(0, -1).replace(/K/g, ""), dv = l.slice(-1);
  return (cuerpo + dv).slice(0, 9);
}
export function formatearRut(v) {
  const l = limpiarRut(v);
  if (l.length < 2) return l;
  const cuerpo = l.slice(0, -1).replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cuerpo}-${l.slice(-1)}`;
}
export function rutValido(v) {
  const l = limpiarRut(v);
  if (l.length < 2) return false;
  const cuerpo = l.slice(0, -1), dv = l.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return false;
  let suma = 0, m = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) { suma += Number(cuerpo[i]) * m; m = m === 7 ? 2 : m + 1; }
  const r = 11 - (suma % 11);
  return dv === (r === 11 ? "0" : r === 10 ? "K" : String(r));
}

// ── teléfono: +56 9 1234 5678 ──
/** Los 9 dígitos del número chileno (sin el 56), aunque se escriba o pegue con prefijo. */
export function digitosTelefono(v) {
  let d = v.replace(/\D/g, "");
  if (/^\s*\+?\s*56/.test(v) || (d.startsWith("56") && d.length > 9)) d = d.slice(2);
  return d.replace(/^0+/, "").slice(0, 9);
}
export function formatearTelefono(v) {
  const r = digitosTelefono(v);
  if (!r) return "";
  return `+56 ${r.slice(0, 1)}${r.length > 1 ? " " + r.slice(1, 5) : ""}${r.length > 5 ? " " + r.slice(5) : ""}`;
}

// ── correo: sugiere el dominio si hay un error típico ──
const DOMINIOS = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com", "live.cl", "gmail.cl", "hotmail.cl", "yahoo.es"];
function distancia(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
export function sugerirCorreo(v) {
  const [u, dom, ...resto] = v.toLowerCase().split("@");
  if (!u || !dom || resto.length || DOMINIOS.includes(dom)) return null;
  const mejor = DOMINIOS.map((x) => [x, distancia(dom, x)]).sort((a, b) => a[1] - b[1])[0];
  return mejor[1] > 0 && mejor[1] <= 2 ? `${v.split("@")[0]}@${mejor[0]}` : null;
}

const REGLAS = {
  rut: (v) => (!v ? "Escribe el RUT de la empresa, por ejemplo 76.086.428-5." : rutValido(v) ? "" : limpiarRut(v).length < 8 ? "Al RUT le faltan números: van 7 u 8 antes del guion." : "Ese RUT no cuadra: revisa el dígito después del guion."),
  correo: (v) => (!v ? "Necesitamos un correo para responderte." : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? "" : !v.includes("@") ? "Falta la @: un correo se ve así, nombre@empresa.cl" : "Falta algo: un correo se ve así, nombre@empresa.cl"),
  telefono: (v) => { const n = digitosTelefono(v).length; return !v ? "" : n === 9 ? "" : `Faltan ${9 - n} ${9 - n === 1 ? "dígito" : "dígitos"}: son 9, como 9 1234 5678.`; },
  texto: (v, el) => (el.dataset.requerido !== undefined && !v.trim() ? `Completa ${el.querySelector(".campo-etiqueta")?.textContent.toLowerCase() || "este campo"}.` : ""),
};

/** Valida un campo y muestra el error. Devuelve true si está bien. */
export function validar(campo) {
  const inp = campo.querySelector("input, textarea, select");
  const regla = REGLAS[campo.dataset.tipo || "texto"] || REGLAS.texto;
  let msg = regla(inp.value.trim(), campo);
  if (!msg && campo.dataset.requerido !== undefined && !inp.value.trim()) msg = REGLAS.texto("", campo);
  const ayuda = campo.querySelector(".campo-ayuda");
  if (ayuda && ayuda.dataset.base === undefined) ayuda.dataset.base = ayuda.textContent;
  const antes = campo.classList.contains("con-error") ? ayuda?.textContent : null;
  campo.classList.toggle("con-error", !!msg);
  campo.classList.toggle("valido", !msg && !!inp.value);
  inp.setAttribute("aria-invalid", String(!!msg));
  if (ayuda) ayuda.textContent = msg || ayuda.dataset.base || "";
  // sacude solo cuando el error aparece o cambia (no en cada tecla mientras se corrige)
  if (msg && msg !== antes) campo.classList.remove("sacude"), void campo.offsetWidth, campo.classList.add("sacude");
  return !msg;
}

let n = 0;
export function montarCampos(raiz = document) {
  raiz.querySelectorAll(".campo").forEach((campo) => {
    const inp = campo.querySelector("input, textarea, select");
    if (!inp) return;
    const id = `campo-${++n}`;
    const ayuda = campo.querySelector(".campo-ayuda"), etiqueta = campo.querySelector(".campo-etiqueta");
    // nombre accesible = solo la etiqueta (sin la ayuda ni la sugerencia); la ayuda lo describe
    if (etiqueta) { etiqueta.id ||= `${id}-e`; inp.setAttribute("aria-labelledby", etiqueta.id); }
    if (ayuda) { ayuda.id ||= `${id}-a`; inp.setAttribute("aria-describedby", ayuda.id); ayuda.setAttribute("aria-live", "polite"); }
    campo.addEventListener("animationend", (e) => { if (e.target === campo) campo.classList.remove("sacude"); });
    const tipo = campo.dataset.tipo;
    if (tipo === "rut") {
      inp.setAttribute("maxlength", "12");
      inp.addEventListener("input", () => { const p = inp.selectionStart === inp.value.length; inp.value = formatearRut(inp.value); if (p) inp.setSelectionRange(inp.value.length, inp.value.length); });
    }
    if (tipo === "telefono") {
      inp.setAttribute("inputmode", "tel");
      let antes = "";
      inp.addEventListener("input", (e) => {
        let r = digitosTelefono(inp.value);
        // si al borrar solo se fue un espacio o el prefijo, se borra el dígito anterior (si no, el formato lo repone)
        if (e.inputType?.startsWith("delete") && r === antes) r = r.slice(0, -1);
        const fin = inp.selectionStart === inp.value.length;
        inp.value = r ? formatearTelefono(r) : "+56 ";
        antes = r;
        if (fin) inp.setSelectionRange(inp.value.length, inp.value.length);
      });
      // al entrar, el prefijo ya está puesto
      inp.addEventListener("focus", () => { if (!inp.value) { inp.value = "+56 "; requestAnimationFrame(() => inp.setSelectionRange(4, 4)); } });
      inp.addEventListener("blur", () => { antes = digitosTelefono(inp.value); if (!antes) inp.value = ""; }, true);
    }
    if (tipo === "correo") {
      inp.setAttribute("autocapitalize", "off");
      inp.setAttribute("spellcheck", "false");
      // la sugerencia vive dentro del campo (no rompe la grilla); tocarla corrige el correo
      const sug = document.createElement("span");
      sug.className = "campo-sugerencia"; sug.hidden = true;
      sug.setAttribute("role", "button"); sug.tabIndex = 0;
      sug.id = `${id}-s`;
      (ayuda || etiqueta).after(sug);
      let s = null;
      const aceptar = (e) => { e.preventDefault(); if (!s) return; inp.value = s; sug.hidden = true; s = null; validar(campo); inp.focus(); };
      sug.addEventListener("click", aceptar);
      sug.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") aceptar(e); });
      // tocarla no debe sacar el foco antes del clic (evita el parpadeo del blur)
      sug.addEventListener("pointerdown", (e) => e.preventDefault());
      inp.addEventListener("blur", () => {
        s = sugerirCorreo(inp.value.trim());
        sug.hidden = !s;
        if (s) { sug.textContent = "¿Quisiste decir"; const b = document.createElement("b"); b.textContent = `${s}?`; sug.append(b); sug.setAttribute("aria-label", `Usar ${s}`); }
        inp.setAttribute("aria-describedby", [ayuda?.id, s ? sug.id : ""].filter(Boolean).join(" "));
      });
      inp.addEventListener("input", () => { if (!sug.hidden) { sug.hidden = true; s = null; } });
    }
    // select: la etiqueta flota cuando hay algo elegido
    const lleno = () => campo.classList.toggle("lleno", inp.tagName === "SELECT" && !!inp.value);
    if (inp.tagName === "SELECT") { inp.addEventListener("change", () => { lleno(); if (campo.classList.contains("con-error") || campo.dataset.tocado) validar(campo); }); lleno(); }
    inp.form?.addEventListener("reset", () => setTimeout(() => { lleno(); campo.querySelectorAll(".campo-sugerencia").forEach((x) => (x.hidden = true)); pintarCont?.(); }));
    // error al salir; ya marcado, se revalida mientras se corrige
    inp.addEventListener("blur", () => { if (inp.value || campo.dataset.tocado) validar(campo); campo.dataset.tocado = "1"; });
    inp.addEventListener("input", () => { if (campo.classList.contains("con-error")) validar(campo); else if (campo.classList.contains("valido")) campo.classList.remove("valido"); });
    // contador de caracteres
    const cont = campo.querySelector(".campo-contador");
    let pintarCont = null;
    if (cont && inp.maxLength > 0) {
      cont.setAttribute("aria-hidden", "true");
      pintarCont = () => {
        const l = inp.value.length, m = inp.maxLength;
        cont.textContent = `${l} / ${m}`;
        cont.classList.toggle("cerca", l >= m * 0.9 && l < m);
        cont.classList.toggle("tope", l >= m);
      };
      inp.addEventListener("input", pintarCont); pintarCont();
    }
  });

  // ── código de 6 dígitos ──
  raiz.querySelectorAll(".codigo-otp").forEach((grupo) => {
    const cajas = [...grupo.querySelectorAll("input")];
    const revisar = () => {
      const v = cajas.map((c) => c.value).join("");
      const completo = v.length === cajas.length;
      const antes = grupo.classList.contains("completo");
      grupo.classList.toggle("completo", completo);
      if (completo && !antes) grupo.dispatchEvent(new CustomEvent("completo", { detail: v, bubbles: true }));
    };
    // reparte varios dígitos desde la caja i (pegar, o el autocompletar del SMS)
    const repartir = (d, i) => {
      d.split("").slice(0, cajas.length - i).forEach((x, k) => (cajas[i + k].value = x));
      cajas[Math.min(i + d.length, cajas.length - 1)].focus();
      revisar();
    };
    cajas.forEach((c, i) => {
      c.removeAttribute("maxlength");
      c.setAttribute("autocomplete", i === 0 ? "one-time-code" : "off");
      c.setAttribute("pattern", "[0-9]*");
      c.style.setProperty("--k", i);
      // al entrar, lo que hay queda seleccionado: escribir lo reemplaza
      c.addEventListener("focus", () => requestAnimationFrame(() => c.select()));
      c.addEventListener("input", () => {
        const d = c.value.replace(/\D/g, "");
        if (d.length > 1) { c.value = ""; repartir(d, i); return; }
        c.value = d;
        if (d && cajas[i + 1]) cajas[i + 1].focus();
        revisar();
      });
      c.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !c.value && cajas[i - 1]) { e.preventDefault(); cajas[i - 1].value = ""; cajas[i - 1].focus(); revisar(); }
        else if (e.key === "ArrowLeft" && cajas[i - 1]) { e.preventDefault(); cajas[i - 1].focus(); }
        else if (e.key === "ArrowRight" && cajas[i + 1]) { e.preventDefault(); cajas[i + 1].focus(); }
        else if (e.key.length === 1 && !/\d/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault();
      });
      c.addEventListener("paste", (e) => {
        const d = (e.clipboardData.getData("text") || "").replace(/\D/g, "");
        if (!d) return;
        e.preventDefault();
        // un código completo se pega desde el principio; un trozo, desde esta caja
        repartir(d.slice(0, cajas.length), d.length >= cajas.length ? 0 : i);
      });
    });
  });

  // ── zona de archivos ──
  raiz.querySelectorAll(".zona-archivos").forEach((z) => {
    const inp = z.querySelector('input[type="file"]'), lista = z.parentElement.querySelector(".lista-archivos-subidos");
    if (lista) lista.setAttribute("aria-live", "polite");
    const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
    const agregar = (files) => [...files].slice(0, 5).forEach((f) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="arch-nombre"></span><span class="arch-peso">${kb(f.size)}</span><span class="arch-barra" aria-hidden="true"><i></i></span>`;
      li.querySelector(".arch-nombre").textContent = f.name;
      lista?.prepend(li);
      // demostración: la barra avanza sola; aquí no se sube nada
      void li.offsetWidth;
      li.classList.add("subiendo");
      setTimeout(() => li.classList.add("subido"), 1500);
    });
    // dragleave salta al pasar sobre los hijos: se cuenta cuántas veces se entró
    let dentro = 0;
    z.addEventListener("dragenter", (e) => { e.preventDefault(); dentro++; z.classList.add("encima"); });
    z.addEventListener("dragover", (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"; });
    z.addEventListener("dragleave", () => { if (--dentro <= 0) { dentro = 0; z.classList.remove("encima"); } });
    z.addEventListener("drop", (e) => { e.preventDefault(); dentro = 0; z.classList.remove("encima"); agregar(e.dataTransfer.files); });
    inp.addEventListener("change", () => { agregar(inp.files); inp.value = ""; });
  });

  // ── fichas de opción ──
  raiz.querySelectorAll(".fichas-opcion").forEach((g) => g.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
    const multi = g.dataset.multiple !== undefined;
    if (!multi) g.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", "false"));
    b.setAttribute("aria-pressed", String(multi ? b.getAttribute("aria-pressed") !== "true" : true));
    g.dispatchEvent(new CustomEvent("cambio", { bubbles: true, detail: [...g.querySelectorAll('[aria-pressed="true"]')].map((x) => x.textContent.trim()) }));
  })));
}
