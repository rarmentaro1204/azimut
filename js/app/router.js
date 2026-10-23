/* Configuratore Yacht — modulo "router" */
/* ============== ROUTER ============== */
function render(){
  if(typeof DASH!=='undefined'&&DASH){renderDashboard();window.scrollTo(0,0);return;}
  maxReached=Math.max(maxReached,step);
  renderStepper();
  try{[stepCustomer,stepProduct,stepOptions,stepQuote][step]();}
  catch(err){
    console.error(err);
    $('#view').innerHTML=`<div class="card"><h2>⚠ Errore nel passaggio ${step+1}</h2><p class="hint">${esc(String(err&&err.message||err))}</p>
      <pre style="white-space:pre-wrap;font-size:11px;color:#8c1412">${esc(String(err&&err.stack||''))}</pre></div>`;
  }
  $('#btnPrev').disabled=step===0;
  $('#btnNext').classList.toggle('app-hide',step===STEPS.length-1);
  $('#lbl-prev').textContent=t('back');$('#lbl-next').textContent=t('next');
  window.scrollTo(0,0);
}
$('#btnPrev').onclick=()=>{if(step>0){step--;render();}};
$('#btnNext').onclick=()=>{if(step<STEPS.length-1){step++;render();}};
function refreshTermDefaults(){
  ['delivery','packaging','payment'].forEach(f=>{
    const v=S[f];
    const isDef=!v||['it','en','es','fr','de'].some(l=>I18N[l]&&I18N[l]['def_'+f]===v);
    if(isDef)S[f]=t('def_'+f);
  });
}
$('#langSel').onchange=e=>{LANG=e.target.value;document.documentElement.lang=LANG;refreshTermDefaults();render();};

