// node probar.mjs [escritorio|movil|reducido]
import { abrir, esperar } from "./lib.mjs";
const modo = process.argv[2] || "escritorio";
const movil = modo === "movil";
const DIR = new URL(".", import.meta.url).pathname.slice(1);
const t = await abrir(movil ? { width: 390, height: 844, mobile: true } : { reducido: modo === "reducido" });
const { ev, clic, escribir, ok, raton, centro, tecla, captura } = t;
try {
  // ───────── STEPPER ─────────
  console.log(`\n== Stepper (${modo})`);
  const S = "#pasos [data-stepper]";
  const pasoVisible = () => ev(`[...document.querySelectorAll('${S} .paso')].findIndex(p=>!p.hidden)`);
  await clic(`${S} [data-siguiente]`);
  ok(await pasoVisible() === 0, "vacío: no avanza del paso 1");
  const errs1 = await ev(`[...document.querySelectorAll('${S} .paso:not([hidden]) .campo.con-error .campo-ayuda')].map(x=>x.textContent)`);
  ok(errs1.length === 2, `vacío: 2 errores claros → ${JSON.stringify(errs1)}`);
  await escribir(`${S} input[name=Empresa]`, "Café Altiplano");
  await escribir(`${S} input[name=RUT]`, "111111112");
  await clic(`${S} [data-siguiente]`);
  ok(await pasoVisible() === 0, "RUT malo: no avanza");
  ok(/no cuadra/.test(await ev(`document.querySelector('${S} input[name=RUT]').closest('.campo').querySelector('.campo-ayuda').textContent`)), "RUT malo: mensaje 'no cuadra'");
  await ev(`(()=>{const i=document.querySelector('${S} input[name=RUT]'); i.value=''; i.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await escribir(`${S} input[name=RUT]`, "111111111");
  await clic(`${S} [data-siguiente]`);
  ok(await pasoVisible() === 1, "datos buenos: pasa al paso 2");
  ok(await ev(`document.querySelector('${S} .paso:not([hidden])').classList.contains('entra-adelante')`), "transición hacia adelante");
  await esperar(500);
  const linea = () => ev(`new DOMMatrix(getComputedStyle(document.querySelector('${S} .stepper-linea i')).transform).a`);
  ok(Math.abs(await linea() - 1 / 3) < 0.02, `línea al 33 % (${(await linea()).toFixed(2)})`);
  ok(await ev(`document.querySelector('${S} .stepper-cabeza li:nth-child(1)').classList.contains('hecho')`), "paso 1 marcado hecho");
  await clic(`${S} [data-siguiente]`);
  ok(await pasoVisible() === 1, "sin producto: no avanza");
  ok(await ev(`getComputedStyle(document.querySelector('${S} .paso:not([hidden]) .grupo-error')).display !== 'none'`), "sin producto: muestra 'Elige una opción'");
  await clic(`${S} .op-prod:nth-child(2)`);
  ok(await ev(`document.querySelector('${S} .opciones-producto input:checked')?.value`) === "condor track", "elige condor track");
  ok(await ev(`getComputedStyle(document.querySelector('${S} .paso:not([hidden]) .grupo-error')).display === 'none'`), "al elegir, el error se va");
  await clic(`${S} [data-siguiente]`);
  ok(await pasoVisible() === 2, "pasa al paso 3");
  await clic(`${S} [data-siguiente]`);
  const errs3 = await ev(`[...document.querySelectorAll('${S} .paso:not([hidden]) .con-error')].length`);
  ok(await pasoVisible() === 2 && errs3 >= 3, `paso 3 vacío: no avanza, ${errs3} errores`);
  await clic(`${S} .hora:nth-child(3)`);
  await escribir(`${S} input[name=Nombre]`, "Ana (ejemplo)");
  await escribir(`${S} input[name=Correo]`, "ana@ejemplo.cl");
  await clic(`${S} [data-siguiente]`);
  ok(await pasoVisible() === 3, "pasa a Revisar");
  const resumen = await ev(`[...document.querySelectorAll('${S} .resumen div')].map(d=>d.querySelector('dt').textContent+': '+d.querySelector('dd').textContent)`);
  console.log("      resumen:", JSON.stringify(resumen));
  ok(resumen.some((r) => /condor track/.test(r)) && resumen.some((r) => /Martes 14, 11:00/.test(r)) && resumen.some((r) => /Café Altiplano/.test(r)), "Revisar resume producto, horario y empresa");
  ok(await ev(`document.querySelector('${S} [data-siguiente] .tx').textContent`) === "Agendar reunión", "botón dice 'Agendar reunión'");
  ok(Math.abs(await linea() - 1) < 0.02, "línea llena en Revisar");
  // reabrir paso 1 desde la cabeza
  await clic(`${S} .stepper-cabeza li:nth-child(1) button`);
  ok(await pasoVisible() === 0 && await ev(`document.querySelector('${S} .paso:not([hidden])').classList.contains('entra-atras')`), "reabre paso 1 con transición hacia atrás");
  ok(await ev(`!document.querySelector('${S} .stepper-cabeza li:nth-child(4) button').disabled`), "paso 4 sigue alcanzable desde la cabeza");
  await clic(`${S} .stepper-cabeza li:nth-child(4) button`);
  ok(await pasoVisible() === 3, "salta de vuelta a Revisar");
  await clic(`${S} [data-atras]`);
  ok(await pasoVisible() === 2, "Atrás vuelve al paso 3");
  await clic(`${S} .stepper-cabeza li:nth-child(4) button`);
  await clic(`${S} [data-siguiente]`, 300);
  ok(await ev(`!document.querySelector('${S} .stepper-fin').hidden && document.querySelector('${S} .fin-carga').dataset.estado`) !== "listo", "envío: aparece el cóndor cargando");
  await esperar(2200);
  ok(await ev(`document.querySelector('${S} .fin-carga').dataset.estado`) === "listo" && await ev(`document.querySelector('${S}').classList.contains('enviado')`), "envío: termina en listo");
  await esperar(500);
  await clic(`${S} [data-reiniciar]`);
  const reset = await ev(`({paso:[...document.querySelectorAll('${S} .paso')].findIndex(p=>!p.hidden), vals:[...document.querySelectorAll('${S} input')].filter(i=>i.type==='radio'?i.checked:i.value).length, err:document.querySelectorAll('${S} .con-error').length, fin:document.querySelector('${S} .stepper-fin').hidden, bloqueados:[...document.querySelectorAll('${S} .stepper-cabeza button')].map(b=>b.disabled), linea:new DOMMatrix(getComputedStyle(document.querySelector('${S} .stepper-linea i')).transform).a})`);
  ok(reset.paso === 0 && reset.vals === 0 && reset.err === 0 && reset.fin && reset.bloqueados.join() === "false,true,true,true", `Volver a empezar resetea todo ${JSON.stringify(reset)}`);
  ok(await ev(`[...document.querySelectorAll('${S} .stepper-cabeza .num')].every(n=>n.getBoundingClientRect().width>=36)`), "cabeza: círculos ≥ 36px");
  if (movil) ok(await ev(`[...document.querySelectorAll('${S} .stepper-cabeza button')].every(b=>b.getBoundingClientRect().height>=44 && b.getBoundingClientRect().width>=44)`), "cabeza: blancos táctiles ≥ 44px");

  // ───────── MIGAS ─────────
  console.log("\n== Migas");
  const migas = await ev(`(()=>{const m=document.querySelector('.migas-demo');const vis=[...m.children].filter(c=>getComputedStyle(c).display!=='none').map(c=>c.tagName==='svg'||c.tagName==='SVG'?'>':c.textContent.trim());return {rec:m.classList.contains('recogidas'),vis:vis.join(' '),sw:m.scrollWidth,cw:m.clientWidth}})()`);
  console.log("      ", JSON.stringify(migas));
  ok(!/> >/.test(migas.vis), "migas: sin separadores dobles");
  ok(migas.sw <= migas.cw + 1, "migas: no desbordan");
  if (movil) ok(migas.rec && /…/.test(migas.vis), "migas: en celular se recogen con …");

  // ───────── CARRUSEL ─────────
  console.log("\n== Carrusel");
  const C = "#scrollers .carrusel";
  await ev(`document.querySelector('${C}').scrollIntoView({block:'center'})`); await esperar(400);
  const est = () => ev(`(()=>{const p=document.querySelector('${C} .carrusel-pista');return {sl:Math.round(p.scrollLeft),max:p.scrollWidth-p.clientWidth,prev:document.querySelector('${C} [data-dir="-1"]').disabled,next:document.querySelector('${C} [data-dir="1"]').disabled,dot:[...document.querySelectorAll('${C} .carrusel-puntos button')].findIndex(b=>b.getAttribute('aria-current')==='true'),dots:document.querySelectorAll('${C} .carrusel-puntos button').length,barra:new DOMMatrix(getComputedStyle(document.querySelector('${C} .carrusel-progreso i')).transform).a}})()`);
  let e0 = await est();
  console.log("      inicio", JSON.stringify(e0));
  ok(e0.prev && !e0.next && e0.dot === 0, "inicio: ← deshabilitada, → habilitada, punto 1");
  await clic(`${C} [data-dir="1"]`, 900);
  let e1 = await est();
  ok(e1.sl > 0 && !e1.prev && e1.dot === 1, `→ avanza una tarjeta (${JSON.stringify(e1)})`);
  for (let k = 0; k < 6; k++) await clic(`${C} [data-dir="1"]`, 700);
  let e2 = await est();
  ok(e2.next && Math.abs(e2.sl - e2.max) < 3 && e2.dot === e2.dots - 1 && e2.barra > 0.98, `final: → deshabilitada, último punto, barra llena (${JSON.stringify(e2)})`);
  await clic(`${C} .carrusel-puntos button:nth-child(1)`, 900);
  ok((await est()).sl < 3, "punto 1 vuelve al inicio");
  // teclado
  await ev(`document.querySelector('${C} .carrusel-pista').focus()`);
  await tecla("ArrowRight", "ArrowRight", 39); await esperar(800);
  ok((await est()).dot === 1, "teclado → avanza");
  await tecla("End", "End", 35); await esperar(900);
  ok((await est()).next, "teclado End → final");
  await tecla("Home", "Home", 36); await esperar(900);
  ok((await est()).sl < 3, "teclado Home → inicio");
  // arrastre con inercia
  if (!movil) {
    await ev(`document.querySelector('${C} .carrusel-pista').scrollLeft=0`); await esperar(300);
    const [x, y] = await centro(`${C} .carrusel-pista`);
    await esperar(300);
    await raton("mousePressed", x + 100, y, { buttons: 1 });
    for (let k = 1; k <= 8; k++) { await raton("mouseMoved", x + 100 - k * 22, y, { buttons: 1 }); await esperar(16); }
    const durante = (await est()).sl;
    await raton("mouseReleased", x + 100 - 8 * 22, y);
    await esperar(1400);
    const tras = await est();
    const snaps = await ev(`[...document.querySelectorAll('${C} .tarjeta-caso')].map(c=>Math.min(c.offsetLeft-c.parentElement.firstElementChild.offsetLeft, c.parentElement.scrollWidth-c.parentElement.clientWidth))`);
    console.log("      arrastre: durante", durante, "tras", tras.sl, "snaps", JSON.stringify(snaps));
    ok(durante > 120, "arrastre: sigue al mouse");
    ok(tras.sl > durante + 20, "arrastre: sigue con inercia al soltar");
    ok(snaps.some((s) => Math.abs(s - tras.sl) < 4), "arrastre: se asienta en una tarjeta (snap)");
    ok(await ev(`!document.querySelector('${C} .carrusel-pista').classList.contains('arrastrando')`), "arrastre: limpia el estado");
  }
  // ───────── MARQUEE ─────────
  console.log("\n== Marquee");
  const M = "#scrollers .marquee";
  const mq = await ev(`(()=>{const m=document.querySelector('${M}');const c=[...m.querySelectorAll('.marquee-cinta')];return {n:c.length,anim:getComputedStyle(m.querySelector('.marquee-pista')).animationName,w0:c[0].getBoundingClientRect().width,w1:c[1].getBoundingClientRect().width,mw:m.clientWidth,junta:Math.abs(c[1].getBoundingClientRect().left-c[0].getBoundingClientRect().right),hid:c[1].getAttribute('aria-hidden')}})()`);
  console.log("      ", JSON.stringify(mq));
  ok(mq.n === 2 && mq.hid === "true" && Math.abs(mq.w0 - mq.w1) < 1 && mq.w0 >= mq.mw && (modo === "reducido" || mq.junta < 0.5), "marquee: dos cintas iguales, la copia oculta, más anchas que la caja (sin costura)");
  if (modo === "reducido") ok(mq.anim === "none", "marquee: quieta con movimiento reducido");
  else {
    ok(mq.anim === "marquee", "marquee: corre");
    const [mx, my] = await centro(M); await esperar(200);
    await raton("mouseMoved", mx, my); await esperar(300);
    ok(await ev(`getComputedStyle(document.querySelector('${M} .marquee-pista')).animationPlayState`) === "paused", "marquee: pausa al hover");
    await raton("mouseMoved", 5, 5); await esperar(200);
  }

  // ───────── TABLA ─────────
  console.log("\n== Tabla");
  const T = "#datos .tabla-demo";
  const col0 = () => ev(`[...document.querySelectorAll('${T} tbody tr')].map(r=>r.cells[0]?.textContent.trim())`);
  const sorts = () => ev(`[...document.querySelectorAll('${T} th')].map(t=>t.getAttribute('aria-sort'))`);
  ok((await sorts()).join() === "none,none,none,none,descending", "inicio: ordenada por Alta descendente");
  const ordenar = async (c, d) => { if (movil) { await ev(`(()=>{const s=document.querySelector('${T} .tabla-orden select');s.value='${c}:${d}';s.dispatchEvent(new Event('change'))})()`); await t.ev('0'); } else await clic(`${T} th[data-col="${c}"] button`); };
  if (movil) ok(await ev(`getComputedStyle(document.querySelector('${T} .tabla-orden')).display !== 'none' && document.querySelector('${T} .tabla-orden').getBoundingClientRect().height >= 44`), "celular: selector de orden visible (≥ 44px)");
  await ordenar(0, 1);
  const asc = await col0();
  ok((await sorts())[0] === "ascending" && asc[0] === "Café Altiplano", `Cliente ↑ (${asc.join(" | ")})`);
  await ordenar(0, -1);
  const desc = await col0();
  ok((await sorts())[0] === "descending" && desc[0] === "Viña Quebrada", `Cliente ↓ (${desc.join(" | ")})`);
  for (const c of [1, 2, 3, 4]) {
    await ordenar(c, 1);
    const s = await sorts();
    const cel = await ev(`[...document.querySelectorAll('${T} tbody tr')].map(r=>r.cells[${c}]?.textContent.trim())`);
    ok(s[c] === "ascending" && s.filter((x) => x !== "none").length === 1, `col ${c} ↑: ${cel.join(" | ")}`);
  }
  await escribir(`${T} input[type=search]`, "track");
  ok((await ev(`document.querySelector('${T} .tabla-cuenta').textContent`)).startsWith("3 de 9"), `búsqueda 'track': ${await ev(`document.querySelector('${T} .tabla-cuenta').textContent`)}`);
  await ev(`(()=>{const i=document.querySelector('${T} input[type=search]');i.value='optica';i.dispatchEvent(new Event('input'))})()`); await esperar(100);
  ok(await ev(`document.querySelector('${T} tbody tr td')?.textContent.trim()`) === "Óptica Central", "búsqueda sin tilde encuentra 'Óptica'");
  await ev(`(()=>{const i=document.querySelector('${T} input[type=search]');i.value='zzz';i.dispatchEvent(new Event('input'))})()`); await esperar(100);
  ok(await ev(`!!document.querySelector('${T} .tabla-vacia') && document.querySelector('${T} .tabla-cuenta').textContent.startsWith('0 de 9')`), "búsqueda vacía: estado vacío y 0 de 9");
  await ev(`(()=>{const i=document.querySelector('${T} input[type=search]');i.value='';i.dispatchEvent(new Event('input'))})()`); await esperar(100);
  ok(await ev(`document.querySelectorAll('${T} tbody tr').length`) === 5, "página 1: 5 filas");
  await clic(`${T} .paginacion button[aria-label="Página siguiente"]`);
  ok(await ev(`document.querySelectorAll('${T} tbody tr').length`) === 4 && await ev(`document.querySelector('${T} .paginacion [aria-current=page]').textContent`) === "2", "página 2: 4 filas");
  ok(await ev(`document.querySelector('${T} .paginacion button[aria-label="Página siguiente"]').disabled`), "› deshabilitada en la última");
  const tab = await ev(`(()=>{const c=document.querySelector('${T}');return {sw:c.scrollWidth,cw:c.clientWidth,rol:document.querySelector('${T} .tabla-rol').scrollWidth-document.querySelector('${T} .tabla-rol').clientWidth,disp:getComputedStyle(document.querySelector('${T} tbody tr')).display}})()`);
  ok(tab.sw <= tab.cw + 1 && tab.rol <= 1, `tabla sin desborde ${JSON.stringify(tab)}`);
  if (movil) {
    ok(tab.disp === "block" || tab.disp === "grid", "celular: filas como tarjetas");
    ok(await ev(`[...document.querySelectorAll('${T} .paginacion button')].every(b=>b.getBoundingClientRect().height>=44)`), "paginación: ≥ 44px");
  }

  // ───────── ACORDEÓN ─────────
  console.log("\n== Acordeón");
  const A = "#preguntas details.acordeon:nth-child(1)";
  await ev(`(()=>{window.__an=[];const d=document.querySelector('${A}');d.querySelector('summary').addEventListener('click',()=>requestAnimationFrame(()=>{const c=d.querySelector('.acordeon-cuerpo');window.__an.push(c.getAnimations().length+':'+d.classList.contains('cerrando')+':'+Math.round(c.getBoundingClientRect().height))}))})()`);
  const [ax, ay] = await centro(`${A} summary`); await esperar(200);
  await raton("mousePressed", ax, ay, { buttons: 1 }); await raton("mouseReleased", ax, ay);
  await esperar(50); const animAbre = await ev(`window.__an[0]`);
  await esperar(90);
  const hMedio = await ev(`document.querySelector('${A} .acordeon-cuerpo').getBoundingClientRect().height`);
  await esperar(700);
  const hFin = await ev(`document.querySelector('${A} .acordeon-cuerpo').getBoundingClientRect().height`);
  console.log("      abrir: medio", hMedio.toFixed(1), "fin", hFin.toFixed(1));
  if (modo !== "reducido") ok(/^1:false:/.test(animAbre) && Number(animAbre.split(':')[2]) < hFin - 2, `abrir: alto animado (${animAbre} animación)`);
  ok(await ev(`document.querySelector('${A}').open`) && hFin > 20, "abre");
  const [bx, by] = await centro(`${A} summary`); await esperar(200);
  await raton("mousePressed", bx, by, { buttons: 1 }); await raton("mouseReleased", bx, by);
  await esperar(50); const animCierra = await ev(`window.__an[1]`);
  const hC = await ev(`document.querySelector('${A} .acordeon-cuerpo').getBoundingClientRect().height`);
  if (modo !== "reducido") ok(/^1:true:/.test(animCierra) && Number(animCierra.split(':')[2]) > 0, `cerrar: alto animado (${animCierra}, ${hC.toFixed(1)}px)`);
  // interrumpir: volver a tocar mientras cierra
  await raton("mousePressed", bx, by, { buttons: 1 }); await raton("mouseReleased", bx, by);
  await esperar(800);
  ok(await ev(`document.querySelector('${A}').open && document.querySelector('${A} .acordeon-cuerpo').getBoundingClientRect().height > 20`), "interrumpir el cierre lo reabre sin trabarse");

  // ───────── VUELO ─────────
  console.log("\n== Vuelo");
  const vuelo = async (p) => ev(`(async()=>{const v=document.querySelector('.vuelo');const top=v.getBoundingClientRect().top+scrollY;scrollTo(0, top + ${p}*(v.offsetHeight-innerHeight));await new Promise(r=>setTimeout(r,250));
    const cielo=document.querySelector('.vuelo-cielo').getBoundingClientRect(), c=document.querySelector('.vuelo-condor').getBoundingClientRect(), path=document.querySelector('.vuelo-estela path');
    const pp=Number(getComputedStyle(document.querySelector('.vuelo-escena')).getPropertyValue('--p'));
    const L=path.getTotalLength(), a=path.getPointAtLength(Math.min(.999,pp)*L);
    const esp=[cielo.left+a.x/1000*cielo.width, cielo.top+a.y/300*cielo.height];
    const cs=getComputedStyle(path);
    const le=[...document.querySelectorAll('.vuelo-palabra .le')].map(x=>Number(getComputedStyle(x).opacity));
    return {p:pp, centro:[c.left+c.width/2,c.top+c.height/2], esp, dash:cs.strokeDasharray, off:cs.strokeDashoffset, pl:path.getAttribute('pathLength'), letras:Math.min(...le), vistos:document.querySelectorAll('.vuelo-paso.visto').length}})()`);
  for (const p of [0.05, 0.5, 0.8, 0.95]) {
    const r = await vuelo(p);
    const d = Math.hypot(r.centro[0] - r.esp[0], r.centro[1] - r.esp[1]);
    console.log(`      p=${r.p} dist=${d.toFixed(1)} dash=${r.dash} off=${r.off} pl=${r.pl} letras=${r.letras.toFixed(2)} vistos=${r.vistos}`);
    ok(d < 6, `p≈${p}: el cóndor está sobre la curva (${d.toFixed(1)}px)`);
    if (p === 0.95) { ok(r.letras > 0.99, "el nombre ya está completo antes del final"); ok(r.vistos === 4, "los 4 pasos marcados"); }
    if (p === 0.05) ok(r.letras < 0.01 && r.vistos === 1, "al inicio: nombre oculto, 1 paso");
  }
  await captura(`${DIR}vuelo-${modo}.png`);
  const estelaPx = await ev(`(()=>{const p=document.querySelector('.vuelo-estela path');return p.getAttribute('pathLength')})()`);
  ok(estelaPx === "1", "la estela usa pathLength=1 (se dibuja, no queda punteada)");

  // ───────── DESBORDE / MOVIMIENTO REDUCIDO ─────────
  console.log("\n== Desborde y movimiento");
  const des = await ev(`['#pasos','#navegacion','#scrollers','#datos','#preguntas','#vuelo'].map(s=>{const e=document.querySelector(s);let peor=null;e.querySelectorAll('*').forEach(x=>{const r=x.getBoundingClientRect();if(r.width&&(r.right>innerWidth+1||r.left<-1)&&!x.closest('.carrusel-pista,.marquee,.vuelo-cielo,.pestanas-lista,.migas-demo,thead,.stepper-estado')){peor=peor||(x.className?.baseVal??x.className)}});return s+':'+(e.scrollWidth-e.clientWidth)+(peor?' fuera:'+peor:'')})`);
  console.log("      ", des.join("  "));
  ok(des.every((d) => /:0($|\s)/.test(d) && !/fuera/.test(d)), "sin desborde lateral en mis secciones");
  ok(await ev(`document.documentElement.scrollWidth <= innerWidth`), "página sin scroll lateral");
  if (modo === "reducido") {
    const inf = await ev(`document.getAnimations().filter(a=>a.effect?.getTiming().iterations===Infinity && a.playState==='running').map(a=>{const t=a.effect.target;return (t.closest('section')?.id||'?')+':'+(t.className?.baseVal??t.className)+':'+a.animationName})`);
    console.log("      infinitas:", JSON.stringify(inf));
    ok(!inf.some((x) => /^(pasos|navegacion|scrollers|datos|preguntas|vuelo):/.test(x)), "sin animaciones infinitas en mis secciones");
  }
  console.log("\nerrores de consola:", JSON.stringify(t.errores));
} finally {
  t.cerrar();
  console.log(`\n${t.fallas()} fallas`);
}
