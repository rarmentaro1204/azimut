/* Configuratore Yacht — modulo "recall"
   Elenco di tutte le offerte fatte: si sceglie una riga e l'offerta viene richiamata in automatico
   (legge lo snapshot JSON da GitHub, o dalla copia locale del browser) come nuova revisione _REVn. */
const SNAP_LS='yacht_snap_';
function rememberSnapshotLocal(num,snapshot){
  try{
    localStorage.setItem(SNAP_LS+num,JSON.stringify(snapshot));
    // tieni al massimo le ultime 60 copie locali
    const keys=Object.keys(localStorage).filter(k=>k.startsWith(SNAP_LS));
    if(keys.length>60){keys.map(k=>[k,(JSON.parse(localStorage.getItem(k)||'{}').savedAt)||''])
      .sort((a,b)=>a[1].localeCompare(b[1])).slice(0,keys.length-60).forEach(([k])=>localStorage.removeItem(k));}
  }catch(_){}
}
async function snapshotForOffer(row){
  if(GH.ok&&row.ghPath){
    try{
      const r=await ghApi(`${ghRepoPath()}/contents/${row.ghPath.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(GH.cfg.branch)}`);
      if(r.ok){const j=JSON.parse(ghFromB64(r.body.content));if(j&&j.snapshot)return j.snapshot;}
    }catch(e){console.error(e);}
  }
  try{const s=JSON.parse(localStorage.getItem(SNAP_LS+row.num)||'null');if(s)return s;}catch(_){}
  return null;
}
async function recallFromList(row){
  const ov=document.getElementById('offersOverlay');
  if(ov){const st=ov.querySelector('#ol_status');if(st)st.textContent='Carico l’offerta '+row.num+'…';}
  const snap=await snapshotForOffer(row);
  if(!snap){
    if(ov){const st=ov.querySelector('#ol_status');if(st){st.style.color='#8c1412';st.textContent='Dati non disponibili per '+row.num+': offerta salvata prima del salvataggio automatico o su un altro browser (collega GitHub).';}}
    return;
  }
  if(ov)ov.remove();
  DASH&&toggleDashboard(false);
  showLoader(t('recall_offer'));setLoader(-1,'');
  const base=String(row.num||'').replace(/_REV\d+$/i,'');
  await restoreOfferData(snap,base);
}
async function openOfferList(){
  const old=document.getElementById('offersOverlay');if(old)old.remove();
  const o=document.createElement('div');o.id='offersOverlay';o.className='load-overlay';o.style.display='flex';
  o.innerHTML=`<div class="load-card" style="width:min(980px,96vw);max-height:90vh;overflow:auto;text-align:left">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
      <div class="load-title" style="margin:0">Richiama un'offerta</div>
      <button class="btn ghost sm" id="ol_close">Chiudi</button></div>
    <div id="ol_status" class="load-status" style="margin-top:6px">${GH.ok?'Aggiorno l’elenco da GitHub…':'Offerte di questo browser (collega GitHub per vedere quelle di tutti).'}</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin:8px 0">
      <input id="ol_q" class="search" style="flex:1;min-width:200px;margin:0" placeholder="Cerca per numero, cliente, macchina…" autocomplete="off">
      <select id="ol_rep" style="padding:9px;border:1px solid var(--line);border-radius:9px"><option value="">Tutti i commerciali</option></select>
      <select id="ol_st" style="padding:9px;border:1px solid var(--line);border-radius:9px"><option value="">Tutti gli esiti</option><option value="open">Aperte</option><option value="won">Vinte</option><option value="lost">Perse</option></select>
    </div>
    <div style="overflow:auto;max-height:58vh"><table class="ptable" style="font-size:13px" id="ol_tbl"></table></div></div>`;
  document.body.appendChild(o);
  o.querySelector('#ol_close').onclick=()=>o.remove();
  const st=o.querySelector('#ol_status');
  const draw=()=>{
    const q=o.querySelector('#ol_q').value.trim().toLowerCase(),rep=o.querySelector('#ol_rep').value,sf=o.querySelector('#ol_st').value;
    const rows=offerRows().filter(r=>(!rep||String(r.rep).trim()===rep)&&(!sf||rowStatus(r)===sf)&&
      (!q||(String(r.num)+' '+r.client+' '+r.machine+' '+r.rep).toLowerCase().includes(q)))
      .sort((a,b)=>(parseOfferDate(b.date)||0)-(parseOfferDate(a.date)||0)||(+b.prog||0)-(+a.prog||0));
    const lab={won:'Vinta',lost:'Persa',open:'Aperta'};
    o.querySelector('#ol_tbl').innerHTML=`<tr><th>Offerta</th><th>Data</th><th>Cliente</th><th>Commerciale</th><th class="r">Valore</th><th>Esito</th><th>Macchine</th></tr>`+
      (rows.length?rows.map(r=>{const i=REGISTRY.rows.indexOf(r);
        return `<tr data-row="${i}" style="cursor:pointer"><td><b>${esc(r.num)}</b> <span class="badge code">${String(r.lang||'it').toUpperCase()}</span>${r.demo?' <span class="badge" style="background:#FFD017;color:#171717">DEMO</span>':''}</td><td>${esc((parseOfferDate(r.date)||new Date()).toLocaleDateString('it-IT'))}</td><td>${esc(r.client)}</td><td>${esc(r.rep)}</td><td class="r">${money(r.total)}</td><td>${lab[rowStatus(r)]}</td><td style="color:var(--muted);font-size:12px">${esc(String(r.machine||'').slice(0,70))}</td></tr>`;}).join('')
        :`<tr><td colspan="7" style="color:var(--muted);padding:16px">Nessuna offerta trovata.</td></tr>`);
    o.querySelectorAll('[data-row]').forEach(tr=>tr.onclick=()=>recallFromList(REGISTRY.rows[+tr.dataset.row]));
  };
  const fillReps=()=>{const sel=o.querySelector('#ol_rep'),cur=sel.value;
    const reps=[...new Set(offerRows().map(r=>String(r.rep||'').trim()).filter(Boolean))].sort();
    sel.innerHTML='<option value="">Tutti i commerciali</option>'+reps.map(n=>`<option${n===cur?' selected':''}>${esc(n)}</option>`).join('');};
  ['#ol_q','#ol_rep','#ol_st'].forEach(s=>o.querySelector(s).addEventListener('input',draw));
  loadRegistryLocal();ensureDemoSeed();fillReps();draw();
  if(GH.ok){const ok=await ghRefresh();fillReps();draw();st.textContent=ok?`${REGISTRY.rows.length} offerte · clicca una riga per richiamarla`:'Elenco da GitHub non aggiornato';}
  else st.textContent=`${REGISTRY.rows.length} offerte · clicca una riga per richiamarla`;
}
