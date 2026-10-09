// Auditoría de accesibilidad y celular de TODA la página.
// node auditoria.mjs tab|aria|contraste|movil|reducido [ancho]
import { conChrome, esperar } from "./cdp.mjs";
import fs from "node:fs";
import path from "node:path";
const URL = "http://127.0.0.1:5320/";
const [modo, anchoArg] = process.argv.slice(2);
const salida = (n, d) => fs.writeFileSync(path.join(import.meta.dirname, n), JSON.stringify(d, null, 1));
const recorrer = async (ev, alto) => {
  const H = await ev(`document.documentElement.scrollHeight`);
  for (let y = 0; y < H; y += alto * 0.7) { await ev(`scrollTo(0,${y})`); await esperar(140); }
  await ev(`scrollTo(0,0)`); await esperar(600);
};
const SEL = `const sel=(e)=>{if(!e||e===document.body)return 'body';let s=e.tagName.toLowerCase();if(e.id)return s+'#'+e.id;if(e.classList.length)s+='.'+[...e.classList].slice(0,3).join('.');const sec=e.closest('main > section');return s+(sec?' @'+sec.id:'')+(e.textContent.trim()?' «'+e.textContent.trim().slice(0,24)+'»':'')};`;

await conChrome(async ({ cdp, ev, abrir, tecla }) => {
  if (modo === "tab") {
    await abrir(URL, 1440, 900);
    await recorrer(ev, 900);
    await ev(`document.activeElement.blur(); window.__vistos=[];`);
    const pasos = [];
    for (let i = 0; i < 700; i++) {
      await tecla("Tab", 0, "Tab", 9); await esperar(i < 3 ? 120 : 25);
      const r = await ev(`(()=>{${SEL}const e=document.activeElement;const c=getComputedStyle(e);const r=e.getBoundingClientRect();
        const anillo=(c.outlineStyle!=='none'&&parseFloat(c.outlineWidth)>0)||(c.boxShadow!=='none');
        // ¿el foco se pinta en un pariente (casillas/interruptores con el input oculto)?
        const p=e.parentElement, pc=p&&getComputedStyle(p);
        const enPadre=!!p&&e.matches(':focus-visible')&&(pc.outlineStyle!=='none'&&parseFloat(pc.outlineWidth)>0);
        const sib=e.nextElementSibling, sc=sib&&getComputedStyle(sib);const enHermano=!!sib&&((sc.outlineStyle!=='none'&&parseFloat(sc.outlineWidth)>0)||sc.boxShadow.includes('rgb(1, 76, 253)')||sc.boxShadow.includes('0px 0px 0px'));
        const vis=r.width>0&&r.height>0&&c.visibility!=='hidden'&&parseFloat(c.opacity)>0.05;
        const enVista=r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth;
        let idx=-1;const todos=document.querySelectorAll('*');idx=Array.prototype.indexOf.call(todos,e);
        return {s:sel(e),fv:e.matches(':focus-visible'),anillo,enPadre,enHermano,vis,enVista,idx,w:Math.round(r.width),h:Math.round(r.height),ol:c.outlineStyle+' '+c.outlineWidth,bs:c.boxShadow.slice(0,60),modal:!!e.closest('[aria-modal=true],.velo')}})()`);
      pasos.push(r);
      if (i > 5 && (r.s === pasos[0].s)) break;   // dio la vuelta
    }
    salida("tab.json", pasos);
    const sinAnillo = pasos.filter((p) => !p.anillo && !p.enPadre && !p.enHermano);
    const invisibles = pasos.filter((p) => !p.vis || !p.enVista);
    const desorden = [];
    for (let i = 1; i < pasos.length; i++) if (pasos[i].idx < pasos[i - 1].idx && !/dock|pildora|barra|buscar-cmd/.test(pasos[i].s)) desorden.push(`${pasos[i - 1].s} → ${pasos[i].s}`);
    const rep = new Map(); pasos.forEach((p) => rep.set(p.s, (rep.get(p.s) || 0) + 1));
    console.log(`Tab: ${pasos.length} paradas · sin anillo visible: ${sinAnillo.length} · invisibles/fuera de vista: ${invisibles.length} · saltos hacia atrás: ${desorden.length} · repetidos: ${[...rep].filter(([, n]) => n > 1).length}`);
    console.log("SIN ANILLO:\n " + [...new Set(sinAnillo.map((p) => `${p.s} [${p.ol} | ${p.bs}]`))].join("\n "));
    console.log("INVISIBLES:\n " + [...new Set(invisibles.map((p) => `${p.s} vis=${p.vis} enVista=${p.enVista} ${p.w}x${p.h}`))].join("\n "));
    console.log("ATRÁS:\n " + desorden.join("\n "));
    console.log("REPETIDOS:\n " + [...rep].filter(([, n]) => n > 1).map(([s, n]) => `${s} ×${n}`).join("\n "));
    console.log("Última parada:", pasos.at(-1).s);
  }

  if (modo === "aria") {
    await abrir(URL, +(anchoArg || 1440), 900, +(anchoArg || 1440) < 700);
    await recorrer(ev, 900);
    const axe = await (await fetch("https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js")).text();
    await cdp("Runtime.evaluate", { expression: axe });
    const r = await ev(`axe.run(document, { resultTypes: ['violations','incomplete'], rules: { 'color-contrast': { enabled: false } } }).then(r => ({v: r.violations.map(v => ({id: v.id, impact: v.impact, help: v.help, n: v.nodes.length, nodos: v.nodes.slice(0, 8).map(n => n.target.join(' ') + ' :: ' + (n.failureSummary||'').split('\\n').slice(1,3).join(' / ').slice(0,200))})), inc: r.incomplete.filter(i=>i.id!=='color-contrast').map(i => i.id + ' ×' + i.nodes.length)}))`);
    salida("aria.json", r);
    for (const v of r.v) { console.log(`\n[${v.impact}] ${v.id} ×${v.n} — ${v.help}`); v.nodos.forEach((n) => console.log("   " + n)); }
    console.log("\nincompletos:", r.inc.join(", "));
    // chequeos propios: ids duplicados, aria-controls/labelledby rotos
    const p = await ev(`(()=>{const ids={};document.querySelectorAll('[id]').forEach(e=>ids[e.id]=(ids[e.id]||0)+1);const dup=Object.entries(ids).filter(([,n])=>n>1).map(([i,n])=>i+'×'+n);
      const rotos=[];document.querySelectorAll('[aria-controls],[aria-labelledby],[aria-describedby],[aria-activedescendant]').forEach(e=>['aria-controls','aria-labelledby','aria-describedby','aria-activedescendant'].forEach(a=>{const v=e.getAttribute(a);if(v)v.split(/\\s+/).forEach(id=>{if(id&&!document.getElementById(id))rotos.push(a+'='+id+' en '+(e.id||e.className))})}));
      const tabs=[...document.querySelectorAll('[role=tab]')].filter(t=>!t.getAttribute('aria-controls')).map(t=>(t.closest('[role=tablist]')?.id||t.closest('[role=tablist]')?.className)+' «'+t.textContent.trim()+'»');
      return {dup,rotos,tabsSinPanel:tabs}})()`);
    console.log("\nids duplicados:", p.dup.join(", ") || "ninguno");
    console.log("referencias aria rotas:", p.rotos.join(" | ") || "ninguna");
    console.log("role=tab sin aria-controls:", p.tabsSinPanel.length, [...new Set(p.tabsSinPanel)].slice(0, 12).join(" | "));
  }

  if (modo === "contraste") {
    const W = +(anchoArg || 1440), Hh = W < 700 ? 844 : 900;
    await abrir(URL, W, Hh, W < 700);
    await recorrer(ev, Hh);
    await ev(`(()=>{const s=document.createElement('style');s.id='__sintexto';s.textContent='*,*::before,*::after{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important;text-decoration-color:transparent!important}';window.__st=s;
      // pausa de animaciones para que ambas fotos coincidan
      document.getAnimations().forEach(a=>{try{a.pause()}catch{}});})()`);
    const H = await ev(`document.documentElement.scrollHeight`);
    const fallos = [];
    let total = 0;
    for (let y = 0; y < H; y += Hh - 120) {
      await ev(`scrollTo(0,${y})`); await esperar(1300);
      await ev(`document.getAnimations().forEach(a=>{try{a.pause()}catch{}})`);
      await ev(`document.head.appendChild(window.__st)`); await esperar(120);
      const shot = (await cdp("Page.captureScreenshot", { format: "png" })).result.data;
      await ev(`window.__st.remove()`); await esperar(60);
      const r = await ev(`(async()=>{${SEL}
        const img=new Image();img.src='data:image/png;base64,${shot}';await img.decode();
        const cv=document.createElement('canvas');cv.width=img.width;cv.height=img.height;const cx=cv.getContext('2d');cx.drawImage(img,0,0);
        const k=img.width/innerWidth;
        const lum=(r,g,b)=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)};
        const ratio=(a,b)=>{const x=lum(...a),y=lum(...b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)};
        const out=[];let n=0;
        const tw=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode:t=>t.textContent.trim().length>1?1:3});
        const vistos=new Set();
        while(tw.nextNode()){const t=tw.currentNode,e=t.parentElement;if(!e||vistos.has(e))continue;vistos.add(e);
          if(e.closest('[aria-hidden=true],svg,script,style,.vidrio__defs,[hidden]'))continue;{const b=e.getBoundingClientRect();if(b.width<=2||b.height<=2)continue;}
          const rg=document.createRange();rg.selectNodeContents(t);const rr=[...rg.getClientRects()].filter(q=>q.width>2&&q.height>4&&q.top>=60&&q.bottom<=innerHeight-4&&q.left>=0&&q.right<=innerWidth);
          if(!rr.length)continue;
          const c=getComputedStyle(e);if(c.visibility==='hidden')continue;
          let op=1;for(let p=e;p;p=p.parentElement)op*=parseFloat(getComputedStyle(p).opacity);if(op<0.1)continue;
          const m=c.color.match(/[\\d.]+/g).map(Number);let a=(m[3]??1)*op;if(a<0.05)continue;
          // fondo: píxeles del rectángulo del texto sin texto
          const q=rr[0];const xs=[],peor={r:99};
          const x0=Math.round(q.left*k),y0=Math.round(q.top*k),w=Math.max(1,Math.round(q.width*k)),h=Math.max(1,Math.round(q.height*k));
          const d=cx.getImageData(x0,y0,w,h).data;
          const pasos=Math.max(1,Math.floor(d.length/4/60));
          let peorR=99,sum=[0,0,0],cnt=0;
          for(let i=0;i<d.length/4;i+=pasos){const bg=[d[i*4],d[i*4+1],d[i*4+2]];const fg=[0,1,2].map(j=>m[j]*a+bg[j]*(1-a));const rt=ratio(fg,bg);if(rt<peorR)peorR=rt;sum[0]+=rt;cnt++;}
          // mediana aproximada: promedio de las razones
          const prom=sum[0]/cnt;
          const tam=parseFloat(c.fontSize),peso=parseInt(c.fontWeight);const grande=tam>=24||(tam>=18.66&&peso>=700);
          const min=grande?3:4.5;n++;
          if(prom<min)out.push({s:sel(e),txt:t.textContent.trim().slice(0,40),prom:+prom.toFixed(2),peor:+peorR.toFixed(2),tam,peso,color:c.color,min});
        }
        return {n,out}})()`);
      total += r.n; fallos.push(...r.out);
    }
    const unicos = [...new Map(fallos.map((f) => [f.s + f.txt, f])).values()];
    salida(`contraste-${W}.json`, unicos);
    console.log(`Contraste ${W}px: ${total} textos medidos sobre el render · ${unicos.length} bajo AA`);
    unicos.sort((a, b) => a.prom - b.prom).forEach((f) => console.log(`  ${f.prom}:1 (mín ${f.min}, peor px ${f.peor}) ${f.s} «${f.txt}» ${f.tam}px/${f.peso} ${f.color}`));
  }

  if (modo === "movil") {
    await abrir(URL, 390, 844, true);
    await recorrer(ev, 844);
    const r = await ev(`(()=>{${SEL}
      const secs=[...document.querySelectorAll('main > section')].map(s=>({id:s.id,d:s.scrollWidth-s.clientWidth}));
      // culpables: piezas que pasan el borde y no están dentro de un carril con scroll propio
      const W=innerWidth;const culp=[];
      document.querySelectorAll('main *').forEach(e=>{const r=e.getBoundingClientRect();if(!r.width||r.right<=W+0.5&&r.left>=-0.5)return;
        let p=e.parentElement,carril=false;while(p&&p.tagName!=='MAIN'){const c=getComputedStyle(p);if(/(auto|scroll|hidden|clip)/.test(c.overflowX)){carril=true;break}p=p.parentElement}
        if(!carril&&getComputedStyle(e).position!=='fixed')culp.push(sel(e)+' →'+Math.round(r.right)+' ←'+Math.round(r.left))});
      // objetivos táctiles
      const foc=[...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab],[role=switch],[role=slider],[role=option],[role=menuitem],[tabindex]:not([tabindex="-1"]),summary,label')];
      const chicos=[];foc.forEach(e=>{const c=getComputedStyle(e);if(c.display==='none'||c.visibility==='hidden'||e.closest('[hidden]'))return;let r=e.getBoundingClientRect();
        // input oculto dentro de un label: cuenta el label
        if((r.width<2||r.height<2||c.opacity==='0')&&e.closest('label')){r=e.closest('label').getBoundingClientRect()}
        if(r.width<2&&r.height<2)return;
        const enTexto=e.tagName==='A'&&e.closest('p,li')&&getComputedStyle(e).display==='inline';
        if((r.width<44||r.height<44)&&!enTexto)chicos.push(sel(e)+' '+Math.round(r.width)+'x'+Math.round(r.height))});
      return {docW:document.documentElement.scrollWidth,W,secs:secs.filter(s=>s.d>0),todas:secs.length,culp:[...new Set(culp)].slice(0,40),chicos}})()`);
    salida("movil.json", r);
    console.log(`Celular 390: documento scrollWidth ${r.docW} / ${r.W}; secciones con desborde: ${r.secs.length} de ${r.todas} ${JSON.stringify(r.secs)}`);
    console.log("piezas fuera del borde (sin carril):\n  " + r.culp.join("\n  "));
    const porTipo = new Map(); r.chicos.forEach((c) => { const k = c.replace(/ \d+x\d+$/, "").replace(/ «.*»/, ""); porTipo.set(k, [...(porTipo.get(k) || []), c.match(/\d+x\d+$/)[0]]); });
    console.log(`objetivos táctiles < 44 px: ${r.chicos.length}`);
    [...porTipo].forEach(([k, v]) => console.log(`  ${k} ×${v.length} (${[...new Set(v)].slice(0, 4).join(", ")})`));
  }

  if (modo === "reducido") {
    await cdp("Page.addScriptToEvaluateOnNewDocument", { source: `(()=>{let n=0;const o=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=(f)=>{n++;return o(f)};window.__rafs=()=>n;})()` });
    await abrir(URL, 1440, 900, false, () => cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }));
    ok: {
      const m = await ev(`matchMedia('(prefers-reduced-motion: reduce)').matches`);
      console.log("prefers-reduced-motion emulado:", m);
    }
    await recorrer(ev, 900);
    // quedarse en cada sección un momento para que todo lo que se arranque al entrar arranque
    const ids = await ev(`[...document.querySelectorAll('main > section')].map(s=>s.id)`);
    for (const id of ids) { await ev(`document.getElementById('${id}').scrollIntoView()`); await esperar(250); }
    await esperar(1500);
    const r = await ev(`(()=>{${SEL}const a=document.getAnimations().filter(x=>x.effect?.getComputedTiming().iterations===Infinity&&x.playState==='running');
      return a.map(x=>{const t=x.effect.target;return (x.animationName||x.constructor.name)+' en '+sel(t)+' '+Math.round(x.effect.getComputedTiming().duration)+'ms'})})()`);
    const raf0 = await ev(`__rafs()`); await esperar(2000); const raf1 = await ev(`__rafs()`);
    salida("reducido.json", r);
    console.log(`Animaciones infinitas corriendo con movimiento reducido: ${r.length}`);
    r.forEach((x) => console.log("  " + x));
    console.log(`requestAnimationFrame en 2 s quieto (al final de la página): ${raf1 - raf0}`);
    for (const id of ["inicio", "vidrio", "momentos", "carga"]) {
      await ev(`document.getElementById('${id}').scrollIntoView()`); await esperar(800);
      const a = await ev(`__rafs()`); await esperar(1000); const b = await ev(`__rafs()`);
      const inf = await ev(`document.getAnimations().filter(x=>x.effect?.getComputedTiming().iterations===Infinity&&x.playState==='running').length`);
      console.log(`  en #${id}: rAF/s ${b - a}, infinitas ${inf}`);
    }
  }
});
