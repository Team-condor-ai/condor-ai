// Pruebas reales del kit por CDP: node prueba.mjs
import { lanzar, esperar } from "./cdp.mjs";
import path from "node:path";
const dir = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, "$1");
const cap = (n) => path.join(dir, `p-${n}.png`);
const URL_ = "http://127.0.0.1:5320/";
let fallas = 0;
const ok = (c, t) => { console.log((c ? "OK    " : "FALLA ") + t); if (!c) fallas++; };
const b = await lanzar();
const { ev } = b;
const visto = () => ev(`document.querySelectorAll('.revelar').forEach(e=>e.classList.add('visto'))`);
try {
  // ═════════ ESCRITORIO ═════════
  await b.abrir(URL_);
  await visto();

  // 1 · insignia "Por vencer" ya no es un bloque
  const ins = await ev(`(()=>{const r=document.querySelector('.insignia.alerta').getBoundingClientRect();return [r.width,r.height]})()`);
  ok(ins[1] <= 28 && ins[0] < 140, `Insignia «Por vencer» de tamaño normal (${ins.map(Math.round)})`);

  // ── Toasts ──
  await b.clic("#demo-toast", 100); await b.clic("#demo-toast-deshacer", 100); await b.clic("#demo-toast-error", 100); await b.clic("#demo-toast", 600);
  const nt = await ev(`document.querySelectorAll('.toast:not(.sale)').length`);
  ok(nt === 3, `Toast: cola máx. 3 (hay ${nt} vivos)`);
  const frente = await ev(`(()=>{const t=[...document.querySelectorAll('.toast:not(.sale)')];const r=t[0].getBoundingClientRect();const e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return t[0].contains(e)})()`);
  ok(frente, "Toast: el más nuevo queda adelante (no tapado por los viejos)");
  await b.captura(cap("toast-pila"), { x: 470, y: 600, width: 500, height: 220 });
  // hover real: abanico + pausa
  const tr = await ev(`(()=>{const r=document.querySelector('.toast:not(.sale)').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
  await b.mover(tr[0], tr[1]); await esperar(700);
  const ab = await ev(`(()=>{const t=[...document.querySelectorAll('.toast:not(.sale)')].map(x=>x.getBoundingClientRect());return {abierta:document.querySelector('.toasts').classList.contains('abierta'), solapan:t.some((a,i)=>t.some((c,j)=>j>i && a.top<c.bottom-1 && c.top<a.bottom-1))}})()`);
  ok(ab.abierta && !ab.solapan, `Toast: abanico al pasar el puntero, sin solaparse (${JSON.stringify(ab)})`);
  await b.captura(cap("toast-abanico"), { x: 470, y: 560, width: 500, height: 260 });
  // moverse por el hueco entre dos no lo cierra
  const hueco = await ev(`(()=>{const t=[...document.querySelectorAll('.toast:not(.sale)')].map(x=>x.getBoundingClientRect());return [t[0].left+40,(t[0].top+t[1].bottom)/2]})()`);
  await b.mover(hueco[0], hueco[1]); await esperar(300);
  ok(await ev(`document.querySelector('.toasts').classList.contains('abierta')`), "Toast: el puntero en el hueco entre dos no cierra el abanico");
  await esperar(4800);
  ok(await ev(`document.querySelectorAll('.toast:not(.sale)').length`) === 3, "Toast: con el puntero encima no se van (4,8 s)");
  // Deshacer
  const hayDes = await ev(`!!document.querySelector('.toast:not(.sale) .toast-accion')`);
  if (hayDes) {
    const d = await ev(`(()=>{const r=document.querySelector('.toast:not(.sale) .toast-accion').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
    await b.mover(d[0], d[1]); await b.clicXY(d[0], d[1]); await esperar(700);
    ok(await ev(`[...document.querySelectorAll('.toast:not(.sale)')].some(t=>t.textContent.includes('se deshizo'))`), "Toast: Deshacer muestra «Listo, se deshizo»");
  } else ok(false, "Toast: el de Deshacer no está a la vista");
  await b.mover(5, 5); await esperar(400);
  ok(!(await ev(`document.querySelector('.toasts').classList.contains('abierta')`)), "Toast: al salir el puntero se cierra el abanico");
  await esperar(5200);
  ok(await ev(`document.querySelectorAll('.toast').length`) === 0, "Toast: al soltarlos, se van solos");

  // ── Alerta ──
  await b.clic("#demo-alerta", 120);
  const al = await ev(`(()=>{const c=document.querySelector('.alerta-caja');return c&&{origen:c.style.transformOrigin, foco:document.activeElement.textContent, anim:getComputedStyle(c).animationName}})()`);
  ok(al && al.foco === "Cancelar", `Alerta: abre con foco en Cancelar (${JSON.stringify(al)})`);
  await esperar(250);
  await b.captura(cap("alerta-naciendo"));
  await esperar(500);
  const orig = await ev(`(()=>{const c=document.querySelector('.alerta-caja'),bt=document.getElementById('demo-alerta').getBoundingClientRect();const [ox,oy]=c.style.transformOrigin.split(' ').map(parseFloat);return [Math.round(c.offsetLeft+ox-(bt.left+bt.width/2)),Math.round(c.offsetTop+oy-(bt.top+bt.height/2))]})()`);
  ok(Math.abs(orig[0]) < 2 && Math.abs(orig[1]) < 2, `Alerta: crece desde el centro de su botón (desvío ${orig})`);
  await b.captura(cap("alerta"));
  await b.tecla("Tab"); const f1 = await b.foco(); await b.tecla("Tab"); const f2 = await b.foco(); await b.tecla("Tab", { shift: true }); const f3 = await b.foco();
  ok(f1 === "Eliminar" && f2 === "Cancelar" && f3 === "Eliminar", `Alerta: Tab atrapado (${f1} → ${f2} → ⇧⇧ ${f3})`);
  await b.tecla("Escape"); await esperar(700);
  ok(!(await ev(`!!document.querySelector('.alerta-caja')`)) && (await b.foco()) === "demo-alerta", "Alerta: Escape cierra y el foco vuelve a su botón");
  ok(await ev(`[...document.querySelectorAll('.toast')].some(t=>t.textContent.includes('No se eliminó'))`), "Alerta: Escape = cancelar (toast «No se eliminó nada»)");
  await b.clic("#demo-alerta", 700); await b.tecla("Tab"); await b.tecla("Enter"); await esperar(700);
  ok(await ev(`[...document.querySelectorAll('.toast')].some(t=>t.textContent.includes('eliminada'))`), "Alerta: confirmar con teclado resuelve true");
  ok(await ev(`!document.documentElement.classList.contains('con-modal')`), "Alerta: devuelve el scroll de la página");

  // ── Menú ──
  await ev(`document.querySelectorAll('.toast').forEach(t=>t.remove())`);
  await b.clic('[data-menu="menu-acciones"]', 500);
  const m = await ev(`(()=>{const m=document.getElementById('menu-acciones'),bt=document.querySelector('[data-menu=menu-acciones]').getBoundingClientRect(),r=m.getBoundingClientRect();return {vis:!m.hidden, debajo: r.top>=bt.bottom && r.top-bt.bottom<14, izq: Math.abs(r.left-bt.left)<2, exp: document.querySelector('[data-menu=menu-acciones]').getAttribute('aria-expanded'), foco: document.activeElement===m}})()`);
  ok(m.vis && m.debajo && m.izq && m.exp === "true", `Menú: nace bajo su botón (${JSON.stringify(m)})`);
  await b.captura(cap("menu"), { x: 100, y: 300, width: 700, height: 400 });
  await b.tecla("ArrowDown"); const mi1 = await b.foco();
  await b.tecla("End"); const mi2 = await b.foco();
  await b.tecla("Home"); const mi3 = await b.foco();
  await b.tecla("ArrowUp"); const mi4 = await b.foco();
  await b.tecla("a"); const mi5 = await b.foco();
  await b.tecla("d"); const mi6 = await b.foco();
  ok(mi1.startsWith("Editar") && mi2.startsWith("Eliminar") && mi3.startsWith("Editar") && mi4.startsWith("Eliminar") && mi5.startsWith("Archivar") && mi6.startsWith("Duplicar"), `Menú: flechas, Inicio, Fin, inicial (${[mi1, mi2, mi3, mi4, mi5, mi6].join(" | ")})`);
  await b.tecla("e"); const mi7 = await b.foco(); await b.tecla("e"); const mi8 = await b.foco();
  ok(mi7.startsWith("Eliminar") && mi8.startsWith("Editar"), `Menú: repetir la inicial cicla (${mi7} → ${mi8})`);
  await b.tecla("Escape"); await esperar(400);
  ok((await ev(`document.getElementById('menu-acciones').hidden`)) && (await b.foco()).startsWith("Acciones"), "Menú: Escape cierra y el foco vuelve al botón");
  // teclado desde el botón: ArrowDown abre en el primero; Tab cierra y avanza
  await b.tecla("ArrowDown"); await esperar(300); const k1 = await b.foco();
  await b.tecla("Tab"); await esperar(400);
  const k2 = await ev(`document.getElementById('menu-acciones').hidden`), k3 = await b.foco();
  ok(k1.startsWith("Editar") && k2 && !k3.startsWith("Duplicar"), `Menú: ↓ abre en el primero; Tab cierra y sale (${k1} → ${k3})`);
  // hover de verdad sobre un ítem + clic
  await b.clic('[data-menu="menu-acciones"]', 500);
  const it = await ev(`(()=>{const r=document.querySelectorAll('#menu-acciones [role=menuitem]')[1].getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
  await b.mover(it[0], it[1]); await esperar(250);
  const bg = await ev(`getComputedStyle(document.querySelectorAll('#menu-acciones [role=menuitem]')[1]).backgroundColor`);
  ok(bg !== "rgba(0, 0, 0, 0)", `Menú: hover resalta el ítem (${bg})`);
  await b.clicXY(it[0], it[1]); await esperar(500);
  ok((await ev(`document.getElementById('menu-acciones').hidden`)) && (await ev(`[...document.querySelectorAll('.toast')].some(t=>t.textContent.includes('Duplicar'))`)), "Menú: elegir con clic cierra y confirma");
  // reabrir rápido no deja el menú escondido
  await b.clic('[data-menu="menu-acciones"]', 30); await b.clic('[data-menu="menu-acciones"]', 30); await b.clic('[data-menu="menu-acciones"]', 700);
  ok(!(await ev(`document.getElementById('menu-acciones').hidden`)), "Menú: abrir-cerrar-abrir rápido lo deja abierto");
  await b.clicXY(5, 300); await esperar(400);
  ok(await ev(`document.getElementById('menu-acciones').hidden`), "Menú: clic afuera lo cierra");

  // ── Popover ──
  await b.clic('[data-popover="pop-plan"]', 500);
  const po = await ev(`(()=>{const p=document.getElementById('pop-plan'),bt=document.querySelector('[data-popover]').getBoundingClientRect(),r=p.getBoundingClientRect();return {vis:!p.hidden, debajo:r.top>=bt.bottom, dentro:r.right<=innerWidth-8}})()`);
  ok(po.vis && po.debajo && po.dentro, `Popover: abre bajo su botón (${JSON.stringify(po)})`);
  await b.captura(cap("popover"), { x: 700, y: 300, width: 700, height: 400 });
  await b.tecla("Escape"); await esperar(400);
  ok((await ev(`document.getElementById('pop-plan').hidden`)) && (await b.foco()).includes("incluye"), "Popover: Escape cierra y devuelve el foco");

  // ── Tooltip ──
  const [tx, ty] = await b.centro('#popups [data-tip="Copiar enlace"]');
  await b.mover(tx, ty); await esperar(650);
  const tp = await ev(`(()=>{const t=document.querySelector('.tip'),r=t.getBoundingClientRect();return {ver:t.classList.contains('ver'), txt:t.textContent, arriba:r.bottom<${ty}}})()`);
  ok(tp.ver && tp.txt === "Copiar enlace" && tp.arriba, `Tooltip: al pasar el puntero (${JSON.stringify(tp)})`);
  await b.captura(cap("tooltip"), { x: tx - 120, y: ty - 70, width: 260, height: 110 });
  await b.mover(5, 5); await esperar(400);
  ok(!(await ev(`document.querySelector('.tip').classList.contains('ver')`)), "Tooltip: se va al salir el puntero");
  await ev(`document.querySelector('#popups [data-tip="Copiar enlace"]').focus()`);
  await b.tecla("Tab"); await esperar(150);
  const tf = await ev(`({f:document.activeElement.textContent, ver:document.querySelector('.tip').classList.contains('ver'), txt:document.querySelector('.tip').textContent, desc:document.activeElement.getAttribute('aria-describedby')})`);
  ok(tf.f === "IVA" && tf.ver && tf.txt.startsWith("Impuesto") && tf.desc === "tip", `Tooltip: con foco de teclado (${JSON.stringify(tf)})`);
  await b.tecla("Escape"); await esperar(300);
  ok(!(await ev(`document.querySelector('.tip').classList.contains('ver')`)), "Tooltip: Escape lo esconde");

  // ── Modal ──
  await b.clic('[data-modal="modal-demo"]', 700);
  const mo = await ev(`({abierto:!!document.querySelector('.velo .modal'), foco:document.activeElement.tagName})`);
  ok(mo.abierto && mo.foco === "INPUT", `Modal: abre con foco en el primer campo (${JSON.stringify(mo)})`);
  await b.captura(cap("modal"));
  const fs = [];
  for (let i = 0; i < 4; i++) { await b.tecla("Tab"); fs.push(await b.foco()); }
  ok(fs.every((x) => x !== null) && (await ev(`document.querySelector('.modal').contains(document.activeElement)`)), `Modal: Tab atrapado (${fs.join(" → ")})`);
  await b.tecla("Tab", { shift: true }); await b.tecla("Tab", { shift: true }); await b.tecla("Tab", { shift: true });
  ok(await ev(`document.querySelector('.modal').contains(document.activeElement)`), "Modal: ⇧Tab también queda adentro");
  await b.tecla("Escape"); await esperar(700);
  ok(!(await ev(`!!document.querySelector('.velo')`)) && (await b.foco()) === "Abrir modal", "Modal: Escape cierra y el foco vuelve");

  // ── Segmentado ──
  const seg = '#controles .segmentado';
  await b.centro(seg); await esperar(200);
  await ev(`(()=>{const l=document.querySelector('${seg} .seg-lente');window.__ws=[];const f=()=>{__ws.push(parseFloat(l.style.width));if(__ws.length<90)requestAnimationFrame(f)};requestAnimationFrame(f)})()`);
  await b.clic(`${seg} button:nth-of-type(4)`, 800);
  const est = await ev(`Math.max(...__ws) - Math.max(document.querySelector('${seg} button:nth-of-type(1)').offsetWidth, document.querySelector('${seg} button:nth-of-type(4)').offsetWidth)`);
  const lf = await ev(`(()=>{const l=document.querySelector('${seg} .seg-lente'),b=document.querySelector('${seg} button:nth-of-type(4)');const lr=l.getBoundingClientRect(),br=b.getBoundingClientRect();return {dx:Math.round(lr.left-br.left),dw:Math.round(lr.width-br.width),sel:b.getAttribute('aria-checked')}})()`);
  ok(lf.sel === "true" && Math.abs(lf.dx) <= 1 && Math.abs(lf.dw) <= 1, `Segmentado: la lente llega a la opción (${JSON.stringify(lf)})`);
  const anchoMes = await ev(`document.querySelector('${seg} button:nth-of-type(3)').offsetWidth`);
  ok(est > 6, `Segmentado: la lente se estira en viaje (+${Math.round(est)} px sobre el ancho final)`);
  await ev(`document.querySelector('${seg} button:nth-of-type(4)').focus()`);
  await b.tecla("ArrowLeft"); await b.tecla("Home");
  ok((await b.foco()) === "Día" && (await ev(`document.querySelector('${seg} button:nth-of-type(1)').getAttribute('aria-checked')`)) === "true", "Segmentado: flechas e Inicio");
  ok(anchoMes === (await ev(`document.querySelector('${seg} button:nth-of-type(3)').offsetWidth`)), "Segmentado: elegir no corre el ancho de las opciones");

  // ── Interruptor ──
  const antesI = await ev(`document.querySelectorAll('#controles .interruptor input')[1].checked`);
  await b.clic("#controles .interruptor:nth-of-type(2) i", 700);
  ok((await ev(`document.querySelectorAll('#controles .interruptor input')[1].checked`)) !== antesI, "Interruptor: cambia al tocarlo");
  await ev(`document.querySelectorAll('#controles .interruptor input')[1].focus()`); await b.tecla(" ");
  ok((await ev(`document.querySelectorAll('#controles .interruptor input')[1].checked`)) === antesI, "Interruptor: Espacio lo alterna");

  // ── Deslizador ──
  const sl = await ev(`(()=>{const i=document.querySelector('#controles .deslizador input');const r=i.getBoundingClientRect();i.scrollIntoView({block:'center'});const r2=i.getBoundingClientRect();return [r2.left,r2.top+r2.height/2,r2.width]})()`);
  await esperar(200);
  await b.mover(sl[0] + sl[2] * 0.75, sl[1]); await b.clicXY(sl[0] + sl[2] * 0.75, sl[1]); await esperar(200);
  const dv = await ev(`({v:document.querySelector('#controles .deslizador input').value, out:document.querySelector('#controles .deslizador output').textContent, vt:document.querySelector('#controles .deslizador input').getAttribute('aria-valuetext')})`);
  ok(Number(dv.v) > 1300000 && dv.out === dv.vt && dv.out.includes("$"), `Deslizador: clic mueve y el valor se ve (${JSON.stringify(dv)})`);
  await ev(`document.querySelector('#controles .deslizador input').focus()`); await b.tecla("ArrowRight");
  ok((await ev(`document.querySelector('#controles .deslizador output').textContent`)) !== dv.out, "Deslizador: flechas del teclado");
  const misma = await ev(`(()=>{const o=document.querySelector('#controles .deslizador output').getBoundingClientRect(),s=document.querySelector('#controles .deslizador span').getBoundingClientRect();return Math.abs(o.top-s.top)<8})()`);
  ok(misma, "Deslizador: el valor va en la línea de la etiqueta");

  // ── Contador ──
  for (let i = 0; i < 9; i++) await b.clic('.contador [data-paso="1"]', 80);
  const ct = await ev(`({v:document.querySelector('.contador-valor').textContent, dis:document.querySelector('.contador [data-paso="1"]').getAttribute('aria-disabled')})`);
  ok(ct.v === "10" && ct.dis === "true", `Contador: tope máximo 10 (${JSON.stringify(ct)})`);
  await ev(`document.querySelector('.contador [data-paso="1"]').focus()`); await b.tecla("Enter");
  ok((await ev(`document.activeElement===document.querySelector('.contador [data-paso="1"]')`)) && (await ev(`document.querySelector('.contador-valor').textContent`)) === "10", "Contador: en el tope el foco no se pierde");
  for (let i = 0; i < 12; i++) await b.tecla("ArrowDown");
  ok((await ev(`document.querySelector('.contador-valor').textContent`)) === "1", "Contador: tope mínimo 1 con flechas");

  // ── Botón con estados ──
  const be = '#botones [data-estados]';
  const w0 = await ev(`document.querySelector('${be}').offsetWidth`);
  await b.clic(be, 300);
  const e1 = await ev(`({e:document.querySelector('${be}').dataset.estado, w:document.querySelector('${be}').offsetWidth})`);
  await esperar(1600);
  const e2 = await ev(`document.querySelector('${be}').dataset.estado`);
  await esperar(1800);
  const e3 = await ev(`document.querySelector('${be}').dataset.estado`);
  ok(e1.e === "cargando" && e2 === "listo" && e3 === undefined && e1.w === w0, `Botón en capas: quieto → cargando → listo → quieto sin cambiar ancho (${e1.e}, ${e2}, ${e3}, ${w0}/${e1.w})`);

  // ── Banner ──
  await b.clic(".banner-plegar", 700);
  const bn = await ev(`({h:document.querySelector('.banner-detalle').offsetHeight, exp:document.querySelector('.banner-plegar').getAttribute('aria-expanded')})`);
  ok(bn.h < 2 && bn.exp === "false", `Banner: se pliega de verdad (${JSON.stringify(bn)})`);
  await b.clic(".banner-plegar", 700);

  // ── Campos ──
  const rut = '#campos .campo[data-tipo="rut"] input';
  await b.clic(rut, 100); await b.escribir("760864285");
  ok((await ev(`document.querySelector('${rut}').value`)) === "76.086.428-5", `RUT: se formatea (${await ev(`document.querySelector('${rut}').value`)})`);
  await b.tecla("Tab"); await esperar(200);
  ok(!(await ev(`document.querySelector('${rut}').closest('.campo').classList.contains('con-error')`)), "RUT: 76.086.428-5 es válido");
  await b.clic(rut, 100); await b.tecla("Backspace"); await b.escribir("4"); await b.tecla("Tab"); await esperar(300);
  const re = await ev(`({err:document.querySelector('${rut}').closest('.campo').classList.contains('con-error'), msg:document.querySelector('${rut}').closest('.campo').querySelector('.campo-ayuda').textContent, inv:document.querySelector('${rut}').getAttribute('aria-invalid')})`);
  ok(re.err && /guion/.test(re.msg) && re.inv === "true", `RUT: dígito malo → error al salir que dice cómo arreglarlo (${re.msg})`);
  await b.capturaEl("#campos .campos-grilla", cap("campos-error"));
  // correo
  const co = '#campos .campo[data-tipo="correo"] input';
  await b.clic(co, 100); await b.escribir("nombre@gmial.com"); await b.tecla("Tab"); await esperar(400);
  const sg = await ev(`(()=>{const s=document.querySelector('#campos .campo[data-tipo="correo"] .campo-sugerencia');return s&&{vis:!s.hidden, txt:s.textContent}})()`);
  ok(sg?.vis && sg.txt.includes("nombre@gmail.com"), `Correo: sugiere gmail (${JSON.stringify(sg)})`);
  const grilla = await ev(`[...document.querySelector('#campos .campos-grilla').children].map(c=>c.className).join(',')`);
  ok(!grilla.includes("campo-sugerencia"), "Correo: la sugerencia no rompe la grilla");
  await b.capturaEl("#campos .campos-grilla", cap("campos-sugerencia"));
  await b.clic('#campos .campo[data-tipo="correo"] .campo-sugerencia', 300);
  ok((await ev(`document.querySelector('${co}').value`)) === "nombre@gmail.com" && (await ev(`document.activeElement===document.querySelector('${co}')`)), "Correo: tocar la sugerencia corrige y deja el foco en el campo");
  // teléfono
  const te = '#campos .campo[data-tipo="telefono"] input';
  await b.clic(te, 150);
  ok((await ev(`document.querySelector('${te}').value`)) === "+56 ", "Teléfono: al entrar aparece +56");
  await b.escribir("912345678");
  ok((await ev(`document.querySelector('${te}').value`)) === "+56 9 1234 5678", `Teléfono: formato (${await ev(`document.querySelector('${te}').value`)})`);
  for (let i = 0; i < 12; i++) await b.tecla("Backspace");
  const tv = await ev(`document.querySelector('${te}').value`);
  ok(tv === "+56 ", `Teléfono: se puede borrar todo (${JSON.stringify(tv)})`);
  await b.escribir("9123"); await b.tecla("Tab"); await esperar(300);
  const tm = await ev(`document.querySelector('${te}').closest('.campo').querySelector('.campo-ayuda').textContent`);
  ok(/Faltan 5/.test(tm), `Teléfono: error dice cuántos faltan (${tm})`);
  // select
  await ev(`document.activeElement.blur()`); await esperar(700);
  const selLab = async () => ev(`getComputedStyle(document.querySelector('#campos .campo-select .campo-etiqueta')).transform`);
  ok((await selLab()) === "none", "Select: vacío, la etiqueta no flota");
  await ev(`(()=>{const s=document.querySelector('#campos .campo-select select');s.value='Salud';s.dispatchEvent(new Event('change',{bubbles:true}))})()`); await esperar(400);
  ok((await selLab()) !== "none", "Select: elegido, la etiqueta flota");
  // textarea
  const ta = '#campos textarea';
  await b.clic(ta, 100); await b.escribir("Quiero vender online");
  ok((await ev(`document.querySelector('#campos .campo-contador').textContent`)) === "20 / 280", "Textarea: contador");
  const tac = await ev(`(()=>{const c=document.querySelector('#campos .campo-contador').getBoundingClientRect(),t=document.querySelector('${ta}').getBoundingClientRect();return c.top>=t.bottom})()`);
  ok(tac, "Textarea: el contador no choca con el tirador");
  await ev(`(()=>{const t=document.querySelector('${ta}');t.value='';t.dispatchEvent(new Event('input'))})()`);
  await b.tecla("Tab"); await esperar(100); await ev(`document.querySelector('${ta}').focus()`); await b.tecla("Tab"); await esperar(300);
  ok(await ev(`document.querySelector('${ta}').closest('.campo').classList.contains('con-error')`), "Textarea requerido: vacío al salir (2.ª vez) → error");
  // OTP
  const otp = '#campos .codigo-otp input';
  await b.clic(otp, 100); await b.escribir("123");
  ok((await ev(`[...document.querySelectorAll('${otp}')].indexOf(document.activeElement)`)) === 3, "OTP: avanza solo");
  await b.tecla("Backspace");
  const ob = await ev(`({i:[...document.querySelectorAll('${otp}')].indexOf(document.activeElement), v:[...document.querySelectorAll('${otp}')].map(x=>x.value).join('')})`);
  ok(ob.i === 2 && ob.v === "12", `OTP: retrocede y borra (${JSON.stringify(ob)})`);
  await b.tecla("Backspace"); await b.tecla("x");
  ok((await ev(`[...document.querySelectorAll('${otp}')].map(x=>x.value).join('')`)) === "1", "OTP: ignora letras");
  await ev(`(()=>{const i=document.querySelectorAll('${otp}')[1];i.focus();const dt=new DataTransfer();dt.setData('text','48 21 07');i.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}))})()`);
  await esperar(200);
  const op = await ev(`({v:[...document.querySelectorAll('${otp}')].map(x=>x.value).join(''), c:document.querySelector('.codigo-otp').classList.contains('completo')})`);
  ok(op.v === "482107" && op.c, `OTP: pegar el código completo (${JSON.stringify(op)})`);
  await ev(`document.querySelectorAll('${otp}')[2].focus()`); await esperar(100); await b.tecla("9");
  ok((await ev(`[...document.querySelectorAll('${otp}')].map(x=>x.value).join('')`)) === "489107", "OTP: escribir sobre una caja llena la reemplaza");
  await b.capturaEl("#campos .codigo-otp", cap("otp"), 30);
  // archivos (sin diálogo: se prueba con un drop sintético)
  await ev(`(()=>{const z=document.querySelector('.zona-archivos');const dt=new DataTransfer();dt.items.add(new File(['x'.repeat(5000)],'catalogo.csv',{type:'text/csv'}));z.dispatchEvent(new DragEvent('dragenter',{dataTransfer:dt,bubbles:true,cancelable:true}));z.dispatchEvent(new DragEvent('dragenter',{dataTransfer:dt,bubbles:true,cancelable:true}));z.dispatchEvent(new DragEvent('dragleave',{dataTransfer:dt,bubbles:true}));window.__enc=z.classList.contains('encima');z.dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}))})()`);
  await esperar(250);
  const ar = await ev(`({enc:window.__enc, n:document.querySelectorAll('.lista-archivos-subidos li').length, barra:getComputedStyle(document.querySelector('.arch-barra i')).transform})`);
  ok(ar.enc && ar.n === 1 && ar.barra !== "matrix(1, 0, 0, 1, 0, 0)", `Archivos: arrastrar (sin parpadeo) y la barra avanza (${JSON.stringify(ar)})`);
  await esperar(1700);
  ok(await ev(`document.querySelector('.lista-archivos-subidos li').classList.contains('subido')`), "Archivos: termina en verde");
  // fichas
  await b.clic('#campos .fichas-opcion button:nth-of-type(2)', 300);
  ok((await ev(`document.querySelector('#campos .fichas-opcion button:nth-of-type(2)').getAttribute('aria-pressed')`)) === "true", "Fichas: se marcan");
  await b.clic('#campos .fichas-opcion button:nth-of-type(2)', 300);
  ok((await ev(`document.querySelector('#campos .fichas-opcion button:nth-of-type(2)').getAttribute('aria-pressed')`)) === "false", "Fichas: se desmarcan (varias)");
  // hover de botones
  const [hx, hy] = await b.centro("#botones .btn.suave"); await b.mover(hx, hy); await esperar(400);
  ok((await ev(`getComputedStyle(document.querySelector('#botones .btn.suave')).backgroundColor`)) === "rgb(232, 232, 236)", "Botón suave: hover");

  // ═════════ CELULAR 390 ═════════
  await b.abrir(URL_, { ancho: 390, alto: 844, movil: true });
  await visto();
  const chicos = await ev(`(()=>{const sel='#botones button, #controles button, #controles label.interruptor, #controles label.casilla, #controles label.radio, #controles .deslizador input, #avisos button, #popups button:not([role=menuitem]), #campos button, #campos input, #campos select';return [...document.querySelectorAll(sel)].filter(e=>e.offsetParent&&!e.closest('[hidden]')).map(e=>{const r=e.getBoundingClientRect();const b=getComputedStyle(e,'::before');const ex=b.position==='absolute'&&b.content!=='none'?-(parseFloat(b.top)||0)-(parseFloat(b.bottom)||0):0;return [e.className||e.tagName,(e.textContent||e.getAttribute('aria-label')||'').trim().slice(0,18),Math.round(r.width),Math.round(r.height),ex]}).filter(([c,t,w,h,ex])=>h+ex<44&&!/seg-lente/.test(c))})()`);
  ok(chicos.length === 0, `Táctil ≥ 44 px a 390 (chicos: ${JSON.stringify(chicos)})`);
  const fuentes = await ev(`[...document.querySelectorAll('#campos input, #campos select, #campos textarea')].filter(e=>parseFloat(getComputedStyle(e).fontSize)<16).length`);
  ok(fuentes === 0, "Inputs ≥ 16 px (sin zoom en iOS)");
  const desborde = await ev(`document.documentElement.scrollWidth - innerWidth`);
  ok(desborde <= 0, `Sin scroll horizontal a 390 (${desborde})`);
  // hoja
  await b.toque('[data-hoja="hoja-demo"]', 900);
  const h1 = await ev(`(()=>{const h=document.getElementById('hoja-demo');const r=h.getBoundingClientRect();return {top:Math.round(r.top), alto:h.offsetHeight, vis:Math.round(innerHeight-r.top)}})()`);
  ok(h1.vis > 250 && h1.vis < h1.alto, `Hoja: abre en media (${JSON.stringify(h1)})`);
  await b.captura(cap("hoja-media"));
  await b.arrastreTactil(195, h1.top + 12, h1.top - 300, 10, 16); await esperar(900);
  const h2 = await ev(`Math.round(document.getElementById('hoja-demo').getBoundingClientRect().top)`);
  ok(Math.abs(h2 - (844 - h1.alto)) <= 2, `Hoja: arrastrar arriba → completa (top ${h2}, esperado ${844 - h1.alto})`);
  await b.captura(cap("hoja-completa"));
  await b.arrastreTactil(195, h2 + 12, h2 + 160, 12, 30); await esperar(900);
  const h3 = await ev(`Math.round(document.getElementById('hoja-demo').getBoundingClientRect().top)`);
  ok(Math.abs(h3 - h1.top) <= 2, `Hoja: arrastrar un poco abajo, lento → media (top ${h3}, esperado ${h1.top})`);
  await b.arrastreTactil(195, h3 + 12, h3 + 200, 5, 10); await esperar(1000);
  ok(!(await ev(`!!document.querySelector('.velo--hoja')`)) && (await ev(`document.getElementById('hoja-demo').hidden`)), "Hoja: lanzarla abajo la cierra");
  // segunda vez: no se duplican escuchas
  await b.toque('[data-hoja="hoja-demo"]', 900);
  await b.toque('#hoja-demo [data-cerrar]', 1000);
  ok(!(await ev(`!!document.querySelector('.velo--hoja')`)), "Hoja: reabrir y cerrar con «Listo»");
  await b.toque('[data-hoja="hoja-demo"]', 900);
  await b.tecla("Escape"); await esperar(900);
  ok(!(await ev(`!!document.querySelector('.velo--hoja')`)) && (await ev(`!document.documentElement.classList.contains('con-modal')`)), "Hoja: Escape la cierra (3.ª apertura)");
  // toast en celular
  await b.toque("#demo-toast-deshacer", 600);
  await b.captura(cap("movil-toast"), { x: 0, y: 560, width: 390, height: 284 });
  // menú en celular
  await b.toque('[data-menu="menu-acciones"]', 500);
  const mm = await ev(`(()=>{const r=document.getElementById('menu-acciones').getBoundingClientRect();return r.left>=8&&r.right<=innerWidth-8&&r.bottom<=innerHeight})()`);
  ok(mm, "Menú: dentro de la pantalla a 390");
  await b.captura(cap("movil-menu"));

  // ═════════ MOVIMIENTO REDUCIDO ═════════
  await b.abrir(URL_, { reducido: true });
  await visto();
  await b.clic("#demo-toast", 200); await b.clic('[data-menu="menu-acciones"]', 200);
  await ev(`document.querySelector('#botones [data-estados]').click()`); await esperar(300);
  const infinitas = await ev(`(()=>{const sel='#botones,#controles,#estados,#avisos,#popups,#campos,.toasts,.menu,.popover,.tip';const out=[];document.querySelectorAll(sel).forEach(r=>[r,...r.querySelectorAll('*')].forEach(e=>{for(const p of [null,'::before','::after']){const s=getComputedStyle(e,p);if(s.animationName!=='none'&&s.animationIterationCount==='infinite'&&e.offsetParent!==null)out.push((e.className||e.tagName)+(p||''))}}));return [...new Set(out)]})()`);
  ok(infinitas.length === 0, `Movimiento reducido: sin animaciones infinitas en el kit (${JSON.stringify(infinitas)})`);
  await b.tecla("Escape");
  console.log("errores de consola:", b.errores);
  ok(b.errores.length === 0, "Sin errores de consola");
} finally { b.cerrar(); }
console.log(fallas ? `\n${fallas} FALLAS` : "\nTODO OK");
process.exitCode = fallas ? 1 : 0;
