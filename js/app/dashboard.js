/* Configuratore Yacht — modulo "dashboard"
   Statistiche per commerciale: offerte mese per mese e totale anno (numero e valore), esito (vinta/persa),
   analisi vinte vs offerte, statistiche macchine offerte e vendute.
   Dati: REGISTRY.rows (registro offerte). Ogni riga: {prog,num,date,client,rep,total,machine,status,outcomeDate,wonValue,lines[]}
   status: 'open' | 'won' | 'lost'.  lines: [{code,name,category,qty,value,pkg,won}] una per macchina offerta. */
let DASH=false, dashYear=null, dashRep='';
const DEMO={on:false};   // (non più usato: vedi offerte demo persistenti in fondo al file)
const DSH={
 it:{title:'Dashboard commerciale',year:'Anno',rep:'Commerciale',all:'Tutti i commerciali',back:'← Torna al configuratore',
   export:'⬇ Esporta registro',nodata:'Nessuna offerta registrata per questo periodo. Le offerte compaiono qui quando premi «Salva offerta» nel passo Offerta.',
   offers:'Offerte',offered:'Valore offerto',won:'Vinte',wonVal:'Valore vinto',lost:'Perse',open:'Aperte',
   winN:'Tasso di vittoria (numero)',winV:'Tasso di vittoria (valore)',byRep:'Commerciale per commerciale',
   monthly:'Mese per mese',month:'Mese',count:'N. offerte',value:'Valore offerto',wonCount:'N. vinte',wonValue:'Valore vinto',rate:'% vinte (n.)',rateV:'% vinte (valore)',
   yearTot:'Totale anno',compare:'Offerte vs vinte',byNumber:'Per numero',byValue:'Per valore',
   mOffered:'Imbarcazioni offerte',mSold:'Imbarcazioni vendute',machine:'Imbarcazione',times:'Volte offerta',qty:'Unità',valueL:'Valore',
   sold:'Vendute',cat:'Per categoria',list:'Elenco offerte e esito',num:'Offerta',date:'Data',client:'Cliente',status:'Esito',wonQ:'Valore vinto (€)',
   lines:'Imbarcazioni vendute',sOpen:'Aperta',sWon:'Vinta',sLost:'Persa',monthNames:['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'],
   hintStatus:'Segna l’esito: Vinta o Persa. Se vinta, indica quali imbarcazioni sono state vendute.',saved:'Esito salvato',savedLocal:'Esito salvato (solo su questo browser: collega la cartella per scriverlo nel registro condiviso)',
   none:'—',noSold:'Nessuna imbarcazione ancora segnata come venduta.',noOff:'Nessuna imbarcazione offerta.',allMachines:'Tutte',
   expTitle:'Scadenze offerte',expNext:'Prossima scadenza',expIn:'scade tra',expNone:'Nessuna offerta aperta con scadenza.',expExpired:'Scadute',expActive:'In scadenza (in ordine di scadenza)',
   expDate:'Scade il',expLeft:'Tempo rimasto',expAgo:'scaduta da',expDays:'g',expToday:'scade oggi',expHint:'Solo offerte aperte. Clic su una riga per richiamare l\u2019offerta.',expEmpty:'Nessuna',expOpenN:'offerte aperte'},
 en:{title:'Sales dashboard',year:'Year',rep:'Salesperson',all:'All salespeople',back:'← Back to configurator',
   export:'⬇ Export register',nodata:'No offers registered for this period. Offers appear here when you press “Save offer” in the Offer step.',
   offers:'Offers',offered:'Offered value',won:'Won',wonVal:'Won value',lost:'Lost',open:'Open',
   winN:'Win rate (count)',winV:'Win rate (value)',byRep:'Salesperson by salesperson',
   monthly:'Month by month',month:'Month',count:'Offers',value:'Offered value',wonCount:'Won',wonValue:'Won value',rate:'Win % (count)',rateV:'Win % (value)',
   yearTot:'Year total',compare:'Offers vs won',byNumber:'By count',byValue:'By value',
   mOffered:'Boats offered',mSold:'Boats sold',machine:'Boat',times:'Times offered',qty:'Units',valueL:'Value',
   sold:'Sold',cat:'By category',list:'Offers and outcome',num:'Offer',date:'Date',client:'Customer',status:'Outcome',wonQ:'Won value (€)',
   lines:'Boats sold',sOpen:'Open',sWon:'Won',sLost:'Lost',monthNames:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
   hintStatus:'Mark the outcome: Won or Lost. If won, tick which boats were sold.',saved:'Outcome saved',savedLocal:'Outcome saved (this browser only: link the folder to write it to the shared register)',
   none:'—',noSold:'No boat marked as sold yet.',noOff:'No boats offered.',allMachines:'All',
   expTitle:'Offer expiry',expNext:'Next expiry',expIn:'expires in',expNone:'No open offer with an expiry date.',expExpired:'Expired',expActive:'Expiring (by expiry date)',
   expDate:'Expires on',expLeft:'Time left',expAgo:'expired',expDays:'d',expToday:'expires today',expHint:'Open offers only. Click a row to recall the offer.',expEmpty:'None',expOpenN:'open offers'}
};
function dt(k){return (DSH[LANG==='it'?'it':'en'])[k]||k;}

/* ---------- parsing / modello dati ---------- */
function parseOfferDate(v){
  if(v==null||v==='')return null;
  if(v instanceof Date)return v;
  if(typeof v==='number'&&v>20000){return new Date(Math.round((v-25569)*86400*1000));}   // seriale Excel
  const s=String(v).trim();let m;
  if((m=s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/))){let y=+m[3];if(y<100)y+=2000;return new Date(y,+m[2]-1,+m[1]);}
  if((m=s.match(/^(\d{4})-(\d{2})-(\d{2})/)))return new Date(+m[1],+m[2]-1,+m[3]);
  const d=new Date(s);return isNaN(d)?null:d;
}
function rowStatus(r){const s=String(r.status||'').toLowerCase();
  if(/^(won|vint)/.test(s))return 'won';if(/^(lost|pers)/.test(s))return 'lost';return 'open';}
function rowLines(r){
  if(Array.isArray(r.lines)&&r.lines.length)return r.lines;
  // registri vecchi: ricava le macchine dal testo "CODICE (Nome) x2 | ..."
  return String(r.machine||'').split(' | ').map(x=>x.trim()).filter(Boolean).map((x,i)=>{
    const m=x.match(/^(.*?)\s*\((.*)\)(?:\s*x(\d+))?$/);
    return m?{code:m[1].trim(),name:m[2].trim(),category:'',qty:+(m[3]||1),value:null,pkg:i+1,won:false}:{code:x,name:x,category:'',qty:1,value:null,pkg:i+1,won:false};
  });
}
function rowWonValue(r){
  if(rowStatus(r)!=='won')return 0;
  if(r.wonValue!==undefined&&r.wonValue!==null&&r.wonValue!=='')return Number(r.wonValue)||0;
  return Number(r.total)||0;
}
function offerLinesFromState(){
  // una riga per macchina offerta (le alternative sono tutte "offerte"; il commerciale segna quale è stata venduta)
  const {sols}=lineTotals();
  return sols.filter(sd=>!sd.s.sparesOnly).map(sd=>{
    const m=(DATA.machines||[]).find(x=>x.code===sd.s.code);
    return {code:sd.s.code||'',name:sd.s.name||'',category:(m&&m.category)||(sd.s.custom?'Fuori catalogo':''),
      qty:sd.s.qty||1,value:Number(sd.solTot.toFixed(2)),pkg:sd.pkg,won:false};
  });
}
const REG_LS='yacht_registry_v1';
function persistRegistryLocal(){if(typeof DEMO!=='undefined'&&DEMO.on)return;try{localStorage.setItem(REG_LS,JSON.stringify(REGISTRY.rows));}catch(_){}}
function loadRegistryLocal(){try{const a=JSON.parse(localStorage.getItem(REG_LS)||'[]');if(Array.isArray(a)&&a.length&&!REGISTRY.rows.length)REGISTRY.rows=a;}catch(_){}}

/* ---------- aggregazioni ---------- */
function dashRows(){
  return offerRows().filter(r=>{
    const d=parseOfferDate(r.date);
    if(!d||d.getFullYear()!==dashYear)return false;
    if(dashRep&&String(r.rep).trim()!==dashRep)return false;
    return true;
  });
}
function statsOf(rows){
  const s={n:0,v:0,wn:0,wv:0,ln:0,lv:0,on:0,ov:0};
  rows.forEach(r=>{const v=Number(r.total)||0;s.n++;s.v+=v;const st=rowStatus(r);
    if(st==='won'){s.wn++;s.wv+=rowWonValue(r);}else if(st==='lost'){s.ln++;s.lv+=v;}else{s.on++;s.ov+=v;}});
  return s;
}
const pct=(a,b)=>b>0?Math.round(a/b*100)+'%':'—';
function machineStats(rows){
  const off={},sold={},cat={};
  rows.forEach(r=>{
    const won=rowStatus(r)==='won';
    rowLines(r).forEach(l=>{
      const k=l.code||l.name;const q=Number(l.qty)||1,v=Number(l.value)||0,c=l.category||'—';
      const o=off[k]||(off[k]={code:l.code,name:l.name,times:0,qty:0,value:0,category:c});o.times++;o.qty+=q;o.value+=v;
      const cc=cat[c]||(cat[c]={off:0,sold:0,offV:0,soldV:0});cc.off+=q;cc.offV+=v;
      if(won&&l.won){const so=sold[k]||(sold[k]={code:l.code,name:l.name,times:0,qty:0,value:0,category:c});so.times++;so.qty+=q;so.value+=v;cc.sold+=q;cc.soldV+=v;}
    });
  });
  const arr=o=>Object.values(o).sort((a,b)=>b.times-a.times||b.value-a.value);
  return {off:arr(off),sold:arr(sold),cat};
}

function langBadge(r){const l=(r.lang||'it').toUpperCase();return `<span class="badge code" title="Lingua dell'offerta">${l}</span>`;}

/* ---------- scadenze ---------- */
function offerExpiry(r){
  const d=parseOfferDate(r.date);if(!d)return null;
  const days=parseInt(String(r.validity==null||r.validity===''?60:r.validity).replace(/[^\d]/g,''),10);
  const e=new Date(d.getFullYear(),d.getMonth(),d.getDate()+(isNaN(days)?60:days),23,59,59);
  return e;
}
function fmtCountdown(ms){
  const neg=ms<0;ms=Math.abs(ms);
  const d=Math.floor(ms/86400000),h=Math.floor(ms%86400000/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000);
  const p=n=>String(n).padStart(2,'0');
  return {neg,d,txt:`${d}${dt('expDays')} ${p(h)}:${p(m)}:${p(s)}`};
}
function expiryScope(){
  return offerRows().filter(r=>rowStatus(r)==='open'&&(!dashRep||String(r.rep).trim()===dashRep)&&offerExpiry(r))
    .map(r=>({r,exp:offerExpiry(r)})).sort((a,b)=>a.exp-b.exp);
}
function expirySection(){
  const now=Date.now();
  const all=expiryScope();
  const expired=all.filter(x=>x.exp<now);
  const active=all.filter(x=>x.exp>=now);
  const next=active[0];
  const lab=x=>{const idx=REGISTRY.rows.indexOf(x.r);
    const left=x.exp-now;const c=fmtCountdown(left);
    const tone=left<0?'#8c1412':(left<7*86400000?'#b35c00':'var(--navy)');
    return `<tr data-expidx="${idx}" style="cursor:pointer"><td><b>${esc(x.r.num)}</b> ${langBadge(x.r)}${x.r.demo?' <span class="badge" style="background:#FFD017;color:#171717">DEMO</span>':''}</td><td>${esc(x.r.client)}</td>${dashRep?'':`<td>${esc(x.r.rep)}</td>`}<td class="r">${money(x.r.total)}</td><td>${x.exp.toLocaleDateString('it-IT')}</td>
      <td class="r" style="font-weight:800;color:${tone}" data-cd="${x.exp.getTime()}">${left<0?dt('expAgo')+' ':''}${c.txt}</td></tr>`;};
  const head=`<tr><th>${dt('num')}</th><th>${dt('client')}</th>${dashRep?'':`<th>${dt('rep')}</th>`}<th class="r">${dt('value')}</th><th>${dt('expDate')}</th><th class="r">${dt('expLeft')}</th></tr>`;
  const tbl=(rows,empty)=>rows.length?`<div style="overflow:auto"><table class="ptable" style="font-size:13px">${head}${rows.map(lab).join('')}</table></div>`:`<p class="hint" style="margin:6px 0">${empty}</p>`;
  const big=next?`<div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center;border:1px solid var(--line);border-radius:12px;padding:16px 18px;background:var(--navy);color:#fff;margin-bottom:14px">
      <div style="flex:1;min-width:220px"><div style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#FFD017">${dt('expNext')}</div>
      <div style="font-size:16px;margin-top:2px"><b>${esc(next.r.num)}</b> · ${esc(next.r.client)}${dashRep?'':' · '+esc(next.r.rep)}</div>
      <div style="font-size:12.5px;color:#bdbdbd">${dt('expDate')} ${next.exp.toLocaleDateString('it-IT')} · ${money(next.r.total)}</div></div>
      <div style="font-size:34px;font-weight:900;letter-spacing:.5px;font-variant-numeric:tabular-nums" id="expBig" data-cd="${next.exp.getTime()}">${fmtCountdown(next.exp-now).txt}</div></div>`
    :`<p class="hint">${dt('expNone')}</p>`;
  return `<div class="card"><h2>${dt('expTitle')} <span style="font-size:15px;color:var(--muted)">· ${all.length} ${dt('expOpenN')}</span></h2>
    <p class="hint" style="margin-bottom:12px">${dt('expHint')}</p>${big}
    <h3 style="margin:10px 0 6px;font-size:15px;color:#8c1412">${dt('expExpired')} (${expired.length})</h3>${tbl(expired,dt('expEmpty'))}
    <h3 style="margin:16px 0 6px;font-size:15px;color:var(--navy)">${dt('expActive')} (${active.length})</h3>${tbl(active,dt('expEmpty'))}</div>`;
}
let _dashTimer=null;
function startCountdown(){
  if(_dashTimer)clearInterval(_dashTimer);
  _dashTimer=setInterval(()=>{
    if(!DASH||!document.querySelector('[data-cd]')){clearInterval(_dashTimer);_dashTimer=null;return;}
    const now=Date.now();
    document.querySelectorAll('[data-cd]').forEach(el=>{
      const ms=+el.dataset.cd-now,c=fmtCountdown(ms);
      el.textContent=(ms<0&&el.tagName==='TD'?dt('expAgo')+' ':'')+c.txt;
    });
  },1000);
}

/* ---------- render ---------- */
function barPair(label,a,b,aLab,bLab,fmt){
  const max=Math.max(a,b,1);
  return `<div style="margin:12px 0"><div style="font-weight:700;color:var(--navy);margin-bottom:6px">${esc(label)}</div>
    <div style="display:flex;align-items:center;gap:8px;margin:3px 0"><span style="width:90px;font-size:12px;color:var(--muted)">${esc(aLab)}</span><div style="flex:1;background:var(--soft);border-radius:4px"><div style="width:${a/max*100}%;background:var(--navy);height:20px;border-radius:4px"></div></div><b style="min-width:110px;text-align:right">${fmt(a)}</b></div>
    <div style="display:flex;align-items:center;gap:8px;margin:3px 0"><span style="width:90px;font-size:12px;color:var(--muted)">${esc(bLab)}</span><div style="flex:1;background:var(--soft);border-radius:4px"><div style="width:${b/max*100}%;background:var(--red);height:20px;border-radius:4px"></div></div><b style="min-width:110px;text-align:right">${fmt(b)}</b></div></div>`;
}
function monthlyChart(months){
  const W=900,H=220,pad=34,bw=(W-pad*2)/12;
  const max=Math.max(1,...months.map(m=>Math.max(m.v,m.wv)));
  let g='';
  months.forEach((m,i)=>{
    const x=pad+i*bw, h1=(m.v/max)*(H-60), h2=(m.wv/max)*(H-60);
    g+=`<rect x="${x+6}" y="${H-30-h1}" width="${bw/2-8}" height="${h1}" fill="#171717"><title>${money(m.v)}</title></rect>`;
    g+=`<rect x="${x+bw/2}" y="${H-30-h2}" width="${bw/2-8}" height="${h2}" fill="#AA1917"><title>${money(m.wv)}</title></rect>`;
    g+=`<text x="${x+bw/2}" y="${H-12}" text-anchor="middle" font-size="12" fill="#6f6f6f">${dt('monthNames')[i]}</text>`;
    if(m.n)g+=`<text x="${x+bw/2}" y="${H-34-Math.max(h1,h2)}" text-anchor="middle" font-size="11" font-weight="700" fill="#171717">${m.n}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">${g}</svg>
    <div style="font-size:12px;color:var(--muted);margin-top:4px"><span style="display:inline-block;width:10px;height:10px;background:#171717;margin-right:4px"></span>${dt('offered')} &nbsp; <span style="display:inline-block;width:10px;height:10px;background:#AA1917;margin-right:4px"></span>${dt('wonVal')} &nbsp; (${dt('count')})</div>`;
}
function renderDashboard(){
  const v=$('#view');
  loadRegistryLocal();
  ensureDemoSeed();
  const years=[...new Set(offerRows().map(r=>{const d=parseOfferDate(r.date);return d?d.getFullYear():null;}).filter(Boolean))].sort((a,b)=>b-a);
  const cur=new Date().getFullYear();
  if(!years.includes(cur))years.unshift(cur);
  if(dashYear==null||!years.includes(dashYear))dashYear=years.includes(cur)?cur:years[0];
  const reps=[...new Set(offerRows().map(r=>String(r.rep||'').trim()).filter(Boolean))].sort();
  if(dashRep&&!reps.includes(dashRep))dashRep='';
  const rows=dashRows();
  const st=statsOf(rows);
  const head=`<div class="card">
    <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between">
      <h2 style="margin:0">${dt('title')}</h2>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
        <label class="fld" style="min-width:110px">${dt('year')}<select id="d_year">${years.map(y=>`<option${y===dashYear?' selected':''}>${y}</option>`).join('')}</select></label>
        <label class="fld" style="min-width:220px">${dt('rep')}<select id="d_rep"><option value="">${dt('all')}</option>${reps.map(r=>`<option${r===dashRep?' selected':''}>${esc(r)}</option>`).join('')}</select></label>
        ${hasDemoRows()?`<button class="btn sm" id="d_demoToggle" style="background:#FFD017;color:#171717">${demoVisible()?'Nascondi demo':'Mostra demo'}</button>${hasRealRows()&&demoVisible()?`<button class="btn sm" id="d_demoOnly" style="background:${demoOnly()?'#1f7a4d':'#4a4a4a'};color:#fff">${demoOnly()?'✓ Solo demo (presentazione)':'Solo demo (presentazione)'}</button>`:''}<button class="btn ghost sm" id="d_demoDel">Elimina offerte demo</button>`:`<button class="btn ghost sm" id="d_demo">Carica offerte demo</button>`}
        <button class="btn ghost sm" id="d_export">${dt('export')}</button>
        <button class="btn nav sm" id="d_back">${dt('back')}</button>
      </div></div></div>`;
  const demoBanner=(hasDemoRows()&&demoVisible())?`<div class="card" style="background:#FFF6D1;border-color:#FFD017"><b>OFFERTE DEMO</b> · 42 offerte fittizie: 32 di prova (prezzi inventati) e 10 complete, ognuna con una barca e 15-22 optional (prezzi del listino caricato), numero «DEMO-…»), richiamabili e modificabili. Restano solo in questo browser: non finiscono nel registro Excel né su GitHub. Si eliminano con «Elimina offerte demo».</div>`:'';
  if(!rows.length){
    v.innerHTML=demoBanner+head+`<div class="card"><p class="hint" style="margin:0">${dt('nodata')}</p></div>`;wireDash();return;
  }
  const kpi=(l,val,sub,c)=>`<div style="flex:1;min-width:150px;border:1px solid var(--line);border-radius:12px;padding:14px 16px;background:#fff">
      <div style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--muted)">${l}</div>
      <div style="font-size:28px;font-weight:900;color:${c||'var(--navy)'};line-height:1.2">${val}</div>
      <div style="font-size:12px;color:var(--muted)">${sub||'&nbsp;'}</div></div>`;
  const kpis=`<div class="card"><div style="display:flex;flex-wrap:wrap;gap:12px">
    ${kpi(dt('offers'),st.n,money(st.v))}
    ${kpi(dt('won'),st.wn,money(st.wv),'var(--red)')}
    ${kpi(dt('lost'),st.ln,money(st.lv))}
    ${kpi(dt('open'),st.on,money(st.ov))}
    ${kpi(dt('winN'),pct(st.wn,st.n),st.wn+' / '+st.n)}
    ${kpi(dt('winV'),pct(st.wv,st.v),money(st.wv)+' / '+money(st.v))}
  </div></div>`;
  // per commerciale (solo quando si guardano tutti)
  let byRep='';
  if(!dashRep){
    const all=offerRows().filter(r=>{const d=parseOfferDate(r.date);return d&&d.getFullYear()===dashYear;});
    const names=[...new Set(all.map(r=>String(r.rep||'').trim()||'—'))].sort();
    byRep=`<div class="card"><h2>${dt('byRep')}</h2><div style="overflow:auto"><table class="ptable" style="font-size:13px">
      <tr><th>${dt('rep')}</th><th class="r">${dt('count')}</th><th class="r">${dt('value')}</th><th class="r">${dt('wonCount')}</th><th class="r">${dt('wonValue')}</th><th class="r">${dt('rate')}</th><th class="r">${dt('rateV')}</th></tr>
      ${names.map(n=>{const s=statsOf(all.filter(r=>(String(r.rep||'').trim()||'—')===n));
        return `<tr style="cursor:pointer" data-pickrep="${esc(n)}"><td><b>${esc(n)}</b></td><td class="r">${s.n}</td><td class="r">${money(s.v)}</td><td class="r">${s.wn}</td><td class="r">${money(s.wv)}</td><td class="r">${pct(s.wn,s.n)}</td><td class="r">${pct(s.wv,s.v)}</td></tr>`;}).join('')}
    </table></div></div>`;
  }
  // mese per mese
  const months=Array.from({length:12},()=>({n:0,v:0,wn:0,wv:0}));
  rows.forEach(r=>{const d=parseOfferDate(r.date);const m=months[d.getMonth()];m.n++;m.v+=Number(r.total)||0;
    if(rowStatus(r)==='won'){m.wn++;m.wv+=rowWonValue(r);}});
  const monthly=`<div class="card"><h2>${dt('monthly')}${dashRep?' · '+esc(dashRep):''} · ${dashYear}</h2>
    ${monthlyChart(months)}
    <div style="overflow:auto;margin-top:10px"><table class="ptable" style="font-size:13px">
      <tr><th>${dt('month')}</th><th class="r">${dt('count')}</th><th class="r">${dt('value')}</th><th class="r">${dt('wonCount')}</th><th class="r">${dt('wonValue')}</th><th class="r">${dt('rate')}</th><th class="r">${dt('rateV')}</th></tr>
      ${months.map((m,i)=>`<tr><td>${dt('monthNames')[i]}</td><td class="r">${m.n||'—'}</td><td class="r">${m.n?money(m.v):'—'}</td><td class="r">${m.wn||'—'}</td><td class="r">${m.wn?money(m.wv):'—'}</td><td class="r">${m.n?pct(m.wn,m.n):'—'}</td><td class="r">${m.n?pct(m.wv,m.v):'—'}</td></tr>`).join('')}
      <tr style="font-weight:800;background:var(--soft)"><td>${dt('yearTot')}</td><td class="r">${st.n}</td><td class="r">${money(st.v)}</td><td class="r">${st.wn}</td><td class="r">${money(st.wv)}</td><td class="r">${pct(st.wn,st.n)}</td><td class="r">${pct(st.wv,st.v)}</td></tr>
    </table></div></div>`;
  // vinte vs offerte
  const compare=`<div class="card"><h2>${dt('compare')}</h2><div class="grid g2">
    <div>${barPair(dt('byNumber'),st.n,st.wn,dt('offers'),dt('won'),x=>String(x))}</div>
    <div>${barPair(dt('byValue'),st.v,st.wv,dt('offered'),dt('wonVal'),money)}</div></div></div>`;
  // macchine
  const ms=machineStats(rows);
  const mTable=(arr,empty)=>arr.length?`<div style="overflow:auto"><table class="ptable" style="font-size:13px"><tr><th>${dt('machine')}</th><th class="r">${dt('times')}</th><th class="r">${dt('qty')}</th><th class="r">${dt('valueL')}</th></tr>
      ${arr.slice(0,15).map(x=>`<tr><td><b>${esc(x.name||x.code)}</b><br><span style="color:var(--muted);font-size:11px">${esc(x.code||'')}</span></td><td class="r">${x.times}</td><td class="r">${x.qty}</td><td class="r">${x.value?money(x.value):'—'}</td></tr>`).join('')}</table></div>`:`<p class="hint">${empty}</p>`;
  const catRows=Object.entries(ms.cat).sort((a,b)=>b[1].off-a[1].off);
  const cmax=Math.max(1,...catRows.map(c=>c[1].off));
  const machines=`<div class="card"><h2>${dt('mOffered')} · ${dt('mSold')}</h2><div class="grid g2">
      <div><h3 style="margin:0 0 6px;font-size:15px;color:var(--navy)">${dt('mOffered')}</h3>${mTable(ms.off,dt('noOff'))}</div>
      <div><h3 style="margin:0 0 6px;font-size:15px;color:var(--red)">${dt('mSold')}</h3>${mTable(ms.sold,dt('noSold'))}</div></div>
    <h3 style="margin:18px 0 6px;font-size:15px;color:var(--navy)">${dt('cat')}</h3>
    ${catRows.map(([c,x])=>`<div style="margin:6px 0"><div style="font-size:12.5px;font-weight:700">${esc(c)} <span style="color:var(--muted);font-weight:400">· ${x.off} ${dt('offers').toLowerCase()} / ${x.sold} ${dt('sold').toLowerCase()}</span></div>
      <div style="background:var(--soft);border-radius:4px;position:relative;height:16px"><div style="width:${x.off/cmax*100}%;background:var(--navy);height:16px;border-radius:4px"></div><div style="width:${x.sold/cmax*100}%;background:var(--red);height:16px;border-radius:4px;position:absolute;top:0;left:0"></div></div></div>`).join('')}
  </div>`;
  // elenco offerte con esito
  const sorted=[...rows].sort((a,b)=>parseOfferDate(b.date)-parseOfferDate(a.date)||String(b.num).localeCompare(String(a.num)));
  const list=`<div class="card"><h2>${dt('list')}</h2><p class="hint">${dt('hintStatus')}</p>
    <div style="overflow:auto"><table class="ptable" style="font-size:13px">
    <tr><th>${dt('num')}</th><th>${dt('date')}</th><th>${dt('client')}</th>${dashRep?'':`<th>${dt('rep')}</th>`}<th class="r">${dt('value')}</th><th>${dt('status')}</th><th>${dt('lines')} / ${dt('wonQ')}</th></tr>
    ${sorted.map(r=>{const idx=REGISTRY.rows.indexOf(r);const s=rowStatus(r);const ls=rowLines(r);
      const stSel=`<select data-st="${idx}" style="padding:6px;border-radius:7px;border:1px solid var(--line);font-weight:700;color:${s==='won'?'var(--red)':s==='lost'?'#6f6f6f':'var(--navy)'}">
        <option value="open"${s==='open'?' selected':''}>${dt('sOpen')}</option><option value="won"${s==='won'?' selected':''}>${dt('sWon')}</option><option value="lost"${s==='lost'?' selected':''}>${dt('sLost')}</option></select>`;
      const wonCell=s==='won'?`<div>${ls.map((l,li)=>`<label style="display:block;font-size:12px"><input type="checkbox" data-won="${idx}|${li}"${l.won?' checked':''}> ${esc(l.name||l.code)}${l.qty>1?' ×'+l.qty:''}${l.value?' · '+money(l.value):''}</label>`).join('')}
        <label style="font-size:12px;display:block;margin-top:4px">${dt('wonQ')} <input type="number" step="0.01" data-wonval="${idx}" value="${rowWonValue(r)}" style="width:120px;padding:5px;border:1px solid var(--line);border-radius:6px"></label></div>`
        :`<span style="color:var(--muted);font-size:12px">${esc(String(r.machine||'').slice(0,80))}</span>`;
      return `<tr><td><b>${esc(r.num)}</b> ${langBadge(r)}</td><td>${esc(parseOfferDate(r.date).toLocaleDateString('it-IT'))}</td><td>${esc(r.client)}</td>${dashRep?'':`<td>${esc(r.rep)}</td>`}<td class="r">${money(r.total)}</td><td>${stSel}</td><td>${wonCell}</td></tr>`;}).join('')}
    </table></div></div>`;
  v.innerHTML=demoBanner+head+kpis+expirySection()+byRep+monthly+compare+machines+list;
  wireDash();
}
async function dashPersist(row){
  persistRegistryLocal();
  let ok=false;try{ok=await writeRegistryBack();}catch(_){}
  if(GH.ok&&row&&!row.demo){try{ok=(await ghUpdateOffer(row))||ok;}catch(e){console.error(e);}}
  flash(ok?dt('saved'):dt('savedLocal'));
}
function wireDash(){
  const v=$('#view');
  $('#d_year').onchange=e=>{dashYear=+e.target.value;renderDashboard();};
  $('#d_rep').onchange=e=>{dashRep=e.target.value;renderDashboard();};
  $('#d_back').onclick=()=>toggleDashboard(false);
  if($('#d_demo'))$('#d_demo').onclick=()=>{installDemo();setDemoVisible(true);renderDashboard();};
  if($('#d_demoOnly'))$('#d_demoOnly').onclick=()=>{setDemoOnly(!demoOnly());renderDashboard();};
  if($('#d_demoToggle'))$('#d_demoToggle').onclick=()=>{setDemoVisible(!demoVisible());renderDashboard();};
  if($('#d_demoDel'))$('#d_demoDel').onclick=()=>{if(confirm('Eliminare le offerte demo?')){removeDemo();renderDashboard();}};
  $('#d_export').onclick=()=>{try{downloadRegistry();}catch(e){flash(t('load_err'));}};
  v.querySelectorAll('[data-expidx]').forEach(tr=>tr.onclick=()=>recallFromList(REGISTRY.rows[+tr.dataset.expidx]));
  startCountdown();
  v.querySelectorAll('[data-pickrep]').forEach(tr=>tr.onclick=()=>{dashRep=tr.dataset.pickrep==='—'?'':tr.dataset.pickrep;renderDashboard();});
  v.querySelectorAll('[data-st]').forEach(sel=>sel.onchange=async()=>{
    const r=REGISTRY.rows[+sel.dataset.st];if(!r)return;
    r.status=sel.value;r.outcomeDate=sel.value==='open'?'':new Date().toLocaleDateString('it-IT');
    if(sel.value==='won'){
      r.lines=rowLines(r).map(l=>({...l}));
      // di default risulta venduta la prima soluzione (pacchetto 1); il commerciale può correggere con le caselle
      const first=Math.min(...r.lines.map(l=>l.pkg||1));
      r.lines.forEach(l=>{l.won=(l.pkg||1)===first;});
      r.wonValue='';
    }else{r.lines=rowLines(r).map(l=>({...l,won:false}));r.wonValue='';}
    await dashPersist(r);renderDashboard();
  });
  v.querySelectorAll('[data-won]').forEach(cb=>cb.onchange=async()=>{
    const [i,li]=cb.dataset.won.split('|').map(Number);const r=REGISTRY.rows[i];
    r.lines=rowLines(r).map(l=>({...l}));r.lines[li].won=cb.checked;
    if(r.wonValue===''||r.wonValue==null||!r.wonManual){   // valore vinto = somma delle macchine vendute (finché non lo si modifica a mano)
      const sum=r.lines.filter(l=>l.won).reduce((x,l)=>x+(Number(l.value)||0),0);
      r.wonValue=sum||'';
    }
    await dashPersist(r);renderDashboard();
  });
  v.querySelectorAll('[data-wonval]').forEach(inp=>inp.onchange=async()=>{
    const r=REGISTRY.rows[+inp.dataset.wonval];if(!r)return;
    r.wonValue=inp.value===''?'':Number(inp.value);r.wonManual=true;
    await dashPersist(r);renderDashboard();
  });
}
async function toggleDashboard(on){
  DASH=on;
  if(on&&GH.ok){flash('Aggiorno le offerte da GitHub…');await ghRefresh();}
  const hide=on?'none':'';
  $('#stepper').style.display=hide;
  const nb=document.querySelector('.navbar');if(nb)nb.style.display=hide;
  const b=$('#dashBtn');if(b)b.classList.toggle('on',on);
  render();
}


/* ---------- offerte DEMO persistenti (solo in questo browser) ----------
   20 offerte fittizie con prezzi inventati, complete di snapshot: compaiono in dashboard e nell'elenco «Offerte»
   e si possono richiamare. Hanno r.demo=true: non vanno nel registro Excel, non vanno su GitHub, non occupano la numerazione. */
const DEMO_LS_HIDE='yacht_demo_hidden', DEMO_LS_DELETED='yacht_demo_deleted';
function hasDemoRows(){return REGISTRY.rows.some(r=>r.demo);}
function hasRealRows(){return REGISTRY.rows.some(r=>!r.demo);}
// le demo si caricano da sole (a meno che non siano state eliminate o nascoste a mano)
function demoVisible(){
  let v=null;try{v=localStorage.getItem(DEMO_LS_HIDE);}catch(_){}
  if(v==='0')return true; if(v==='1')return false;
  return true;   // le offerte demo sono visibili di default (insieme alle vere); «Solo demo» per le presentazioni
}
function setDemoVisible(on){try{localStorage.setItem(DEMO_LS_HIDE,on?'0':'1');}catch(_){}}
// modalità presentazione: mostra SOLO le offerte demo (nasconde quelle vere, con i dati dei clienti)
const DEMO_ONLY_LS='yacht_demo_only';
function demoOnly(){try{return localStorage.getItem(DEMO_ONLY_LS)==='1'&&hasDemoRows()&&demoVisible();}catch(_){return false;}}
function setDemoOnly(on){try{localStorage.setItem(DEMO_ONLY_LS,on?'1':'0');}catch(_){}}
function offerRows(){return REGISTRY.rows.filter(r=>demoOnly()?!!r.demo:(!r.demo||demoVisible()));}
function ensureDemoSeed(){
  let deleted=false;try{deleted=localStorage.getItem(DEMO_LS_DELETED)==='1';}catch(_){}
  const demo=REGISTRY.rows.filter(r=>r.demo);
  // le 10 complete devono avere 15+ optional: se erano state create prima del caricamento del listino optional, si rigenerano
  const poor=MATRIX_INFO.machines&&demo.some(r=>r.accN!=null&&(r.accN<15||r.dv!==2));
  if(!deleted&&!hasDemoRows()&&DATA.machines&&DATA.machines.length)installDemo();
  else if(!deleted&&poor)installDemo();
  // demo creata con una versione precedente (senza validità): rigenerala
  else if(!deleted&&hasDemoRows()&&REGISTRY.rows.filter(r=>r.demo).length!==42&&DATA.machines&&DATA.machines.length)installDemo();
}
function removeDemo(){
  REGISTRY.rows.filter(r=>r.demo).forEach(r=>{try{localStorage.removeItem(SNAP_LS+r.num);}catch(_){}});
  REGISTRY.rows=REGISTRY.rows.filter(r=>!r.demo);
  try{localStorage.setItem(DEMO_LS_DELETED,'1');localStorage.removeItem(DEMO_LS_HIDE);}catch(_){}
  persistRegistryLocal();
}
function installDemo(){
  try{localStorage.removeItem(DEMO_LS_DELETED);}catch(_){}
  REGISTRY.rows=REGISTRY.rows.filter(r=>!r.demo);
  let seed=20261013;const rnd=()=>{seed=(seed*1664525+1013904223)%4294967296;return seed/4294967296;};
  const pick=a=>a[Math.floor(rnd()*a.length)];
  const reps=(DATA.reps||[]).filter(r=>r.name);
  const clients=['Armatori Demo Alfa Srl','Beta Charter Srl','Gamma Marine Holding','Delta Yachting SpA','Epsilon Family Office','Zeta Nautica Srl','Eta Charter Group','Theta Investimenti Srl','Iota Yachting Club','Kappa Marine SpA','Lambda Holding Srl','Mu Navigazione Srl','Nu Family Office','Xi Charter Srl','Omicron Yachting','Pi Marine Srl','Rho Capital SpA','Sigma Boat Club','Tau Armatoriale Srl','Upsilon Holding'];
  const contacts=['Marco Bianchi','Laura Neri','Paolo Conti','Elena Greco','Davide Riva','Chiara Fontana'];
  // intervalli di prezzo FITTIZI, solo per le offerte demo (mai nel catalogo)
  const range={'Gamma flybridge':[1800000,9500000],'Infynito':[4200000,7800000]};
  const machines=DATA.machines.filter(m=>range[m.category]);
  const tpl=JSON.parse(JSON.stringify(S));
  const LANGS=['en'];
  const EXTRA={
    en:{clients:['Harbour Charter Ltd','Solent Marine Holdings','Atlantic Family Office'],contacts:['James Walker','Emma Clarke','Oliver Hughes'],role:'Owner representative'}};
  for(let i=0;i<32;i++){
    const lang=i<22?'it':'en', ex=EXTRA.en, k3=(i-22)%3;
    const month=i<22?Math.min(9,Math.floor(i*10/22)+(rnd()<0.3?1:0)):Math.min(9,2+((i-22)*7%8));
    const maxDay=month===new Date().getMonth()&&new Date().getFullYear()===2026?Math.max(1,new Date().getDate()-1):27;   // mai date future
    const dateStr=new Date(2026,month,1+Math.floor(rnd()*maxDay)).toLocaleDateString('it-IT');
    const rep=pick(reps);
    const num='DEMO-26-'+String(i+1).padStart(3,'0');
    const disc2=pick([0,0,5,5,10]);
    const validity=pick([30,60,60,90]);
    const n=1+(rnd()<0.35?1:0);
    const sols=[],lines=[];
    for(let k=0;k<n;k++){
      const m=pick(machines),[a,b]=range[m.category];
      const qty=1+(rnd()<0.25?Math.floor(rnd()*3):0);
      const unit=Math.round((a+rnd()*(b-a))/10000)*10000;
      const specs={};SPEC_FIELDS.forEach(([f])=>{if(m[f])specs[f]=m[f];});
      sols.push({code:m.code,name:m.name,desc:m.desc||'',atex:!!m.atex,unit,qty,img:'',imgs:[],specs,accessories:[],disc:null,tableDesc:undefined});
      lines.push({code:m.code,name:m.name,category:m.category,qty,value:Math.round(unit*qty*0.9*(1-disc2/100)*100)/100,pkg:k+1,won:false});
    }
    const old=month<=7,x=rnd();
    const status=old?(x<0.42?'won':x<0.75?'lost':'open'):(x<0.2?'won':x<0.3?'lost':'open');
    if(status==='won')lines[0].won=true;
    const client=i<22?clients[i%clients.length]:ex.clients[k3],contact=i<22?pick(contacts):ex.contacts[k3];
    const state=Object.assign({},tpl,{rep:{name:rep.name,email:rep.email||'',phone:rep.phone||''},offerNum:num,date:dateStr,client,contact,role:i<22?'Rappresentante armatore':ex.role,
      phone:'',email:'demo@esempio.invalid',subject:(I18N[lang]&&I18N[lang].def_subject)||'Offerta imbarcazione',intro:'',
      delivery:(I18N[lang]&&I18N[lang].def_delivery)||tpl.delivery,packaging:(I18N[lang]&&I18N[lang].def_packaging)||tpl.packaging,payment:(I18N[lang]&&I18N[lang].def_payment)||tpl.payment,isRevisionOffer:false,solutions:sols,
      discount:0,discount2:disc2,discount3:0,notes:'',validity:String(validity)});
    const row={prog:i+1,num,date:dateStr,client,rep:rep.name,lang,total:lines[0].value,
      machine:lines.map(l=>`${l.code} (${l.name})${l.qty>1?' x'+l.qty:''}`).join(' | '),addedOptionals:'',note:'DEMO',validity:String(validity),
      status,outcomeDate:status==='open'?'':dateStr,wonValue:'',lines,demo:true};
    REGISTRY.rows.push(row);
    rememberSnapshotLocal(num,{__yachtOffer:true,baseOfferNum:num,savedAt:new Date(2026,month,1).toISOString(),lang,state});
  }
  installShowcaseDemo(rnd,pick,reps,tpl);
  persistRegistryLocal();
}
// 10 offerte demo "complete" per le presentazioni: UNA barca ciascuna, con 15-22 optional del listino (prezzi reali del listino caricato)
const SHOWCASE_N=10;
function installShowcaseDemo(rnd,pick,reps,tpl){
  const boats=DATA.machines.filter(m=>m.price>0);
  if(!boats.length)return;
  const clients=['Marina Azzurra Charter Srl','Famiglia Rinaldi','Tirreno Yachting SpA','Adriatica Holding Srl','Gruppo Bellavista','Lago & Mare Srl','Capo Verde Family Office','Riviera Luxury Boats Srl','Studio Legale Montanari','Porto Rotondo Marine Srl'];
  const contacts=['Alessandro Rinaldi','Giulia Montanari','Federico Bellavista','Sara Conti','Matteo Ferraro','Elena Gallo','Luca Ricci','Chiara Moretti','Davide Marini','Paola Serra'];
  const months=[0,1,2,3,4,5,6,7,8,9];
  for(let i=0;i<SHOWCASE_N;i++){
    const lang=i<7?'it':'en';
    const m=boats[(i*3+1)%boats.length];            // modelli diversi a rotazione
    const pool=(machineOptionals(m.code)||[]).filter(o=>(o.price??o.l0??o.le)>0&&!/\bMAN\b.*\bhp\b/i.test(o.desc||''));   // niente kit ricambi di motori diversi dalla barca
    const eng=pool.find(o=>/^ENG-/i.test(o.code));
    const others=pool.filter(o=>o!==eng).map(o=>[rnd(),o]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
    const n=15+Math.floor(rnd()*8);
    const chosen=[...(eng&&i%2===0?[eng]:[]),...others].slice(0,n);
    const acc=chosen.map(o=>({code:o.code,desc:o.desc_it||o.desc||'',group:o.group||'Altro',qty:1,price:Number(o.price??o.l0??o.le)||0,img:''}));
    const specs={};SPEC_FIELDS.forEach(([f])=>{if(m[f])specs[f]=m[f];});
    const sol={code:m.code,name:m.name,desc:m.desc||'',atex:false,unit:Number(m.price)||0,qty:1,img:'',imgs:[],specs,accessories:acc,disc:null,tableDesc:undefined};
    const disc2=pick([0,0,3,5]);
    const mult=1-disc2/100;
    const total=Math.round((sol.unit+acc.reduce((x,a)=>x+a.price*a.qty,0))*mult*100)/100;
    const month=months[i];
    const maxDay=month===new Date().getMonth()&&new Date().getFullYear()===2026?Math.max(1,new Date().getDate()-1):27;
    const dateStr=new Date(2026,month,1+Math.floor(rnd()*maxDay)).toLocaleDateString('it-IT');
    const rep=pick(reps);
    const num='DEMO-26-'+String(33+i).padStart(3,'0');
    const validity=pick([30,45,60]);
    const x=rnd();const status=month<=6?(x<0.4?'won':x<0.7?'lost':'open'):(x<0.2?'won':x<0.3?'lost':'open');
    const L={code:m.code,name:m.name,category:m.category,qty:1,value:total,pkg:1,won:status==='won'};
    const client=clients[i],contact=contacts[i];
    const state=Object.assign({},tpl,{rep:{name:rep.name,email:rep.email||'',phone:rep.phone||''},offerNum:num,date:dateStr,client,contact,role:lang==='it'?'Rappresentante armatore':'Owner representative',
      phone:'',email:'demo@esempio.invalid',subject:(I18N[lang]&&I18N[lang].def_subject)||'Offerta imbarcazione',intro:'',
      isRevisionOffer:false,solutions:[sol],discount:0,discount2:disc2,discount3:0,notes:'',validity:String(validity),incoterm:pick(['Ex Works','FAS','CIF','DAP','DDP']),
      payment:(I18N[lang]&&I18N[lang].def_payment)||tpl.payment});
    const row={prog:33+i,num,date:dateStr,client,rep:rep.name,lang,total,
      machine:`${m.code} (${m.name})`,addedOptionals:`[${m.code}] `+acc.map(a=>a.code+' - '+a.desc).join('; '),note:'DEMO',validity:String(validity),accN:acc.length,dv:2,
      status,outcomeDate:status==='open'?'':dateStr,wonValue:'',lines:[L],demo:true};
    REGISTRY.rows.push(row);
    rememberSnapshotLocal(num,{__yachtOffer:true,baseOfferNum:num,savedAt:new Date(2026,month,1).toISOString(),lang,state});
  }
}
