(() => {
  const FN = "https://ylsqvmggycfijzfvguzq.supabase.co/functions/v1/agendar-publico";
  const FN_DISP = "https://ylsqvmggycfijzfvguzq.supabase.co/functions/v1/disponibilidad";
  const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlsc3F2bWdneWNmaWp6ZnZndXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNjE3OTgsImV4cCI6MjEwMjkzNzc5OH0.w1LABnzrOIgJ-UHelPF2A2kXCqDzDYPQK-5oV_o6VPk";
  const cal = document.getElementById("agCal");
  if (!cal) return;

  const $ = (id) => document.getElementById(id);
  const fFecha = $("ag_fecha"), fHora = $("ag_hora"), agBtn = $("agBtn"), elegido = $("agCalElegido");
  const diasEl = $("agCalDias"), horasEl = $("agCalHoras"), mesEl = $("agCalMes"), antBtn = $("agCalAnt"), sigBtn = $("agCalSig");

  const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const pad2 = (n) => String(n).padStart(2, "0");
  const ymd = (y, m, d) => y + "-" + pad2(m) + "-" + pad2(d);
  const diasEnMes = (y, m) => new Date(y, m, 0).getDate();  // m es 1..12

  const hoy = new Date();
  const hoyYMD = ymd(hoy.getFullYear(), hoy.getMonth() + 1, hoy.getDate());
  const limite = new Date(hoy.getTime() + 60 * 86400000);
  const limiteYMD = ymd(limite.getFullYear(), limite.getMonth() + 1, limite.getDate());

  let vistaY = hoy.getFullYear(), vistaM = hoy.getMonth() + 1;  // 1..12
  let fechaSel = "", horaSel = "";

  function pintarMes() {
    mesEl.textContent = MESES[vistaM - 1] + " " + vistaY;
    antBtn.disabled = vistaY === hoy.getFullYear() && vistaM === hoy.getMonth() + 1;
    sigBtn.disabled = vistaY === limite.getFullYear() && vistaM === limite.getMonth() + 1;

    diasEl.innerHTML = "";
    const primerDow = (new Date(vistaY, vistaM - 1, 1).getDay() + 6) % 7;  // 0 = lunes
    for (let i = 0; i < primerDow; i++) {
      const v = document.createElement("span"); v.className = "ag-cal-dia ag-cal-dia-vacio"; diasEl.appendChild(v);
    }
    const total = diasEnMes(vistaY, vistaM);
    for (let d = 1; d <= total; d++) {
      const f = ymd(vistaY, vistaM, d);
      const dow = new Date(vistaY, vistaM - 1, d).getDay();  // 0 = domingo
      const b = document.createElement("button");
      b.type = "button"; b.className = "ag-cal-dia"; b.textContent = String(d);
      const fueraDeRango = f < hoyYMD || f > limiteYMD;
      if (fueraDeRango || dow === 0) b.disabled = true;
      if (f === fechaSel) b.classList.add("ag-cal-dia-on");
      b.addEventListener("click", () => elegirDia(f));
      diasEl.appendChild(b);
    }
  }

  async function elegirDia(f) {
    fechaSel = f; horaSel = ""; fHora.value = ""; fFecha.value = f;
    agBtn.disabled = true;
    pintarMes();  // reencuadra el día elegido con la clase "on"
    horasEl.hidden = false;
    horasEl.innerHTML = '<p class="ag-cal-cargando">Cargando horas disponibles…</p>';
    elegido.textContent = "Cargando disponibilidad para el " + f.split("-").reverse().join("-") + "…";

    let ocupadas = [];
    try {
      const r = await fetch(FN_DISP + "?fecha=" + f, { headers: { apikey: ANON, Authorization: "Bearer " + ANON } });
      const j = await r.json();
      if (r.ok && j.ok) ocupadas = j.ocupadas || [];
    } catch (_e) { /* si falla, se muestran todas las horas sin marcar ocupadas */ }

    horasEl.innerHTML = "";
    elegido.textContent = "Elige una hora para el " + f.split("-").reverse().join("-") + ".";
    const ahoraMin = (f === hoyYMD) ? (new Date().getTime() + 30 * 60000) : 0;
    for (let h = 9; h <= 20; h++) for (const m of [0, 30]) {
      const v = pad2(h) + ":" + pad2(m);
      const bloque = document.createElement("button");
      bloque.type = "button"; bloque.className = "ag-cal-hora"; bloque.textContent = v;
      const enElPasado = f === hoyYMD && new Date(f + "T" + v + ":00").getTime() < ahoraMin;
      if (ocupadas.includes(v) || enElPasado) bloque.disabled = true;
      bloque.addEventListener("click", () => {
        horaSel = v; fHora.value = v;
        [...horasEl.children].forEach((x) => x.classList.remove("ag-cal-hora-on"));
        bloque.classList.add("ag-cal-hora-on");
        elegido.textContent = "Elegiste el " + f.split("-").reverse().join("-") + " a las " + v + ".";
        agBtn.disabled = false;
      });
      horasEl.appendChild(bloque);
    }
  }

  antBtn.addEventListener("click", () => { vistaM--; if (vistaM < 1) { vistaM = 12; vistaY--; } pintarMes(); });
  sigBtn.addEventListener("click", () => { vistaM++; if (vistaM > 12) { vistaM = 1; vistaY++; } pintarMes(); });
  pintarMes();

  const msg = $("agMsg");
  document.getElementById("agForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.className = "ag-msg"; msg.textContent = "";
    if (!fFecha.value || !fHora.value) {
      msg.className = "ag-msg mal"; msg.textContent = "Elige un día y una hora."; return;
    }
    const body = {
      nombre: $("ag_nombre").value, whatsapp: $("ag_wsp").value, email: $("ag_email").value,
      mensaje: $("ag_msg").value, fecha: fFecha.value, hora: fHora.value, website: $("ag_web").value,
    };
    agBtn.disabled = true; msg.textContent = "Agendando…";
    try {
      const r = await fetch(FN, { method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + ANON },
        body: JSON.stringify(body) });
      const j = await r.json();
      if (r.ok && j.ok) {
        document.getElementById("agForm").outerHTML =
          '<div class="ag-ok"><h3>Reunión agendada</h3>' +
          '<p>Le confirmamos por WhatsApp en breve.</p>' +
          '<a class="btn btn-linea" href="/">Volver al inicio</a></div>';
      } else {
        msg.className = "ag-msg mal"; msg.textContent = j.error || "No se pudo agendar. Intente de nuevo.";
        agBtn.disabled = false;
      }
    } catch (_e) {
      msg.className = "ag-msg mal"; msg.textContent = "Error de conexión. Intente de nuevo.";
      agBtn.disabled = false;
    }
  });
})();
