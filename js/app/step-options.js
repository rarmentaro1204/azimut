/* Configuratore Yacht — modulo "step-options" */
const OPT_GROUP_ORDER=['Motorizzazione','Coperta','Interni','Elettronica','Comfort','Servizi','Altro'];
// gruppi optional a tendina: chiusi di default, quelli aperti dall'utente restano aperti dopo ogni aggiornamento
const OPT_OPEN=new Set();
const INCOTERMS=['Ex Works','FAS','CIF','DAP','DDP'];   // delivery condition
let OPT_CATALOG={};      // optional code -> {group,order,desc}
let MATRIX_INFO={file:'',machines:0};
function optGroupSlug(g){return String(g||'Altro').toLowerCase().replace(/[^a-z]+/g,'_').replace(/^_|_$/g,'');}
function optGroupLabel(g){return String(g||'Altro');}   // nomi dei gruppi sempre in italiano
// one price sheet: row "Codice Macchina" = optional codes, next row "Descrizione", then one row per machine (blank cell = not available)
function parseMatrixSheet(sheet){
  const aoa=XLSX.utils.sheet_to_json(sheet,{header:1,defval:''});
  const hi=aoa.findIndex(r=>norm(r[0]).toLowerCase()==='codice macchina');if(hi<0)return null;
  const codes=aoa[hi].map(norm);
  const grpRow=(hi>0&&norm(aoa[hi-1][0]).toLowerCase()==='gruppo')?aoa[hi-1].map(norm):[];
  const di=(aoa[hi+1]&&norm(aoa[hi+1][0]).toLowerCase()==='descrizione')?hi+1:-1;
  const descs=di>=0?aoa[di].map(norm):[];
  const rows={};
  for(let i=(di>=0?di:hi)+1;i<aoa.length;i++){
    const r=aoa[i];const m=norm(r[0]);if(!m)continue;
    const o={};
    for(let j=1;j<codes.length;j++){if(!codes[j])continue;const v=r[j];if(v===''||v==null)continue;o[codes[j]]=num(v);}
    rows[m]=o;
  }
  return {codes,descs,grpRow,rows};
}
function applyMatrixWorkbook(wb,fileName){
  const find=k=>wb.SheetNames.find(n=>n.toLowerCase().includes(k));
  // listino unico: foglio "Optional_Prezzi" (compatibile con i vecchi fogli optional_l0 / optional_le)
  const sU=wb.SheetNames.find(n=>/usd/i.test(n)&&/optional/i.test(n));   // listino in dollari (foglio opzionale «Optional_Prezzi_USD»)
  const s0=wb.SheetNames.find(n=>/optional_prezzi$/i.test(n))||find('optional_l0')||find('l0'),sE=find('optional_le')||find('_le');
  const p0=s0?parseMatrixSheet(wb.Sheets[s0]):null,pE=sE?parseMatrixSheet(wb.Sheets[sE]):null,pU=sU?parseMatrixSheet(wb.Sheets[sU]):null;
  if(!p0&&!pE)return false;
  // catalogue (group / order / description per optional) + prices still to verify
  OPT_CATALOG={};
  const sC=find('catalogo');
  if(sC)sheetRows(wb.Sheets[sC],['codice']).forEach(r=>{const c=norm(r.Codice);if(c)OPT_CATALOG[c]={group:norm(r.Gruppo),order:num(r.Ordine),desc:norm(r.Descrizione),descIt:norm(r.Descrizione_IT),note:norm(r.Nota),noteIt:norm(r.Nota_IT)};});
  const CHECK=new Set();
  const sV=find('verific');
  if(sV)sheetRows(wb.Sheets[sV],['macchina']).forEach(r=>{const m=norm(r.Macchina),o=norm(r.Optional);if(m&&o)CHECK.add(m+'|'+o);});
  const hdrInfo={};
  [p0,pE,pU].forEach(p=>{if(!p)return;p.codes.forEach((c,j)=>{if(!c||j===0)return;hdrInfo[c]=hdrInfo[c]||{};if(p.descs[j]&&!hdrInfo[c].desc)hdrInfo[c].desc=p.descs[j];if(p.grpRow[j]&&!hdrInfo[c].group)hdrInfo[c].group=p.grpRow[j];});});
  const gOf=c=>{const g=(OPT_CATALOG[c]&&OPT_CATALOG[c].group)||(hdrInfo[c]&&hdrInfo[c].group)||'Altro';
    const hit=OPT_GROUP_ORDER.find(x=>x.toLowerCase()===g.toLowerCase());return hit||'Altro';};
  Object.keys(MACHINE_OPTIONALS).forEach(k=>delete MACHINE_OPTIONALS[k]);
  const machines=new Set([...Object.keys(p0?p0.rows:{}),...Object.keys(pE?pE.rows:{}),...Object.keys(pU?pU.rows:{})]);
  machines.forEach(m=>{
    const a0=(p0&&p0.rows[m])||{},aE=(pE&&pE.rows[m])||{},aU=(pU&&pU.rows[m])||{};
    const list=[...new Set([...Object.keys(a0),...Object.keys(aE),...Object.keys(aU)])].map(c=>({
      code:c,desc:(OPT_CATALOG[c]&&OPT_CATALOG[c].desc)||(hdrInfo[c]&&hdrInfo[c].desc)||'',desc_it:(OPT_CATALOG[c]&&OPT_CATALOG[c].descIt)||'',note:(OPT_CATALOG[c]&&OPT_CATALOG[c].note)||'',note_it:(OPT_CATALOG[c]&&OPT_CATALOG[c].noteIt)||'',
      l0:a0[c],le:aE[c],usd:aU[c],group:gOf(c),order:(OPT_CATALOG[c]&&OPT_CATALOG[c].order)||9999,check:CHECK.has(m+'|'+c)}));
    list.sort((x,y)=>OPT_GROUP_ORDER.indexOf(x.group)-OPT_GROUP_ORDER.indexOf(y.group)||x.order-y.order||x.code.localeCompare(y.code));
    MACHINE_OPTIONALS[m]=list;
  });
  MATRIX_INFO={file:fileName,machines:machines.size};
  return true;
}
// descrizione dell'optional nella lingua dell'offerta (il listino ufficiale è in inglese; l'italiano è la traduzione)
// gli optional restano SEMPRE in italiano (anche con l'offerta in inglese)
function optDesc(o){return o.desc_it||o.desc||'';}
function handleMatrix(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{
    try{
      const wb=XLSX.read(ev.target.result,{type:'array'});
      if(!applyMatrixWorkbook(wb,file.name)){flash(t('matrix_err'));return;}
      if($('#matTxt'))$('#matTxt').textContent='✓ '+file.name;
      flash(t('matrix_ok').replace('%n',MATRIX_INFO.machines));
      if(step===2)render();
    }catch(err){console.error(err);flash(t('matrix_err'));}
  };
  reader.readAsArrayBuffer(file);
}
/* ============== STEP 3: OPTIONS — vista laterale ============== */
// Barra delle categorie in alto, foto della barca a sinistra, elenco optional a destra (una scheda per optional con interruttore).
const OPT_GROUP_EN={Motorizzazione:'Propulsion',Coperta:'Deck',Interni:'Interior',Elettronica:'Electronics',Comfort:'Comfort',Servizi:'Services',Altro:'Other'};
const OPT_TAB={}, OPT_SEARCH={}, OPT_QTY={};   // per soluzione: categoria aperta, testo cercato, quantità scelte prima della selezione
const IMG_PH='<svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="120" height="90" fill="#e4e4e4"/><rect x="27" y="20" width="66" height="50" rx="5" fill="none" stroke="#c9c9c9" stroke-width="5"/><circle cx="44" cy="37" r="6" fill="#c9c9c9"/><path d="M31 66l20-20 12 12 9-9 17 17z" fill="#c9c9c9"/></svg>';
function listMoney(p){return (S.listino==='USD')?fmtCur(p,'USD'):money(p);}
function optSel(s,o){return s.accessories.find(a=>a.code===o.code);}
function optPriceOk(o){const p=liteP(o);return p!=null&&p!=='';}
function optGroupsOf(s){const opts=machineOptionals(s.code);return OPT_GROUP_ORDER.filter(g=>opts.some(o=>(o.group||'Altro')===g));}
function optTabOf(si){const gs=optGroupsOf(S.solutions[si]);let c=OPT_TAB[si];if(c!=='SUMMARY'&&!gs.includes(c))c=gs[0]||'SUMMARY';OPT_TAB[si]=c;return c;}
function optSolRoot(si){return document.querySelector(`[data-optsol="${si}"]`);}

function optCardHtml(si,o){
  const s=S.solutions[si],sel=optSel(s,o),ok=optPriceOk(o);
  const it=optDesc(o),en=(o.desc&&o.desc!==it)?o.desc:'';
  const img=imgUrlForCode(o.code);
  const qty=sel?sel.qty:(OPT_QTY[si+'|'+o.code]||1);
  return `<div class="ocard${sel?' sel':''}${ok?'':' na'}" data-ocard="${si}|${esc(o.code)}">
    <div class="oimg">${img?`<img src="${img}" alt="">`:IMG_PH}</div>
    <div class="otxt"><div class="oti">${esc(it||o.code)}</div>${en?`<div class="oen">${esc(en)}</div>`:''}
      <div class="ocode">${esc(o.code)}${o.check?` <span style="color:#d97706" title="${esc(t('verify_price'))}">⚠</span>`:''}${(o.note_it||o.note)?' · '+esc(o.note_it||o.note):''}</div></div>
    <div class="oside">
      <div class="opr">${ok?listMoney(liteP(o)):'<span title="'+esc(L2('Prezzo non disponibile in questo listino','Price not available in this price list'))+'">—</span>'}</div>
      <label class="oqty">${L2('Quantità','Quantity')}<input type="number" min="1" value="${qty}" data-oqty="${si}|${esc(o.code)}"></label>
      <label class="tgl"><input type="checkbox" data-otgl="${si}|${esc(o.code)}" ${sel?'checked':''} ${ok?'':'disabled'}><span></span></label>
    </div></div>`;
}
function accRowsHtml(si){
  const s=S.solutions[si];
  return s.accessories.map((a,ai)=>`<div class="accline" style="display:flex;gap:8px;align-items:center;margin-top:8px">
      <span style="position:relative;display:inline-block;width:40px;height:40px;flex:0 0 auto">
        ${a.img?`<img class="imgthumb" style="width:40px;height:40px" src="${a.img}">`:'<span class="imgthumb" style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:16px;color:#c7ccd6">+</span>'}
        <input type="file" accept="image/*" title="${esc(t('change_image'))}" data-accimgadd="${si}-${ai}" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:40px;height:40px">
        ${a.img?`<button class="xbtn" data-accimgdel="${si}-${ai}" title="${esc(t('remove_line'))}" style="position:absolute;right:-6px;top:-6px;width:16px;height:16px;min-width:0;font-size:9px;padding:0;line-height:16px;border-radius:50%">✕</button>`:''}
      </span>
      <select class="pe" data-acc="${si}-${ai}-group" title="${esc(t('opt_group'))}" style="width:118px;flex:0 0 auto;font-size:12px">${OPT_GROUP_ORDER.map(g=>`<option value="${esc(g)}"${(a.group||'Altro')===g?' selected':''}>${esc(optGroupLabel(g))}</option>`).join('')}</select>
      <div class="acc-row" style="flex:1;margin-top:0">
        <input placeholder="${t('code')}" value="${esc(a.code)}" data-acc="${si}-${ai}-code">
        <input placeholder="${t('description')}" value="${esc(accItDesc(s,a))}" data-acc="${si}-${ai}-desc">
        <input type="number" min="1" placeholder="${t('qty')}" value="${a.qty}" data-acc="${si}-${ai}-qty">
        ${(a.free||!a.code)?`<input type="number" step="0.01" placeholder="${t('unit_price')}" value="${a.price}" data-acc="${si}-${ai}-price">`:`<input type="text" class="ro" readonly tabindex="-1" title="${esc(t('price_locked'))}" value="${esc(listMoney(a.price))}">`}
        <input type="text" inputmode="decimal" placeholder="${esc(t('extra_disc_ph'))}" title="${esc(t('extra_disc_tip'))} (${esc(discLabel())})" value="${a.disc==null?'':esc(a.disc)}" data-acc="${si}-${ai}-disc">
        <button class="xbtn" data-accdel="${si}-${ai}">✕</button>
      </div></div>`).join('');
}
function optSummaryHtml(si){
  const s=S.solutions[si],spares=machineSpares(s.code);
  const sprBlock=spares.length?`<div style="margin:8px 0 4px;font-size:12px;color:#4a4a4a;font-weight:700">${t('spare_parts')} (${spares.length})</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px">${spares.map(o=>`<button class="chip" style="cursor:pointer" data-addspare="${si}|${esc(o.code)}">+ ${esc(o.code)} <span style="color:#6f6f6f;margin-left:4px">${money(liteP(o))}</span></button>`).join('')}</div>`:'';
  return `${sprBlock}<div style="font-size:12.5px;font-weight:700;color:#4a4a4a">${t('accessories')}</div>
      <div style="position:relative;margin-top:4px">
        <input class="search" style="margin:0" id="accpick-${si}" autocomplete="off" placeholder="🔎 ${esc(t('ph_acc_search'))}">
        <div id="accsugg-${si}" style="position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid var(--line);border-radius:8px;box-shadow:0 8px 20px rgba(0,0,0,.12);z-index:20;max-height:240px;overflow:auto;display:none"></div>
      </div>
      ${s.accessories.length?`<div class="acc-row acc-head" style="margin-left:174px;padding-left:0"><span>${t('code')}</span><span>${t('description')}</span><span>${t('qty')}</span><span>${t('unit_price')}</span><span>${t('discount')} %</span><span></span></div>`:`<p class="hint" style="margin:10px 0">${L2('Nessun optional selezionato.','No options selected.')}</p>`}
      ${accRowsHtml(si)}
      <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center"><button class="btn ghost sm" data-accadd="${si}" data-grp="Altro">+ ${L2('Customizzazione','Customization')}</button></div>`;
}
function optPaneHtml(si){
  const s=S.solutions[si],cur=optTabOf(si);
  if(cur==='SUMMARY')return optSummaryHtml(si);
  const opts=machineOptionals(s.code),q=String(OPT_SEARCH[si]||'').trim().toLowerCase();
  let list=q?opts.filter(o=>(o.code+' '+optDesc(o)+' '+(o.desc||'')).toLowerCase().includes(q)):opts.filter(o=>(o.group||'Altro')===cur);
  if(!list.length)return `<p class="hint" style="margin:14px 4px">${esc(t('no_results'))}</p>`;
  return list.map(o=>optCardHtml(si,o)).join('');
}
function optViewHtml(si){
  const s=S.solutions[si],cur=optTabOf(si),opts=machineOptionals(s.code),gs=optGroupsOf(s);
  const sd=lineTotals().sols[si];
  const tabs=gs.map(g=>{const n=opts.filter(o=>(o.group||'Altro')===g&&optSel(s,o)).length;
    return `<button class="otab${g===cur?' on':''}" data-otab="${si}|${esc(g)}">${esc(optGroupLabel(g))}<i data-ocnt="${esc(g)}">${n||''}</i></button>`;}).join('')
    +`<button class="otab${cur==='SUMMARY'?' on':''}" data-otab="${si}|SUMMARY">${L2('Riepilogo','Summary')}<i data-ocnt="SUMMARY">${s.accessories.length||''}</i></button>`;
  const m=!s.custom&&DATA.machines.find(x=>x.code===s.code);
  const hero=(m&&heroOf(m,s.img))||ensureImgs(s)[0]||imgUrlForCode(s.code)||'';
  const loadHint=(!MATRIX_INFO.machines&&!s.sparesOnly&&!s.custom)?`<div class="hint" style="margin:8px 0;padding:10px 12px;border:1px dashed var(--red);border-radius:8px;color:var(--red-700)">📦 ${t('load_matrix_hint')}</div>`:'';
  const none=!opts.length&&!s.custom?`<div class="hint" style="margin:8px 0;padding:10px 12px;border:1px dashed var(--line);border-radius:8px">${t('no_options_machine')}</div>`:'';
  const wide=cur==='SUMMARY';
  return `<div class="optview">${loadHint}${none}
    <div class="obar"><div class="otabs">${tabs}</div><div class="ocart" title="${esc(t('total_general'))}"><span>🛒</span><b>${sd?moneyD(sd.solTot):''}</b></div></div>
    <div class="ogrid${wide?' wide':''}">
      <div class="oleft">${hero?`<img class="ohero" src="${hero}" alt="">`:`<div class="ohero ph">${esc(s.name)}</div>`}
        <div class="oname"><b>${esc(s.name)}</b><span>${esc(s.code)}</span></div></div>
      <div class="oright">${wide?'':`<div class="osearch"><input data-osearch="${si}" placeholder="${esc(L2('Cerca optional','Search items'))}" value="${esc(OPT_SEARCH[si]||'')}" autocomplete="off"><button class="btn ghost sm" data-oall="${si}" title="${esc(t('add_all_options'))}">+ ${esc(L2('tutti','all'))}</button></div>`}
        <div class="opane">${optPaneHtml(si)}</div></div>
    </div></div>`;
}
// aggiorna totale, contatori delle schede e stato delle schede senza ridisegnare la pagina
function optRefresh(si){
  const root=optSolRoot(si);if(!root)return;
  const s=S.solutions[si],opts=machineOptionals(s.code),sd=lineTotals().sols[si];
  const cb=root.querySelector('.ocart b');if(cb&&sd)cb.textContent=moneyD(sd.solTot);
  OPT_GROUP_ORDER.forEach(g=>{const i=root.querySelector(`[data-ocnt="${g}"]`);if(i){const n=opts.filter(o=>(o.group||'Altro')===g&&optSel(s,o)).length;i.textContent=n||'';}});
  const sm=root.querySelector('[data-ocnt="SUMMARY"]');if(sm)sm.textContent=s.accessories.length||'';
}
function optToggle(si,code,on){
  const s=S.solutions[si],o=machineOptionals(s.code).find(x=>x.code===code);if(!o)return;
  const ai=s.accessories.findIndex(a=>a.code===code);
  if(!on){if(ai>=0)s.accessories.splice(ai,1);return;}
  if(ai>=0||!optPriceOk(o))return;
  const item={code:o.code,desc:optDesc(o),group:o.group||'Altro',qty:Math.max(1,+OPT_QTY[si+'|'+code]||1),price:Number(liteP(o))||0,img:''};
  s.accessories.push(item);const u=imgUrlForCode(code);if(u)item.img=u;
}
function wireOptPane(si){
  const root=optSolRoot(si);if(!root)return;
  const pane=root.querySelector('.opane');if(!pane)return;
  pane.querySelectorAll('[data-otgl]').forEach(cb=>cb.onchange=()=>{
    const[i,code]=cb.dataset.otgl.split('|');optToggle(+i,code,cb.checked);
    const card=cb.closest('.ocard');if(card)card.classList.toggle('sel',cb.checked);
    if(cb.checked){const sel=S.solutions[+i].accessories.find(a=>a.code===code);const q=card&&card.querySelector('[data-oqty]');if(sel&&q)q.value=sel.qty;}
    optRefresh(+i);});
  pane.querySelectorAll('[data-oqty]').forEach(inp=>inp.oninput=()=>{
    const[i,code]=inp.dataset.oqty.split('|');const n=Math.max(1,+inp.value||1);
    OPT_QTY[i+'|'+code]=n;const a=S.solutions[+i].accessories.find(x=>x.code===code);if(a){a.qty=n;optRefresh(+i);}});
  if(optTabOf(si)==='SUMMARY')wireAccRows(pane);
}
function optRedrawView(si){
  const root=optSolRoot(si);if(!root)return;
  const ov=root.querySelector('.optview');if(!ov)return;
  ov.outerHTML=optViewHtml(si);wireOptView(si);
}
function wireOptView(si){
  const root=optSolRoot(si);if(!root)return;
  root.querySelectorAll('[data-otab]').forEach(b=>b.onclick=()=>{const[i,g]=b.dataset.otab.split('|');OPT_TAB[+i]=g;optRedrawView(+i);});
  const sin=root.querySelector('[data-osearch]');
  if(sin)sin.oninput=e=>{OPT_SEARCH[si]=e.target.value;const p=root.querySelector('.opane');p.innerHTML=optPaneHtml(si);wireOptPane(si);};
  const all=root.querySelector('[data-oall]');
  if(all)all.onclick=()=>{
    const s=S.solutions[si],cur=optTabOf(si),q=String(OPT_SEARCH[si]||'').trim().toLowerCase();
    machineOptionals(s.code).filter(o=>q?(o.code+' '+optDesc(o)+' '+(o.desc||'')).toLowerCase().includes(q):(o.group||'Altro')===cur).forEach(o=>optToggle(si,o.code,true));
    optRedrawView(si);};
  wireOptPane(si);
}
// righe degli accessori selezionati (riepilogo): modifica, immagini, righe libere, ricerca nel catalogo
function wireAccRows(v){
  v.querySelectorAll('[data-acc]').forEach(inp=>inp.oninput=e=>{
    const[si,ai,f]=inp.dataset.acc.split('-');S.solutions[si].accessories[ai][f]=(f==='qty'||f==='price')?+e.target.value:(f==='disc'?(e.target.value.trim()===''?null:e.target.value.trim()):e.target.value);optRefresh(+si);});
  v.querySelectorAll('[data-accadd]').forEach(b=>b.onclick=()=>{S.solutions[+b.dataset.accadd].accessories.push({code:'',desc:'',group:b.dataset.grp||'Altro',free:true,qty:1,price:0,img:''});stepOptions();});
  v.querySelectorAll('[data-accdel]').forEach(b=>b.onclick=()=>{const[si,ai]=b.dataset.accdel.split('-');S.solutions[si].accessories.splice(ai,1);stepOptions();});
  v.querySelectorAll('[data-addspare]').forEach(b=>b.onclick=()=>{
    const[si,code]=b.dataset.addspare.split('|');const o=machineSpares(S.solutions[si].code).find(x=>x.code===code);if(o)addItem(+si,o);});
  v.querySelectorAll('[data-accimgadd]').forEach(inp=>inp.onchange=e=>{
    const[si,ai]=inp.dataset.accimgadd.split('-').map(Number);const file=e.target.files[0];if(!file)return;
    const r=new FileReader();r.onload=ev=>{S.solutions[si].accessories[ai].img=ev.target.result;stepOptions();};r.readAsDataURL(file);});
  v.querySelectorAll('[data-accimgdel]').forEach(b=>b.onclick=e=>{e.stopPropagation();e.preventDefault();
    const[si,ai]=b.dataset.accimgdel.split('-').map(Number);S.solutions[si].accessories[ai].img='';stepOptions();});
  S.solutions.forEach((s,si)=>{
    const inp=v.querySelector('#accpick-'+si),sg=v.querySelector('#accsugg-'+si);if(!inp)return;
    function show(){
      const q=inp.value.trim().toLowerCase();
      let list=DATA.accessories;
      if(q)list=list.filter(a=>(a.code+' '+a.desc).toLowerCase().includes(q));
      list=list.slice(0,60);
      if(!list.length){sg.style.display='none';return;}
      sg.innerHTML=list.map(a=>`<div data-code="${esc(a.code)}" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #f0f2f5;font-size:12.5px;display:flex;justify-content:space-between;gap:10px">
        <span><b>${esc(a.code)}</b> · ${esc(a.desc)}</span><span style="color:#2b2b2b;white-space:nowrap">${money(a.price)}</span></div>`).join('');
      sg.style.display='block';
      sg.querySelectorAll('[data-code]').forEach(d=>d.onmousedown=ev=>{ev.preventDefault();
        const acc=DATA.accessories.find(a=>a.code===d.dataset.code);if(!acc)return;
        const item={code:acc.code,desc:acc.desc||'',group:acc.group||'Altro',qty:1,price:acc.price||0,img:''};
        s.accessories.push(item);const _u=imgUrlForCode(acc.code);if(_u)item.img=_u;stepOptions();});
    }
    inp.oninput=show;inp.onfocus=show;
    inp.onblur=()=>setTimeout(()=>{if(sg)sg.style.display='none';},150);
  });
}
function stepOptions(){
  const v=$('#view');
  if(!S.solutions.length){v.innerHTML=`<div class="card"><h2>${t('step_options')}</h2><p class="hint">${t('add_product_first')}</p></div>`;return;}
  const LT=lineTotals();
  const solHtml=S.solutions.map((s,si)=>{
    const imgs=ensureImgs(s);
    const editor=s.sparesOnly?`<div style="margin:8px 0;display:grid;grid-template-columns:1fr;gap:6px">
        <input class="pe" data-sol="${si}-name" value="${esc(s.name)}" placeholder="${t('spares_sale_title')}">
        <textarea class="pe" data-sol="${si}-desc" placeholder="${t('spares_sale_desc_ph')}" style="min-height:56px">${esc(s.desc||'')}</textarea>
      </div>`:!s.custom?'':`<details class="prodedit" open style="margin:8px 0">
      <summary style="cursor:pointer;font-size:12px;color:#4a4a4a;font-weight:700">✏️ ${t('edit_product')}</summary>
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr .8fr;gap:6px;margin-top:8px;align-items:end">
        <label class="fl">${t('machine_name')}<input class="pe" data-sol="${si}-name" value="${esc(s.name)}" placeholder="${t('new_machine')}"></label>
        <label class="fl">${t('code')}<input class="pe" data-sol="${si}-code" value="${esc(s.code)}" placeholder="${t('code')}"></label>
        <label class="fl">${t('unit_price')}<input class="pe" type="number" step="0.01" data-sol="${si}-unit" value="${s.unit}" placeholder="${t('unit_price')}"></label>
        <label class="fl">${t('discount')} % ${t('machine_disc_sfx')}<input class="pe" type="text" inputmode="decimal" data-sol="${si}-disc" value="${s.disc==null?'':esc(s.disc)}" placeholder="${esc(t('extra_disc_ph'))}" title="${esc(t('extra_disc_tip'))} (${esc(discLabel())})"></label>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:6px">
        ${SPEC_FIELDS.map(([k])=>`<label class="fl">${t('spec_'+k)}<input class="pe" data-solspec="${si}-${k}" value="${esc(s.specs[k]||'')}" placeholder="${t('spec_'+k)}"></label>`).join('')}
      </div>
    </details>`;
    return `<div class="sol" data-optsol="${si}">
      <div class="head"><div><div class="nm">${solLabel(LT.sols[si])} — ${esc(s.name)}${s.sparesOnly?` <span class="badge" style="background:#4a4a4a">${t('spares_sale_badge')}</span>`:''}</div>
      ${s.sparesOnly?'':`<div class="cd">${esc(s.code)}</div>`}</div>${mvBtns(si)}</div>
      ${si>0?`<label style="display:flex;align-items:center;gap:8px;margin:8px 0 2px;padding:8px 10px;border:1px dashed var(--line);border-radius:8px;font-size:12.5px;font-weight:600;cursor:pointer;background:${s.sameOrder?'#eaf6ef':'transparent'}">
        <input type="checkbox" data-sameorder="${si}" ${s.sameOrder?'checked':''}> ${t('same_order_chk')}</label>`:''}
      ${editor}
      ${(s.sparesOnly||!s.custom)?'':`<div class="addbar" style="flex-wrap:wrap;gap:10px">
        <label class="btn ghost sm" style="display:inline-flex;align-items:center">${t('add_image')}
          <input type="file" accept="image/*" multiple style="display:none" data-imgadd="${si}"></label>
        ${imgs.map((u,ii)=>`<span style="position:relative;display:inline-block">
          <img class="imgthumb" src="${u}"${ii===0?' style="outline:2px solid var(--red);outline-offset:1px"':''}>
          ${ii!==0?`<button class="xbtn" data-imgmain="${si}-${ii}" title="Imposta come principale" style="position:absolute;left:-7px;top:-7px;background:#4a4a4a">★</button>`:''}
          <button class="xbtn" data-imgdel="${si}-${ii}" title="Rimuovi" style="position:absolute;right:-7px;top:-7px">✕</button>
        </span>`).join('')}
      </div>`}
      ${s.sparesOnly?`<div style="margin-top:10px">${optSummaryHtml(si)}</div>`:optViewHtml(si)}
    </div>`;
  }).join('');
  v.innerHTML=`
  <div class="card"><h2>${t('step_options')}</h2><p class="hint">${t('hint_options')}</p>${solHtml}</div>
  <div class="card"><h2>${t('commercial_terms')}</h2>
    <div class="grid g3">
      <label class="fld">${t('discount')} % (1°+2°+3°)
        <div style="display:flex;gap:6px;align-items:center">
          <input type="number" id="o_disc" value="${S.discount}" style="flex:1">
          <span style="color:#8592a8">+</span>
          <input type="number" id="o_disc2" value="${S.discount2||''}" placeholder="0" style="flex:1">
          <span style="color:#8592a8">+</span>
          <input type="number" id="o_disc3" value="${S.discount3||''}" placeholder="0" style="flex:1">
        </div>
      </label>
      <label class="fld">${t('sc_validity')}<input id="o_val" value="${esc(S.validity)}"></label>
      <label class="fld">${t('sc_lead')}<input id="o_lead" value="${esc(S.lead)}"></label>
      <label class="fld">${t('sc_incoterm')}<select id="o_inc">${INCOTERMS.map(x=>`<option value="${x}"${(S.incoterm||INCOTERMS[0])===x?' selected':''}>${x}</option>`).join('')}</select></label>
      <label class="fld">${t('sc_payment')}<input id="o_pay" value="${esc(S.payment)}" placeholder="${esc(t('def_payment'))}"></label>
    </div>
    <label class="fld" style="margin-top:14px">${t('exclusions')}
      <textarea id="o_excl" placeholder="${esc(t('def_exclusions'))}">${esc(S.exclusions)}</textarea></label>
    <label class="fld" style="margin-top:14px">${t('notes')}<textarea id="o_notes">${esc(S.notes)}</textarea></label>
  </div>${selectedDrawer()}`;
  wireDrawer();
  $('#o_disc').oninput=e=>{S.discount=Math.max(0,Math.min(100,+e.target.value||0));};
  $('#o_disc2').oninput=e=>{S.discount2=Math.max(0,Math.min(100,+e.target.value||0));};
  $('#o_disc3').oninput=e=>{S.discount3=Math.max(0,Math.min(100,+e.target.value||0));};
  const bind=(id,k)=>{$('#'+id).oninput=e=>S[k]=e.target.value;};
  bind('o_val','validity');bind('o_lead','lead');
  $('#o_inc').onchange=e=>{S.incoterm=e.target.value;};
  bind('o_pay','payment');bind('o_excl','exclusions');bind('o_notes','notes');
  wireMove(v);
  v.querySelectorAll('[data-sameorder]').forEach(inp=>inp.onchange=e=>{S.solutions[+inp.dataset.sameorder].sameOrder=e.target.checked;stepOptions();});
  v.querySelectorAll('[data-sol]').forEach(inp=>inp.oninput=e=>{
    const p=inp.dataset.sol.split('-');const si=+p[0];const f=p[1];const s=S.solutions[si];
    if(f==='name')s.name=e.target.value;else if(f==='code')s.code=e.target.value;
    else if(f==='unit')s.unit=+e.target.value||0;else if(f==='atex')s.atex=e.target.checked;
    else if(f==='desc')s.desc=e.target.value;
    else if(f==='disc')s.disc=(e.target.value.trim()===''?null:e.target.value.trim());});
  v.querySelectorAll('[data-solspec]').forEach(inp=>inp.oninput=e=>{
    const p=inp.dataset.solspec.split('-');S.solutions[+p[0]].specs[p[1]]=e.target.value;});
  S.solutions.forEach((s,si)=>{if(s.sparesOnly)wireAccRows(optSolRoot(si));else wireOptView(si);});
  v.querySelectorAll('[data-imgadd]').forEach(inp=>inp.onchange=e=>{
    const si=+inp.dataset.imgadd;const files=[...e.target.files];if(!files.length)return;
    let pending=files.length;const urls=[];
    files.forEach((file,idx)=>{const r=new FileReader();
      r.onload=ev=>{urls[idx]=ev.target.result;if(--pending===0){addSolImages(si,urls);stepOptions();}};
      r.onerror=()=>{if(--pending===0){addSolImages(si,urls);stepOptions();}};
      r.readAsDataURL(file);});});
  v.querySelectorAll('[data-imgdel]').forEach(b=>b.onclick=()=>{const[si,ii]=b.dataset.imgdel.split('-').map(Number);
    const s=S.solutions[si];ensureImgs(s);s.imgs.splice(ii,1);s.img=s.imgs[0]||'';stepOptions();});
  v.querySelectorAll('[data-imgmain]').forEach(b=>b.onclick=()=>{const[si,ii]=b.dataset.imgmain.split('-').map(Number);
    const s=S.solutions[si];ensureImgs(s);const[m]=s.imgs.splice(ii,1);s.imgs.unshift(m);s.img=s.imgs[0]||'';stepOptions();});
}
