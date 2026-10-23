/* Configuratore Yacht — modulo "quote-pages": pagine barca e optional del documento, impaginate come il listino Azimut
   (copertina modello con «Caratteristiche principali», poi gli optional per categoria: codice, descrizione, prezzo, immagine). */
const PG_LIMIT=224, PG_HEAD=17, PG_ROW=27, PG_TOT=92;   // mm: spazio utile di una pagina dopo il logo · titolo categoria · riga optional · blocco totali
// descrizione inglese originale del listino (la riga in italiano resta quella principale)
function accEnDesc(s,a){
  if(a.free||!a.code)return '';
  const lists=[typeof machineOptionals==='function'?machineOptionals(s.code):[],...Object.values(MACHINE_OPTIONALS||{})];
  for(const l of lists){const o=(l||[]).find(x=>x.code===a.code);if(o)return o.desc||'';}
  return '';
}
function docSym(){return curInfo(docCur())[1];}
function pgGroupHead(g){return `<div class="op-h"><span class="it">${esc(optGroupLabel(g)).toUpperCase()}</span>&nbsp;/&nbsp;<span class="en">${esc(OPT_GROUP_EN[g]||g).toUpperCase()}</span></div>`;}
function pgRow(r){
  const disc=r.disc&&r.disc!=='0';
  const en=(r.descEn&&r.descEn!==r.desc)?r.descEn:'';
  return `<div class="op-row"><div class="op-t"><b class="op-code">${esc(r.code)}</b><span class="op-d1">${esc(r.desc||'')}</span>${en?`<span class="op-d2">${esc(en)}</span>`:''}</div>
    <div class="op-pr"><b>${moneyD(r.total)}</b>${disc?`<s>${moneyD(r.partial)}</s>`:''}${r.qty>1?`<em>× ${r.qty}</em>`:''}</div>
    <div class="op-img">${r.img?`<img src="${r.img}" alt="">`:IMG_PH}</div></div>`;
}
function pgTotals(sd,pk,showPkg){
  const boat=sd.rows[0],opt=sd.rows.slice(1).reduce((x,r)=>x+r.partial,0);   // a listino: lo sconto si vede nella riga dedicata
  const hasDisc=sd.listTot-sd.solTot>0.005;
  const row=(lbl,val,strong)=>`<div class="tt-row${strong?' strong':''}"><span>${lbl}</span><span>${val}</span></div>`;
  let h='<div class="tt-box">'+row(L2('PREZZO BARCA','BOAT PRICE'),moneyD(boat?boat.partial:0))+row(L2('TOTALE OPTIONAL','TOTAL OF OPTIONALS'),moneyD(opt));
  if(hasDisc)h+=row(L2('SCONTO APPLICATO','DISCOUNT APPLIED'),'−'+moneyD(sd.listTot-sd.solTot));
  h+=row(L2('TOTALE','TOTAL'),moneyD(sd.solTot))+row(L2('IVA (0 %)','VAT (0 %)'),L2('esclusa','excluded'))+row(L2('PREZZO FINALE','FINAL PRICE'),moneyD(sd.solTot),true)+'</div>';
  if(showPkg&&pk.members.length>1)h+=`<div class="tt-box pkg">${row(`${t('order_total')} ${sd.pkg} (${pk.members.map((_,k)=>sd.pkg+String.fromCharCode(65+k)).join(' + ')})`,moneyD(pk.net),true)}</div>`;
  return h;
}
function solutionPagesHtml(sd,pk,isPkgLast,label){
  const {s,rows}=sd;
  const m=!s.custom&&DATA.machines.find(x=>x.code===s.code);
  const hero=(m&&heroOf(m,s.img))||s.img||'';
  const sp=effSpecs(s),boat=rows[0];
  const lbl2=(it,en)=>`<b>${en}</b><i>${it}</i>`;
  const ovRows=[['Motorizzazione kw/mhp','Engines kw/mhp',sp.engine],['Velocità max/crociera','Speed top/cruise',sp.speed],['Lunghezza f.t.','Length overall',sp.loa],['Larghezza max','Max beam',sp.beam],['Cabine','Cabins',sp.cabins]]
    .filter(r=>r[2]!=null&&String(r[2]).trim()!=='')
    .map(r=>`<div class="ov-row"><div class="ov-l">${lbl2(r[0],r[1])}</div><div class="ov-v">${esc(locSpec(r[2]))}</div></div>`).join('')
    +`<div class="ov-row"><div class="ov-l">${lbl2('Prezzi ('+docSym()+')','Prices ('+docSym()+')')}</div><div class="ov-v">${moneyD(boat?boat.partial:0)}</div></div>`;
  const head=`<div class="plogo">${logoLight(30)}</div>`;
  let html=`<div class="page"><div class="pad">${head}
    <div class="sl-eyebrow">${label}</div>
    <div class="sl-title">${esc(s.name)}</div>
    ${hero?`<img class="ov-hero" src="${hero}" alt="">`:''}
    <div class="op-h ov-h"><span class="en">OVERALL CHARACTERISTICS</span>&nbsp;/&nbsp;<span class="it">CARATTERISTICHE PRINCIPALI</span></div>
    <div class="ov-tbl">${ovRows}</div>
    ${footer()}</div></div>`;
  // optional per categoria, in ordine di gruppo; le pagine si riempiono a righe di altezza fissa
  const opts=rows.slice(1);
  const items=[];
  OPT_GROUP_ORDER.forEach(g=>{const rs=opts.filter(r=>(r.group||'Altro')===g);if(rs.length){items.push({h:g});rs.forEach(r=>items.push({r}));}});
  opts.filter(r=>!OPT_GROUP_ORDER.includes(r.group||'Altro')).forEach(r=>items.push({r}));
  const pages=[];let cur=[],used=0;
  const flush=()=>{pages.push(cur);cur=[];used=0;};
  items.forEach((it,i)=>{
    const need=it.h?PG_HEAD+PG_ROW:PG_ROW;                 // un titolo non resta mai solo in fondo alla pagina
    if(used+need>PG_LIMIT&&cur.length)flush();
    cur.push(it);used+=it.h?PG_HEAD:PG_ROW;
  });
  if(cur.length&&used+PG_TOT>PG_LIMIT)flush();            // i totali non entrano: pagina nuova
  const body=its=>its.map(it=>it.h?pgGroupHead(it.h):pgRow(it.r)).join('');
  const last=cur;                                          // l'ultima pagina porta anche i totali
  pages.forEach(p=>{html+=`<div class="page"><div class="pad">${head}<div class="sl-eyebrow">${label}</div>${body(p)}${footer()}</div></div>`;});
  html+=`<div class="page"><div class="pad">${head}<div class="sl-eyebrow">${label}</div>${body(last)}${pgTotals(sd,pk,isPkgLast)}${footer()}</div></div>`;
  return html;
}
