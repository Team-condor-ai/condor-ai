// Prueba real de la navegación del guion (escritorio + celular).
import { conChrome, esperar } from "./cdp.mjs";
import fs from "node:fs";
import path from "node:path";
const URL = "http://127.0.0.1:5320/";
const DESC = path.join(import.meta.dirname, "descargas");
const SOLO = process.argv[2]; // "escritorio" | "celular" | undefined

await conChrome(async ({ cdp, ev, abrir, tecla, escribir, clic, clicXY, rect, ok }) => {
  if (SOLO !== "celular") {
    fs.rmSync(DESC, { recursive: true, force: true }); fs.mkdirSync(DESC, { recursive: true });
    await cdp("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: DESC });
    await cdp("Browser.grantPermissions", { permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"], origin: "http://127.0.0.1:5320" });
    await abrir(URL);
    // ── 1. barra que se pliega ──
    ok(!(await ev(`document.querySelector('.barra').classList.contains('plegada')`)), "Barra: arriba no está plegada");
    await ev(`scrollTo(0, 900)`); await esperar(900);
    const w1 = await ev(`document.querySelector('.barra-marca').getBoundingClientRect().width`);
    ok(await ev(`document.querySelector('.barra').classList.contains('plegada')`) && w1 <= 44, `Barra: se pliega al bajar (marca ${w1.toFixed(0)} px)`);
    const prog = await ev(`document.querySelector('.barra-progreso i').style.transform`);
    ok(/scaleX\(0\.0\d+/.test(prog), `Barra: progreso de lectura ${prog}`);
    await ev(`scrollTo(0, 0)`); await esperar(900);
    const w2 = await ev(`document.querySelector('.barra-marca').getBoundingClientRect().width`);
    ok(!(await ev(`document.querySelector('.barra').classList.contains('plegada')`)) && w2 > 140, `Barra: vuelve al subir (marca ${w2.toFixed(0)} px)`);

    // ── 2. migas + dock con cada sección visible ──
    const plan = await ev(`import('/src/plan.js').then(m=>({S:m.SECCIONES,C:m.CAPITULOS}))`);
    let malas = [];
    for (const s of plan.S) {
      await ev(`new Promise(res=>{const t0=performance.now();(function f(){if(document.getElementById('miga-sec').textContent===${JSON.stringify(s.nombre)}||performance.now()-t0>3000)return res();requestAnimationFrame(f)})();const e=document.getElementById('${s.id}');scrollTo(0, e.getBoundingClientRect().top + scrollY - innerHeight*0.3)})`);
      const r = await ev(`({sec:document.getElementById('miga-sec').textContent, cap:document.querySelector('#miga-cap span').textContent, dock:document.querySelector('.dock-capitulos a.activo')?.dataset.cap, existe:!!document.getElementById('${s.id}')})`);
      const c = plan.C.find((x) => x.id === s.cap);
      if (r.sec !== s.nombre || !r.cap.includes(c.nombre) || r.dock !== s.cap) malas.push(`${s.id}→${JSON.stringify(r)}`);
    }
    ok(malas.length === 0, `Migas y dock siguen a las ${plan.S.length} secciones ${malas.join(" | ")}`);
    // la gota quedó bajo el activo
    await esperar(900);
    const g = await ev(`(()=>{const a=document.querySelector('.dock-capitulos a.activo').getBoundingClientRect(),g=document.querySelector('.dock-gota').getBoundingClientRect();return {dx:Math.abs(a.left-g.left),dw:Math.abs(a.width-g.width)}})()`);
    ok(g.dx < 1.5 && g.dw < 1.5, `Dock: la gota descansa bajo el activo (Δx ${g.dx.toFixed(1)}, Δw ${g.dw.toFixed(1)})`);

    // ── 3. menú de hermanas ──
    await ev(`document.getElementById('color').scrollIntoView()`); await esperar(400);
    await clic("#miga-cap"); await esperar(450);
    const m = await ev(`(()=>{const m=document.getElementById('menu-hermanas');const r=m.getBoundingClientRect();return {vis:!m.hidden, items:[...m.querySelectorAll('[role=menuitem]')].map(a=>a.textContent), foco:document.activeElement.textContent, exp:document.getElementById('miga-cap').getAttribute('aria-expanded'), top:r.top, padre:m.parentElement.tagName, op:getComputedStyle(m).opacity}})()`);
    ok(m.vis && m.exp === "true" && m.items.join() === "Color,Tipografía,Forma y curvas", `Menú hermanas: abre con ${m.items.join(", ")} (padre ${m.padre}, top ${Math.round(m.top)})`);
    ok(m.foco === "Color", `Menú hermanas: el foco cae en la sección actual (${m.foco})`);
    await tecla("ArrowDown", 0, "ArrowDown", 40); await esperar(80);
    const f2 = await ev(`document.activeElement.textContent`);
    ok(f2 === "Tipografía", `Menú hermanas: flecha abajo → ${f2}`);
    await tecla("End", 0, "End", 35); await esperar(80);
    ok((await ev(`document.activeElement.textContent`)) === "Forma y curvas", "Menú hermanas: End → última");
    await tecla("Enter", 0, "Enter", 13); await esperar(1200);
    const tr = await ev(`({top:Math.round(document.getElementById('forma').getBoundingClientRect().top), sec:document.getElementById('miga-sec').textContent, oculto:document.getElementById('menu-hermanas').hidden, hash:location.hash, foco:document.activeElement.id||document.activeElement.tagName})`);
    ok(tr.oculto && Math.abs(tr.top - 76) < 30 && tr.sec === "Forma y curvas", `Menú hermanas: Enter lleva a la sección y cierra (${JSON.stringify(tr)})`);
    // Escape cierra y devuelve el foco
    await clic("#miga-cap"); await esperar(400); await tecla("Escape", 0, "Escape", 27); await esperar(400);
    ok((await ev(`document.getElementById('menu-hermanas').hidden && document.activeElement.id`)) === "miga-cap", "Menú hermanas: Escape cierra y vuelve al botón");

    // ── 4. ⌘K ──
    await ev(`document.querySelector('.barra-marca').focus()`);
    await tecla("k", 2, "KeyK", 75); await esperar(450);
    ok(await ev(`!document.getElementById('comando').hidden && document.activeElement.id==='comando-buscar'`), "⌘K: Ctrl+K abre con el foco en el campo");
    await escribir("tipografia"); await esperar(150);
    const r1 = await ev(`[...document.querySelectorAll('#comando-resultados li')].map(l=>l.querySelector('b')?.textContent)`);
    ok(r1[0] === "Tipografía", `⌘K: filtra sin tildes ("tipografia" → ${r1.join(", ")})`);
    await ev(`(()=>{const i=document.getElementById('comando-buscar');i.value='';i.dispatchEvent(new Event('input'))})()`);
    await escribir("condor"); await esperar(100);
    await tecla("ArrowDown", 0, "ArrowDown", 40); await tecla("ArrowDown", 0, "ArrowDown", 40); await tecla("ArrowUp", 0, "ArrowUp", 38);
    const sel = await ev(`({ad:document.getElementById('comando-buscar').getAttribute('aria-activedescendant'), sel:document.querySelector('#comando-resultados [aria-selected=true]')?.id})`);
    ok(sel.sel === "cmd-1" && sel.ad === "cmd-1", `⌘K: flechas mueven la selección (${JSON.stringify(sel)})`);
    // Tab no se escapa del diálogo
    await tecla("Tab", 0, "Tab", 9); await esperar(80);
    ok(await ev(`!!document.activeElement.closest('#comando')`), `⌘K: Tab no saca el foco del diálogo (${await ev(`document.activeElement.className||document.activeElement.tagName`)})`);
    await ev(`document.getElementById('comando-buscar').focus()`);
    await tecla("Escape", 0, "Escape", 27); await esperar(500);
    ok(await ev(`document.getElementById('comando').hidden && document.activeElement.classList.contains('barra-marca')`), `⌘K: Escape cierra y devuelve el foco (${await ev(`document.activeElement.className`)})`);
    // botón + ir a sección
    await clic(".buscar-cmd"); await esperar(450);
    ok(await ev(`!document.getElementById('comando').hidden`), "⌘K: el botón de la barra abre");
    await escribir("scrollers"); await tecla("Enter", 0, "Enter", 13); await esperar(1600);
    const ir = await ev(`({top:Math.round(document.getElementById('scrollers').getBoundingClientRect().top), sec:document.getElementById('miga-sec').textContent, foco:document.activeElement.id||document.activeElement.className})`);
    ok(Math.abs(ir.top - 76) < 30 && ir.sec === "Scrollers", `⌘K: Enter va a la sección (${JSON.stringify(ir)})`);
    // copiar color
    await tecla("k", 2, "KeyK", 75); await esperar(400); await escribir("azul"); await tecla("Enter", 0, "Enter", 13); await esperar(700);
    const cb = await ev(`navigator.clipboard.readText().catch(e=>'ERR '+e.message)`);
    const tst = await ev(`[...document.querySelectorAll('.toast, [class*=toast]')].map(t=>t.textContent).join('|')`);
    ok(cb === "#014CFD", `⌘K: copiar Azul Cóndor → portapapeles "${cb}", aviso "${tst.slice(0, 60)}"`);
    // descargar logo
    await tecla("k", 2, "KeyK", 75); await esperar(400); await escribir("logo horizontal"); await tecla("Enter", 0, "Enter", 13); await esperar(1500);
    const bajados = fs.readdirSync(DESC);
    ok(bajados.some((f) => f.endsWith(".svg")), `⌘K: descargar logo → ${bajados.join(", ")}`);
    // cámara lenta
    await tecla("k", 2, "KeyK", 75); await esperar(400); await escribir("camara lenta"); await tecla("Enter", 0, "Enter", 13); await esperar(500);
    const lento = await ev(`({body:document.body.classList.contains('lento'), casilla:document.getElementById('lento')?.checked})`);
    ok(lento.body, `⌘K: cámara lenta se activa (${JSON.stringify(lento)})`);
    await tecla("k", 2, "KeyK", 75); await esperar(400); await escribir("camara lenta"); await tecla("Enter", 0, "Enter", 13); await esperar(500);
    ok(!(await ev(`document.body.classList.contains('lento')`)), "⌘K: cámara lenta se desactiva");
    // abrir y cerrar rápido (no debe quedar trabado)
    await tecla("k", 2, "KeyK", 75); await esperar(30); await tecla("k", 2, "KeyK", 75); await esperar(30); await tecla("k", 2, "KeyK", 75); await esperar(600);
    const rap = await ev(`({hidden:document.getElementById('comando').hidden, sale:document.getElementById('comando').classList.contains('sale'), modal:document.documentElement.classList.contains('con-modal')})`);
    ok(!rap.hidden && !rap.sale && rap.modal, `⌘K: abrir-cerrar-abrir rápido queda abierto (${JSON.stringify(rap)})`);
    await tecla("Escape", 0, "Escape", 27); await esperar(500);
    // clic fuera
    await tecla("k", 2, "KeyK", 75); await esperar(400); await clicXY(20, 880); await esperar(500);
    ok(await ev(`document.getElementById('comando').hidden && !document.documentElement.classList.contains('con-modal')`), "⌘K: clic en el velo cierra");

    // ── 5. dock: cada botón lleva a su capítulo ──
    malas = [];
    for (const c of plan.C) {
      await clic(`.dock-capitulos a[data-cap="${c.id}"]`); await esperar(1400);
      const primera = plan.S.find((s) => s.cap === c.id).id;
      const r = await ev(`({top:Math.round(document.getElementById('${primera}').getBoundingClientRect().top), act:document.querySelector('.dock-capitulos a.activo')?.dataset.cap})`);
      if (Math.abs(r.top - 76) > 30 && c.id !== "identidad" || r.act !== c.id) malas.push(`${c.id}:${JSON.stringify(r)}`);
    }
    ok(malas.length === 0, `Dock: los ${plan.C.length} botones llevan a su capítulo y lo marcan ${malas.join(" | ")}`);
    const gt = await ev(`(()=>{const a=document.querySelector('.dock-capitulos a.activo').getBoundingClientRect(),g=document.querySelector('.dock-gota').getBoundingClientRect();return Math.abs(a.left-g.left)})()`);
    ok(gt < 1.5, `Dock: la gota terminó bajo el último (Δ ${gt.toFixed(1)})`);
    // la gota se desliza (cuadros intermedios)
    await ev(`window.__xs=[];(function f(t){window.__xs.push(document.querySelector('.dock-gota').getBoundingClientRect().left);if(window.__xs.length<90)requestAnimationFrame(f)})()`);
    await clic(`.dock-capitulos a[data-cap="material"]`); await esperar(1200);
    const xs = await ev(`[...new Set(window.__xs.map(Math.round))].length`);
    ok(xs > 8, `Dock: la gota se desliza (${xs} posiciones distintas en 90 cuadros)`);
    // tooltip del dock y aria-current
    const ac = await ev(`[...document.querySelectorAll('.dock-capitulos a')].filter(a=>a.getAttribute('aria-current')).map(a=>a.dataset.cap)`);
    ok(ac.length === 1, `Dock: aria-current en el activo (${ac})`);
    const foto = async (nombre, clip) => { const s = await cdp("Page.captureScreenshot", { format: "png", clip: { ...clip, scale: 2 } }); fs.writeFileSync(path.join(import.meta.dirname, nombre), Buffer.from(s.result.data, "base64")); };
    await ev(`document.getElementById('color').scrollIntoView()`); await esperar(1200);
    await foto("dock.png", { x: 420, y: 790, width: 600, height: 110 });
    await foto("barra.png", { x: 0, y: 0, width: 1440, height: 70 });
    await clic("#miga-cap"); await esperar(600);
    await foto("menu.png", { x: 0, y: 0, width: 600, height: 260 });
    await tecla("Escape", 0, "Escape", 27); await esperar(400);
    await tecla("k", 2, "KeyK", 75); await esperar(600);
    await foto("comando.png", { x: 380, y: 100, width: 680, height: 600 });
    await tecla("Escape", 0, "Escape", 27); await esperar(400);
  }

  if (SOLO !== "escritorio") {
    // ── 6. celular ──
    await abrir(URL, 390, 844, true);
    const p = await ev(`(()=>{const b=document.querySelector('.pildora-indice');const r=b.getBoundingClientRect();return {vis:getComputedStyle(b).display!=='none', tx:b.querySelector('.tx').textContent, h:r.height, dock:getComputedStyle(document.querySelector('.dock')).display}})()`);
    ok(p.vis && p.dock === "none" && p.h >= 44, `Celular: píldora visible (${p.h}px), dock oculto, dice "${p.tx}"`);
    await ev(`document.getElementById('avisos').scrollIntoView()`); await esperar(500);
    ok((await ev(`document.querySelector('.pildora-indice .tx').textContent`)) === "Avisos", "Celular: la píldora sigue a la sección (Avisos)");
    await clic(".pildora-indice"); await esperar(900);
    const h = await ev(`(()=>{const e=document.getElementById('hoja-indice');const r=e.getBoundingClientRect();return {vis:!e.hidden, top:Math.round(r.top), alto:Math.round(r.height), modal:document.documentElement.classList.contains('con-modal'), actual:e.querySelector('[aria-current]')?.textContent, foco:document.activeElement.textContent}})()`);
    ok(h.vis && h.modal && h.top > 100 && h.top < 844, `Celular: la hoja de índice abre a media altura (${JSON.stringify(h)})`);
    // arrastrar hacia arriba con el dedo
    const ag = await rect("#hoja-indice .hoja-agarre");
    const toque = async (type, y) => cdp("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: ag.x, y }] });
    await toque("touchStart", ag.y);
    for (let i = 1; i <= 10; i++) { await toque("touchMove", ag.y - i * 40); await esperar(16); }
    await toque("touchEnd"); await esperar(900);
    const top2 = await ev(`document.getElementById("hoja-indice").hidden ? 9999 : Math.round(document.getElementById("hoja-indice").getBoundingClientRect().top)`);
    ok(top2 < h.top - 100, `Celular: arrastrar la hoja la sube (${h.top} → ${top2})`);
    // tocar una sección
    await ev(`(()=>{const c=document.querySelector('#hoja-indice .indice'),a=c.querySelector('a[href="#datos"]');c.scrollTop+=a.getBoundingClientRect().top-c.getBoundingClientRect().top-200})()`); await esperar(200);
    const lnk = await rect(`#hoja-indice a[href="#datos"]`);
    ok(lnk.y > 0 && lnk.y < 800, `Celular: «Datos» visible en la hoja (y ${Math.round(lnk.y)})`);
    await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: lnk.x, y: lnk.y }] });
    await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await esperar(1800);
    const fin = await ev(`({oculta:document.getElementById('hoja-indice').hidden, top:Math.round(document.getElementById('datos').getBoundingClientRect().top), tx:document.querySelector('.pildora-indice .tx').textContent, modal:document.documentElement.classList.contains('con-modal'), velos:document.querySelectorAll('.velo').length})`);
    ok(fin.oculta && !fin.modal && fin.velos === 0 && Math.abs(fin.top - 76) < 30 && fin.tx === "Datos", `Celular: tocar «Datos» cierra la hoja y lleva ahí (${JSON.stringify(fin)})`);
    // segunda apertura: arrastrar otra vez no debe cerrarla (oyentes acumulados)
    await clic(".pildora-indice"); await esperar(800);
    const h2 = await ev(`({top:Math.round(document.getElementById('hoja-indice').getBoundingClientRect().top), actual:document.querySelector('#hoja-indice [aria-current]')?.textContent, foco:document.activeElement.textContent})`);
    ok(h2.actual === "Datos" && h2.foco === "Datos", `Celular: la hoja abre marcando y enfocando la sección actual (${JSON.stringify(h2)})`);
    const ag2 = await rect("#hoja-indice .hoja-agarre");
    await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: ag2.x, y: ag2.y }] });
    for (let i = 1; i <= 8; i++) { await cdp("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: ag2.x, y: ag2.y - i * 40 }] }); await esperar(16); }
    await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await esperar(900);
    const h3 = await ev(`({oculta:document.getElementById('hoja-indice').hidden, top:Math.round(document.getElementById('hoja-indice').getBoundingClientRect().top)})`);
    ok(!h3.oculta && h3.top < h2.top - 100, `Celular: 2.ª apertura, arrastrar sube y no cierra (${JSON.stringify(h3)})`);
    await tecla("Escape", 0, "Escape", 27); await esperar(900);
    const fin2 = await ev(`({oculta:document.getElementById('hoja-indice').hidden, modal:document.documentElement.classList.contains('con-modal'), foco:document.activeElement.className})`);
    ok(fin2.oculta && !fin2.modal, `Celular: Escape cierra la hoja (${JSON.stringify(fin2)})`);
    // ⌘K en celular
    await clic(".buscar-cmd"); await esperar(500);
    const ck = await ev(`(()=>{const c=document.querySelector('.comando-caja').getBoundingClientRect();return {vis:!document.getElementById('comando').hidden, l:c.left, r:c.right}})()`);
    ok(ck.vis && ck.l >= 8 && ck.r <= 382, `Celular: ⌘K abre y cabe (${Math.round(ck.l)}–${Math.round(ck.r)})`);
    await tecla("Escape", 0, "Escape", 27); await esperar(400);
    await cdp("Page.captureScreenshot", { format: "png" }).then((s) => fs.writeFileSync(path.join(DESC, "..", "celular-final.png"), Buffer.from(s.result.data, "base64")));
  }
});
