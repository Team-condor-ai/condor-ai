(() => {
  const grid = document.querySelector('.bb-plans, .planes');
  if (!grid) return;
  const prices = [49990, 89990, 119990];
  const markets = {CLP:{name:'Chile',rate:1,locale:'es-CL',digits:0},PEN:{name:'Perú',rate:0.00362076,locale:'es-PE',digits:2},COP:{name:'Colombia',rate:3.36807,locale:'es-CO',digits:0}};
  const control=document.createElement('div');
  control.style.cssText='margin:30px 0 18px;max-width:100%;font-size:14px;line-height:1.6';
  control.innerHTML='<label for="barbara-market">Ver precios para </label><select id="barbara-market" style="font:inherit;padding:10px 14px;border:1px solid #adb969;border-radius:8px;background:#f6f5ee;color:#15170d;margin:8px"><option value="CLP">Chile · CLP</option><option value="PEN">Perú · PEN</option><option value="COP">Colombia · COP</option></select><p id="barbara-fx-note" aria-live="polite" style="font-size:13px;margin:8px 0;max-width:740px"></p>';
  grid.before(control);
  const select=control.querySelector('select');
  const note=control.querySelector('p');
  function update(){
    const code=select.value,m=markets[code];
    grid.querySelectorAll('.bb-plan, .plan').forEach((card,i)=>{
      const amount=prices[i]*m.rate;
      const formatted=new Intl.NumberFormat(m.locale,{minimumFractionDigits:m.digits,maximumFractionDigits:m.digits}).format(amount);
      const display=(code==='PEN'?'S/ ':'$')+formatted;
      const price=card.querySelector('.bb-price, .precio');
      price.replaceChildren(document.createTextNode((code==='CLP'?'':'≈ ')+display+' '));
      const unit=document.createElement('small');unit.textContent=code+' / mes';price.append(unit);
      const link=card.querySelector('a[href*="wa.me"]');
      if(link) link.href='https://wa.me/56988989824?text='+encodeURIComponent('Hola, me interesa Bárbara '+['Lite','Go','Plus'][i]+' para '+m.name+'. Precio '+(code==='CLP'?'':'referencial ')+display+' '+code+' al mes. Quiero confirmar el total y las condiciones.');
    });
    note.replaceChildren(document.createTextNode(code==='CLP'?'Valores base mensuales en CLP.':'Conversión referencial al 09/09/2026, no cotización en tiempo real. El total, impuestos aplicables y moneda de cobro se confirman antes de contratar. '));
    if(code!=='CLP') {const source=document.createElement('a');source.href=code==='PEN'?'https://www.currencystats247.com/currencies/clp-pen/2026/':'https://www.xe.com/en-us/currencyconverter/convert/?Amount=1&From=CLP&To=COP';source.textContent='Fuente del cambio';source.target='_blank';source.rel='noopener noreferrer';source.style.color='inherit';note.append(source);}
  }
  select.addEventListener('change',update);update();
})();
