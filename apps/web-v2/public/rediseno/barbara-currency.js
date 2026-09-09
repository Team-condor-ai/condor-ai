(() => {
 const grid=document.querySelector('.bb-plans, .planes');if(!grid)return;
 const markets=[
  {code:'CLP',name:'Chile',locale:'es-CL',digits:0,prices:[49990,89990,119990]},
  {code:'PEN',name:'Perú',locale:'es-PE',digits:2,prices:[179.9,329.9,439.9]},
  {code:'COP',name:'Colombia',locale:'es-CO',digits:0,prices:[169990,304990,404990]}
 ];
 const css=document.createElement('link');css.rel='stylesheet';css.href='/rediseno/barbara-currency.css?v=3';document.head.append(css);
 const control=document.createElement('div');control.className='bb-market-control';
 control.innerHTML='<p class="bb-market-label">Elige tu país</p><div class="bb-country-slider" role="radiogroup" aria-label="País de los precios de Bárbara"><span class="bb-country-thumb" aria-hidden="true"></span>'+markets.map((m,i)=>'<button type="button" role="radio" aria-checked="'+(i===0)+'" tabindex="'+(i===0?0:-1)+'" data-market="'+i+'">'+m.name+'<small>'+m.code+'</small></button>').join('')+'</div><p class="bb-market-note" aria-live="polite"></p>';
 grid.before(control);
 const buttons=[...control.querySelectorAll('button')],slider=control.querySelector('.bb-country-slider'),note=control.querySelector('.bb-market-note'),reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let selected=0;
 function update(index,animate=true){
  selected=index;const m=markets[index];slider.style.setProperty('--country-index',index);
  buttons.forEach((b,i)=>{b.setAttribute('aria-checked',String(i===index));b.tabIndex=i===index?0:-1;});
  grid.querySelectorAll('.bb-plan, .plan').forEach((card,i)=>{
   const formatted=new Intl.NumberFormat(m.locale,{minimumFractionDigits:m.digits,maximumFractionDigits:m.digits}).format(m.prices[i]);
   const display=(m.code==='PEN'?'S/ ':'$')+formatted,price=card.querySelector('.bb-price, .precio');
   price.getAnimations().forEach(a=>a.cancel());price.replaceChildren(document.createTextNode(display+' '));
   const unit=document.createElement('small');unit.textContent=m.code+' / mes';price.append(unit);
   if(animate&&!reduce.matches)price.animate([{opacity:.25,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],{duration:280,easing:'ease-out'});
   const link=card.querySelector('a[href*="wa.me"]');
   if(link)link.href='https://wa.me/56988989824?text='+encodeURIComponent('Hola, me interesa Bárbara '+['Lite','Go','Plus'][i]+' para '+m.name+' a '+display+' '+m.code+' al mes. Quiero confirmar las condiciones y activar mi plan.');
  });
  note.textContent='Precios mensuales para '+m.name+' en '+m.code+'. '+(m.code==='CLP'?'':'Valores comerciales redondeados; no varían con el cambio diario. ')+'El total y los impuestos aplicables se confirman antes de contratar.';
 }
 buttons.forEach((b,i)=>b.addEventListener('click',()=>update(i)));
 slider.addEventListener('keydown',e=>{
  let next=selected;
  if(e.key==='ArrowRight'||e.key==='ArrowDown')next=(selected+1)%3;
  else if(e.key==='ArrowLeft'||e.key==='ArrowUp')next=(selected+2)%3;
  else if(e.key==='Home')next=0;else if(e.key==='End')next=2;else return;
  e.preventDefault();update(next);buttons[next].focus();
 });
 let touchStart=null;
 slider.addEventListener('touchstart',e=>{touchStart=e.touches[0].clientX;},{passive:true});
 slider.addEventListener('touchend',e=>{if(touchStart===null)return;const delta=e.changedTouches[0].clientX-touchStart;touchStart=null;if(Math.abs(delta)>40)update(Math.max(0,Math.min(2,selected+(delta<0?1:-1))));},{passive:true});
 update(0,false);
})();
