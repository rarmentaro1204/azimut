/* Configuratore Yacht — modulo "step-product" */
/* ============== STEP 3: PRODUCT ============== */
let curCat=null, curSub=null, curProt='', search='', showAllAcc={};
function catCounts(){const c={};DATA.machines.forEach(m=>c[m.category]=(c[m.category]||0)+1);return c;}
// ordine fisso delle categorie (catOrder dal catalogo); senza catOrder: per numero di modelli
function catOrderOf(c){const o=DATA.machines.filter(m=>m.category===c).map(m=>m.catOrder).filter(x=>x!=null);return o.length?Math.min(...o):999;}
// protezione: "ATEX INERT" conta come ATEX, "ACD INERT" come ACD
// filtro "Lunghezza": fascia calcolata dal catalogo (campo subcategory)
const BAND_ORDER=['Fino a 20 m','20–25 m','25–30 m','Oltre 30 m'];
function protOf(m){return m.subcategory||'—';}
function protBadge(m){return '';}
function subCounts(){const c={};DATA.machines.filter(m=>m.category===curCat&&(!curProt||protOf(m)===curProt)).forEach(m=>{const s=m.subcategory||m.family||'—';c[s]=(c[s]||0)+1;});return c;}
// Listino $ = listino € + 10% (se il listino barche ha una colonna Prezzo_USD, vale quella)
const USD_MARKUP=1.10;
function usdOf(e){return Math.round((Number(e)||0)*USD_MARKUP);}
// passo Prodotto a tre schermate: 0 listino · 1 gamma · 2 modello
let PSTEP=0, PANIM=false, PCHOSEN=false;
function machineImg(m){const f=(m.photos||[])[0]||m.imageFile;return f?thumbUrl(f):imgUrlForCode(m.code);}
function buildMachineListHtml(){
  let list=DATA.machines;
  if(curCat)list=list.filter(m=>m.category===curCat);
  if(curCat&&curSub)list=list.filter(m=>(m.subcategory||m.family||'—')===curSub);
  if(curProt)list=list.filter(m=>protOf(m)===curProt);
  if(search){const q=search.toLowerCase();list=list.filter(m=>(m.name+' '+m.code+' '+(m.family||'')+' '+(m.subcategory||'')+' '+(m.category||'')).toLowerCase().includes(q));}
  list=list.slice(0,300);
  const html=list.map((m,i)=>{
    const meta=[m.loa,m.cabins&&(m.cabins+' '+t('cabins_short'))].filter(Boolean).join(' · ');
    const img=machineImg(m),ex=S.solutions.find(x=>x.code===m.code);
    return `<div class="mcard${ex?' on':''}" style="--i:${Math.min(i,10)}">
      <div class="mimg">${img?`<img src="${img}" alt="" loading="lazy">`:''}</div>
      <div class="mbody"><div class="mnm">${esc(String(m.name).replace(/^Ferretti Yachts\s*/i,''))}</div>
        <div class="mmeta">${esc(meta||m.category)}</div>
        <div class="mfoot"><div class="mpr">${priceOf(m)?listMoney(priceOf(m)):'<span>'+t('price_tbd')+'</span>'}</div>
          <button class="btn prim sm" data-add="${esc(m.code)}">${ex?'✓ ×'+ex.qty:L2('Aggiungi','Add')}</button></div></div></div>`;
  }).join('');
  return html||'<p class="hint">'+t('no_results')+'</p>';
}
function refreshMachineList(){
  const box=document.querySelector('.mgrid'); if(!box)return;
  box.innerHTML=buildMachineListHtml();
  box.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>addSolution(b.dataset.add));
}
// cambio di schermata: l'attuale esce in 150 ms, la nuova entra dal basso con un leggero scaglionamento
function goP(n){
  const st=document.querySelector('.pstage');PANIM=true;
  if(st&&!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)){st.classList.add('leaving');setTimeout(()=>{PSTEP=n;stepProduct();},150);}
  else{PSTEP=n;stepProduct();}
}
function pCrumbsHtml(){
  const lv=S.listino==='USD'?'$ · USD':'€ · EUR';
  const items=[[L2('Listino','Price list'),PCHOSEN||PSTEP>0?lv:'—'],[L2('Gamma','Range'),curCat&&PSTEP>1?curCat:'—'],[L2('Modello','Model'),S.solutions.length?S.solutions.map(x=>String(x.name).replace(/^Ferretti Yachts\s*/i,'')).join(', '):'—']];
  return `<div class="pcrumbs">${items.map(([k,val],i)=>`<button class="pcr${i===PSTEP?' on':''}${i<PSTEP?' done':''}" ${i<PSTEP?`data-pgo="${i}"`:'disabled'}><i>${i+1}</i><span>${esc(k)}</span><b>${esc(val)}</b></button>`).join('')}</div>`;
}
function pStageHtml(){
  if(PSTEP===0){
    return `<div class="phead"><div class="peyebrow">${L2('Passo 1 di 3','Step 1 of 3')}</div><h3>${L2('Scegli il listino','Choose the price list')}</h3></div>
    <div class="ptiles two">
      <button class="ptile" data-listino="EUR" style="--i:0"><span class="psym">€</span><span class="pt">${L2('Listino Euro','Euro price list')}</span><span class="ps">L€ · ${L2('prezzi in euro','prices in euro')}</span></button>
      <button class="ptile" data-listino="USD" style="--i:1"><span class="psym">$</span><span class="pt">${L2('Listino Dollaro','Dollar price list')}</span><span class="ps">L$ · ${L2('listino euro + 10%','euro price list + 10%')}</span></button>
    </div>`;
  }
  if(PSTEP===1){
    const counts=catCounts();
    const cats=Object.keys(counts).sort((a,b)=>catOrderOf(a)-catOrderOf(b)||counts[b]-counts[a]);
    return `<div class="phead"><div class="peyebrow">${L2('Passo 2 di 3','Step 2 of 3')}</div><h3>${L2('Scegli la gamma','Choose the range')}</h3></div>
    <div class="ptiles">${cats.map((c,i)=>{const first=DATA.machines.find(m=>m.category===c),img=first?machineImg(first):'';
      return `<button class="ptile photo" data-c="${esc(c)}" style="--i:${i}">${img?`<span class="pimg"><img src="${img}" alt="" loading="lazy"></span>`:''}<span class="pt">${esc(c)}</span><span class="ps">${counts[c]} ${t('models')}</span></button>`;}).join('')}</div>`;
  }
  const protCounts={};DATA.machines.filter(m=>!curCat||m.category===curCat).forEach(m=>{const p=protOf(m);protCounts[p]=(protCounts[p]||0)+1;});
  const protHtml=['',...BAND_ORDER.filter(b=>protCounts[b]),...Object.keys(protCounts).filter(b=>!BAND_ORDER.includes(b))].map(p=>`<button class="chip${p===curProt?' sel':''}" data-prot="${p}">${p?esc(p):t('all_f')}${p?' · '+protCounts[p]:''}</button>`).join('');
  return `<div class="phead"><div class="peyebrow">${L2('Passo 3 di 3','Step 3 of 3')}</div><h3>${L2('Scegli il modello','Choose the model')}</h3></div>
    <div class="pfilters"><span class="hint">${t('protection_f')}</span>${protHtml}</div>
    <input class="search" id="i_search" placeholder="${esc(t('ph_search'))}" value="${esc(search)}">
    <div class="mgrid">${buildMachineListHtml()}</div>
    <button class="btn ghost" id="btnCustom" style="margin-top:14px">+ ${t('add_custom')}</button>`;
}
function stepProduct(){
  const v=$('#view');
  if(PSTEP===0&&!PCHOSEN&&S.solutions.length)PSTEP=2;   // tornando al passo con prodotti già scelti: si riparte dai modelli
  const anim=PANIM;PANIM=false;
  v.innerHTML=`
  <div class="card pcard">
    <h2>${t('step_product')}</h2>
    ${pCrumbsHtml()}
    <div class="pstage${anim?' in':''}">${pStageHtml()}</div>
  </div>
  <div class="card">
    <h2>${t('selected_solutions')} (${S.solutions.length})</h2>
    ${S.solutions.length?renderSolList():'<p class="hint">'+t('none_selected')+'</p>'}
  </div>
  ${selectedDrawer()}`;
  v.querySelectorAll('[data-pgo]').forEach(b=>b.onclick=()=>goP(+b.dataset.pgo));
  v.querySelectorAll('[data-listino]').forEach(b=>b.onclick=()=>setListino(b.dataset.listino));
  v.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{curCat=b.dataset.c;curSub=null;curProt='';search='';goP(2);});
  v.querySelectorAll('[data-prot]').forEach(b=>b.onclick=()=>{curProt=b.dataset.prot;curSub=null;stepProduct();});
  if($('#i_search'))$('#i_search').oninput=e=>{search=e.target.value;refreshMachineList();};
  v.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>addSolution(b.dataset.add));
  if($('#btnCustom'))$('#btnCustom').onclick=addCustomSolution;
  v.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{S.solutions.splice(+b.dataset.del,1);stepProduct();});
  wireMove(v);
  v.querySelectorAll('[data-qty]').forEach(inp=>inp.oninput=e=>{S.solutions[+inp.dataset.qty].qty=Math.max(1,+e.target.value||1);});
  wireDrawer();
}
// listino prezzi: € oppure $ (il $ è il listino euro + 10%); cambiarlo azzera i prodotti scelti
function setListino(l){
  if((S.listino||'EUR')!==l){
    if(S.solutions.length&&!confirm(L2('Cambiando listino i prodotti selezionati vengono rimossi. Continuare?','Changing price list removes the selected products. Continue?')))return;
    S.solutions=[];S.listino=l;delete S.net;
    if(l==='USD'){S.cur='USD';S.fxRate=1;S.fxDate='';}else fxSelect('EUR');
  }
  PCHOSEN=true;goP(1);
}
let drawerOpen=window.innerWidth>640;   // su telefono il riepilogo parte chiuso
function selectedDrawer(){
  const items=S.solutions.map((s,i)=>`<div class="ditem">
      ${s.img?`<img class="imgthumb" style="width:36px;height:36px" src="${s.img}">`:'<span style="width:36px"></span>'}
      <div style="flex:1;min-width:0"><div class="nm">${esc(s.name)}</div><div class="cd">${esc(s.code)} · ×${s.qty} · ${money(s.unit)}</div></div>
      <button class="xbtn" data-ddel="${i}">✕</button></div>`).join('');
  return `<div class="drawer${drawerOpen?'':' closed'}" id="drawer">
    <div class="dtab" data-drawer-toggle>▸ ${t('selected_solutions')} (${S.solutions.length})</div>
    <div class="dhead"><span>🛒 ${t('selected_solutions')} (${S.solutions.length})</span><button class="xbtn" data-drawer-toggle>—</button></div>
    <div class="dbody">${S.solutions.length?items:'<p class="hint" style="margin:6px 0">'+t('none_selected')+'</p>'}</div>
  </div>`;
}
function wireDrawer(){
  document.querySelectorAll('[data-drawer-toggle]').forEach(b=>b.onclick=()=>{drawerOpen=!drawerOpen;const d=$('#drawer');if(d)d.classList.toggle('closed',!drawerOpen);});
  document.querySelectorAll('[data-ddel]').forEach(b=>b.onclick=()=>{S.solutions.splice(+b.dataset.ddel,1);render();});
}
// reorder the selected products: ▲▼ buttons (the order is the order of the solutions in the offer)
function mvBtns(i){return `<span class="mvbtns"><button class="xbtn" data-mv="${i}|-1" title="${esc(t('move_up'))}" ${i===0?'disabled':''}>▲</button><button class="xbtn" data-mv="${i}|1" title="${esc(t('move_down'))}" ${i===S.solutions.length-1?'disabled':''}>▼</button></span>`;}
function moveSolution(i,d){const j=i+d;if(j<0||j>=S.solutions.length)return;
  [S.solutions[i],S.solutions[j]]=[S.solutions[j],S.solutions[i]];
  if(typeof showAllAcc!=='undefined'&&showAllAcc){const a=showAllAcc[i];showAllAcc[i]=showAllAcc[j];showAllAcc[j]=a;}
  render();}
function wireMove(root){root.querySelectorAll('[data-mv]').forEach(b=>b.onclick=()=>{const[i,d]=b.dataset.mv.split('|').map(Number);moveSolution(i,d);});}
function renderSolList(){
  return S.solutions.map((s,i)=>`<div class="sol">
    <div class="head"><div><div class="nm">${esc(s.name)} ${s.atex?'<span class="badge">ATEX</span>':''}${s.sparesOnly?'<span class="badge" style="background:#4a4a4a">'+t('spares_sale_badge')+'</span>':''}</div>
    <div class="cd">${s.sparesOnly?(s.accessories.length+' '+t('accessories').toLowerCase()):esc(s.code)+' · '+money(s.unit)}</div></div>
    <span style="display:inline-flex;gap:6px;align-items:center">${mvBtns(i)}<button class="xbtn" data-del="${i}">✕</button></span></div>
    ${s.sparesOnly?'':`<div class="addbar"><label class="fld" style="max-width:120px">${t('qty')}
      <input type="number" min="1" value="${s.qty}" data-qty="${i}"></label></div>`}
  </div>`).join('');
}
function addCustomSolution(){
  S.solutions.push({code:'',name:t('new_machine'),desc:'',atex:false,unit:0,qty:1,img:'',imgs:[],specs:{},accessories:[],custom:true});
  step=2;maxReached=Math.max(maxReached,2);render();
}
function addSparesSolution(){
  S.solutions.push({code:'',name:t('spares_sale_title'),desc:'',atex:false,unit:0,qty:1,img:'',imgs:[],specs:{},accessories:[],sparesOnly:true});
  step=2;maxReached=Math.max(maxReached,2);render();
}
function addSolution(code){
  const m=DATA.machines.find(x=>x.code===code);if(!m)return;
  const ex=S.solutions.find(s=>s.code===code);
  if(ex){ ex.qty=(ex.qty||1)+1; flash('✓ '+m.name+'  ×'+ex.qty); stepProduct(); return; }
  const specs={};SPEC_FIELDS.forEach(([k])=>{if(m[k])specs[k]=m[k];});
  const sol={code:m.code,name:m.name,desc:m.desc||'',atex:!!m.atex,unit:priceOf(m),qty:1,img:'',imgs:[],specs,accessories:[]};
  S.solutions.push(sol);
  // auto image from loaded Immagini folder (matched by code)
  const _u=imgUrlForCode(m.code);if(_u){sol.img=_u;sol.imgs=[_u];}
  flash('✓ '+m.name);
  stepProduct();
}
let _flashT;
function flash(msg,ms){let f=$('#flash');if(!f){f=ce('div');f.id='flash';f.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--navy);color:#fff;padding:10px 20px;border-radius:8px;z-index:99;font-size:13px;font-weight:600';document.body.appendChild(f);}f.textContent=msg;f.style.opacity='1';clearTimeout(_flashT);_flashT=setTimeout(()=>f.style.opacity='0',ms||1600);}

/* ============== OPTIONAL MATRIX (backend Excel: Matrice_Optional_*.xlsx) ============== */
