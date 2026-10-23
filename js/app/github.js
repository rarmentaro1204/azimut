/* Configuratore Yacht — modulo "github"
   Salva ogni offerta (JSON + PDF) in una repo GitHub PRIVATA tramite le API REST e rilegge le offerte per la dashboard.
   - Configurazione e token restano nel localStorage del browser: NON sono mai nel codice / nella repo.
   - Un file per offerta: <cartella>/<anno>/<NUMERO>.json  e  <NUMERO>.pdf  (nessun conflitto tra commerciali).
   - Il numero progressivo è riservato creando il file: se esiste già (422) si passa al successivo.
   - Rifiuta di scrivere se la repo è PUBBLICA: i dati dei clienti non devono finire in una repo aperta. */
const GH_LS='yacht_github_v1', GH_CACHE='yacht_github_cache_v1';
const GH={cfg:{owner:'',repo:'',branch:'main',dir:'offerte',token:''},ok:false,msg:'',busy:false,proxy:false};   // proxy: collegamento tramite funzione Netlify (token sul server)
// valori predefiniti (modificabili): proprietario e repo privata delle offerte
const GH_DEFAULT={owner:'rarmentaro1204',repo:'azimut-offerte',branch:'main',dir:'offerte'};
function ghLoadCfg(){
  Object.assign(GH.cfg,GH_DEFAULT);
  try{const c=JSON.parse(localStorage.getItem(GH_LS)||'null');if(c)Object.keys(c).forEach(k=>{if(c[k])GH.cfg[k]=c[k];});}catch(_){}
}
function ghSaveCfg(){if(GH.proxy)return;try{localStorage.setItem(GH_LS,JSON.stringify(GH.cfg));}catch(_){}}
function ghHasCfg(){return !!(GH.cfg.token&&GH.cfg.owner&&GH.cfg.repo);}
function ghRepoPath(){return `/repos/${encodeURIComponent(GH.cfg.owner)}/${encodeURIComponent(GH.cfg.repo)}`;}
// Sul sito pubblicato il token sta sul server (funzione Netlify /.netlify/functions/gh): ogni PC/browser è collegato da solo.
async function ghDetectProxy(){
  if(!/^https?:/.test(location.protocol))return false;
  try{
    const r=await fetch('/.netlify/functions/gh',{cache:'no-store'});
    if(!r.ok||!/json/.test(r.headers.get('content-type')||''))return false;
    const j=await r.json();
    if(j&&j.configured){GH.proxy=true;Object.assign(GH.cfg,{owner:j.owner,repo:j.repo,branch:GH_DEFAULT.branch,dir:GH_DEFAULT.dir,token:'(server)'});return true;}
  }catch(_){}
  return false;
}
async function ghApi(path,opt={}){
  if(GH.proxy){
    const res=await fetch('/.netlify/functions/gh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method:opt.method||'GET',path,body:opt.body||null})});
    let j=null;try{j=await res.json();}catch(_){}
    if(!j)return {status:res.status,ok:false,body:null};
    const st=j.status!=null?j.status:res.status;
    return {status:st,ok:st>=200&&st<300,body:j.body};
  }
  const res=await fetch('https://api.github.com'+path,Object.assign({},opt,{headers:Object.assign({
    Authorization:'Bearer '+GH.cfg.token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},opt.headers||{})}));
  let body=null;try{body=await res.json();}catch(_){}
  return {status:res.status,ok:res.ok,body};
}
const ghB64=s=>btoa(unescape(encodeURIComponent(s)));
const ghFromB64=b=>decodeURIComponent(escape(atob(String(b).replace(/\s/g,''))));
function ghBlobB64(blob){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=rej;r.readAsDataURL(blob);});}
function ghSetState(ok,msg){GH.ok=ok;GH.msg=msg||'';ghRenderBtn();}
function ghRenderBtn(){
  const b=$('#ghBtn');if(!b)return;
  b.textContent=GH.ok?'✓ GitHub':'GitHub';
  b.title=GH.ok?(GH.cfg.owner+'/'+GH.cfg.repo+' · '+GH.msg):(GH.msg||'Collega GitHub per salvare le offerte nella repo');
  b.style.background=GH.ok?'#1f7a4d':'#4a4a4a';
}
// collegamento + controlli di sicurezza (repo privata, permesso di scrittura)
async function ghConnect(silent){
  if(!GH.cfg.token){ghSetState(false,'Manca il token');return false;}
  if(!GH.cfg.owner||!GH.cfg.repo){ghSetState(false,'Mancano proprietario o repo: compila entrambi i campi');return false;}
  try{
    const r=await ghApi(ghRepoPath());
    if(r.status===401){ghSetState(false,'Token non valido o scaduto: creane uno nuovo');return false;}
    if(r.status===403){ghSetState(false,'Accesso negato (403): controlla permessi del token o limite di richieste');return false;}
    if(r.status===404){ghSetState(false,`Repo «${GH.cfg.owner}/${GH.cfg.repo}» non trovata, oppure il token non ha accesso a quella repo`);return false;}
    if(!r.ok){ghSetState(false,'Errore GitHub '+r.status);return false;}
    if(r.body.private!==true){ghSetState(false,'La repo è PUBBLICA: per sicurezza non salvo dati dei clienti');return false;}
    if(r.body.permissions&&r.body.permissions.push===false){ghSetState(false,'Il token non ha il permesso di scrittura');return false;}
    GH.cfg.branch=GH.cfg.branch||r.body.default_branch||'main';
    ghSetState(true,'repo privata · '+GH.cfg.branch);
    return true;
  }catch(e){ghSetState(false,'Rete non raggiungibile');return false;}
}
async function ghTree(){
  const r=await ghApi(`${ghRepoPath()}/git/trees/${encodeURIComponent(GH.cfg.branch)}?recursive=1`);
  if(r.status===409||r.status===404)return [];           // repo vuota / branch non ancora creato
  if(!r.ok)throw new Error('tree '+r.status);
  const dir=GH.cfg.dir.replace(/^\/|\/$/g,'')+'/';
  return (r.body.tree||[]).filter(x=>x.type==='blob'&&x.path.startsWith(dir)&&/\.json$/i.test(x.path));
}
// legge tutte le offerte dalla repo e le unisce al registro locale (GitHub vince in caso di stesso numero)
// aggiorna al massimo una volta ogni 30 s (usata quando si entra nei passi Cliente/Offerta)
function ghRefreshSoon(){if(GH.ok&&Date.now()-(GH.lastRefresh||0)>30000)ghRefresh().then(refreshOfferNumber);}
async function ghRefresh(){
  if(!GH.ok||(typeof DEMO!=='undefined'&&DEMO.on))return false;
  GH.lastRefresh=Date.now();
  try{
    const files=await ghTree();
    let cache={};try{cache=JSON.parse(localStorage.getItem(GH_CACHE)||'{}');}catch(_){}
    const next={},rows=[];
    const todo=[];
    files.forEach(f=>{if(cache[f.sha])next[f.sha]=cache[f.sha];else todo.push(f);});
    let i=0;
    async function worker(){
      while(i<todo.length){const f=todo[i++];
        try{
          const r=await ghApi(`${ghRepoPath()}/git/blobs/${f.sha}`);
          if(r.ok){const j=JSON.parse(ghFromB64(r.body.content));if(j&&j.row){next[f.sha]=Object.assign({},j.row,{ghPath:f.path});}}
        }catch(e){console.error('gh blob',f.path,e);}
      }
    }
    await Promise.all(Array.from({length:6},worker));
    files.forEach(f=>{if(next[f.sha])rows.push(Object.assign({},next[f.sha],{ghPath:f.path}));});
    try{localStorage.setItem(GH_CACHE,JSON.stringify(next));}catch(_){}
    // merge: righe remote + righe locali non ancora presenti su GitHub
    const byNum=new Map();
    REGISTRY.rows.forEach(r=>byNum.set(String(r.num).trim(),r));
    rows.forEach(r=>byNum.set(String(r.num).trim(),r));
    REGISTRY.rows=[...byNum.values()].sort((a,b)=>(+a.prog||0)-(+b.prog||0));
    persistRegistryLocal();
    return true;
  }catch(e){console.error(e);flash('GitHub: lettura offerte non riuscita');return false;}
}
function ghOfferPath(num,date){
  const d=(typeof parseOfferDate==='function'&&parseOfferDate(date))||new Date();
  return `${GH.cfg.dir.replace(/^\/|\/$/g,'')}/${d.getFullYear()}/${String(num).replace(/[^\w\-]/g,'_')}`;
}
async function ghPut(path,contentB64,message,sha){
  const body={message,content:contentB64,branch:GH.cfg.branch};if(sha)body.sha=sha;
  return ghApi(`${ghRepoPath()}/contents/${path.split('/').map(encodeURIComponent).join('/')}`,{method:'PUT',body:JSON.stringify(body)});
}
// salva l'offerta (riserva il numero creando il file). Ritorna {num} (può cambiare se il numero era già preso).
async function ghSaveOffer(row,snapshot){
  if(!GH.ok)return {saved:false};
  const mk=p=>BRAND.offerPrefix+String(yr).slice(2)+'-'+String(p).padStart(3,'0');
  for(let tries=0;tries<20;tries++){
    const path=ghOfferPath(row.num,row.date)+'.json';
    const payload={version:1,savedAt:new Date().toISOString(),row:Object.assign({},row,{ghPath:undefined}),snapshot:snapshot||null};
    const r=await ghPut(path,ghB64(JSON.stringify(payload)),`Offerta ${row.num} · ${row.client||''} · ${row.rep||''}`);
    if(r.ok){row.ghPath=path;return {saved:true,num:row.num};}
    if(r.status===422||r.status===409){      // numero già usato da un collega: prendi il successivo
      const m=String(row.num).match(/^(.*?)-(\d+)(_REV\d+)?$/i);
      if(m&&!m[3]){row.prog=(+row.prog||+m[2])+1;row.num=mk(row.prog);}
      else row.num=String(row.num)+'_b';
      S.offerNum=row.num;continue;
    }
    throw new Error('GitHub '+r.status+' '+((r.body&&r.body.message)||''));
  }
  throw new Error('numero offerta non riservabile');
}
async function ghUploadFile(row,blob,ext,label){
  if(!GH.ok||!blob)return false;
  const path=ghOfferPath(row.num,row.date)+ext;
  const b64=await ghBlobB64(blob);
  let r=await ghPut(path,b64,`${label} offerta ${row.num}`);
  if(r.status===422||r.status===409){      // già presente (revisione): aggiorna con lo sha attuale
    const cur=await ghApi(`${ghRepoPath()}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(GH.cfg.branch)}`);
    if(cur.ok)r=await ghPut(path,b64,`${label} offerta ${row.num} (aggiornato)`,cur.body.sha);
  }
  return r.ok;
}
function ghUploadPdf(row,blob){return ghUploadFile(row,blob,'.pdf','PDF');}
// aggiorna esito/valore di un'offerta già salvata (dashboard), conservando lo snapshot
async function ghUpdateOffer(row){
  if(!GH.ok||!row.ghPath)return false;
  const url=`${ghRepoPath()}/contents/${row.ghPath.split('/').map(encodeURIComponent).join('/')}`;
  for(let k=0;k<3;k++){
    const cur=await ghApi(`${url}?ref=${encodeURIComponent(GH.cfg.branch)}`);
    if(!cur.ok)return false;
    let old={};try{old=JSON.parse(ghFromB64(cur.body.content));}catch(_){}
    const payload={version:1,savedAt:old.savedAt||new Date().toISOString(),updatedAt:new Date().toISOString(),
      row:Object.assign({},row,{ghPath:undefined}),snapshot:old.snapshot||null};
    const r=await ghPut(row.ghPath,ghB64(JSON.stringify(payload)),`Esito offerta ${row.num}: ${rowStatus(row)}`,cur.body.sha);
    if(r.ok)return true;
    if(r.status!==409&&r.status!==422)return false;
  }
  return false;
}

/* ---------- finestra di collegamento ---------- */
function ghOpenDialog(){
  const old=document.getElementById('ghOverlay');if(old)old.remove();
  const o=document.createElement('div');o.id='ghOverlay';o.className='load-overlay';o.style.display='flex';
  const c=GH.cfg;
  if(GH.proxy){   // collegamento automatico dal server: niente da inserire
    o.innerHTML=`<div class="load-card" style="width:min(520px,94vw);text-align:left">
      <div class="load-title">GitHub</div>
      <div class="load-status" style="min-height:0">Collegato automaticamente dal server: offerte e impostazioni si salvano nella repo privata <b>${esc(c.owner)}/${esc(c.repo)}</b> su questo e su qualunque altro computer o browser. Non serve inserire nessun token.</div>
      <div id="gh_status" style="margin-top:10px;font-size:12.5px;color:${GH.ok?'#1f7a4d':'#8c1412'}">${esc(GH.ok?'Stato: '+GH.msg:(GH.msg||'Verifica in corso…'))}</div>
      <div style="display:flex;gap:8px;margin-top:12px"><button class="btn ghost" id="gh_retry">Riprova</button><button class="btn ghost" id="gh_close" style="margin-left:auto">Chiudi</button></div></div>`;
    document.body.appendChild(o);
    o.querySelector('#gh_close').onclick=()=>o.remove();
    o.querySelector('#gh_retry').onclick=async()=>{const st=o.querySelector('#gh_status');st.textContent='Verifica in corso…';const ok=await ghConnect();st.style.color=ok?'#1f7a4d':'#8c1412';st.textContent=ok?'Stato: '+GH.msg:GH.msg;if(ok){await ghRefresh();await setPullGh();}};
    return;
  }
  o.innerHTML=`<div class="load-card" style="width:min(560px,94vw);max-height:88vh;overflow:auto;text-align:left">
    <div class="load-title">Collega GitHub</div>
    <div class="load-status" style="min-height:0">Le offerte (dati + PDF) e le impostazioni (dati emittente, commerciali, ultime condizioni, clienti) vengono salvate in una repo <b>privata</b>. Collegamento una sola volta per computer: poi è automatico.</div>
    <div style="font-size:12px;color:var(--muted);line-height:1.6;margin:8px 0 12px">
      1. Crea una repo <b>privata</b> (es. <code>azimut-offerte</code>).<br>
      2. GitHub → Settings → Developer settings → <i>Fine-grained tokens</i> → solo quella repo, permesso <b>Contents: Read and write</b>.<br>
      3. Incolla qui sotto proprietario, repo e token.</div>
    <div class="grid g2">
      <label class="fld">Proprietario<input id="gh_owner" value="${esc(c.owner||GH_DEFAULT.owner)}" placeholder="proprietario GitHub"></label>
      <label class="fld">Repo privata<input id="gh_repo" value="${esc(c.repo||GH_DEFAULT.repo)}" placeholder="nome repo privata"></label>
      <label class="fld">Branch<input id="gh_branch" value="${esc(c.branch||'main')}"></label>
      <label class="fld">Cartella<input id="gh_dir" value="${esc(c.dir||'offerte')}"></label>
    </div>
    <label class="fld" style="margin-top:12px">Token (resta solo in questo browser)<input id="gh_token" type="password" autocomplete="off" value="${esc(c.token)}" placeholder="github_pat_…"></label>
    <div id="gh_status" style="margin-top:10px;font-size:12.5px;min-height:18px;color:${GH.ok?'#1f7a4d':'#8c1412'}">${esc(GH.msg)}</div>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
      <button class="btn prim" id="gh_save">Collega e verifica</button>
      <button class="btn ghost" id="gh_off">Scollega</button>
      <button class="btn ghost" id="gh_close" style="margin-left:auto">Chiudi</button>
    </div></div>`;
  document.body.appendChild(o);
  const st=o.querySelector('#gh_status');
  o.querySelector('#gh_close').onclick=()=>o.remove();
  o.querySelector('#gh_off').onclick=()=>{GH.cfg.token='';ghSaveCfg();try{localStorage.removeItem(GH_CACHE);}catch(_){}ghSetState(false,'Non collegato');o.remove();flash('GitHub scollegato');};
  o.querySelector('#gh_save').onclick=async()=>{
    GH.cfg={owner:o.querySelector('#gh_owner').value.trim(),repo:o.querySelector('#gh_repo').value.trim(),
      branch:o.querySelector('#gh_branch').value.trim()||'main',dir:o.querySelector('#gh_dir').value.trim()||'offerte',token:o.querySelector('#gh_token').value.trim()};
    st.style.color='#555';st.textContent='Verifica in corso…';
    const ok=await ghConnect();
    st.style.color=ok?'#1f7a4d':'#8c1412';st.textContent=ok?'Collegato: '+GH.msg:GH.msg;
    if(ok){ghSaveCfg();await ghRefresh();refreshOfferNumber();await setPullGh();flash('GitHub collegato');setTimeout(()=>o.remove(),700);if(step===3)render();}
  };
}
function ghInit(){
  ghLoadCfg();
  const b=$('#ghBtn');if(b)b.onclick=ghOpenDialog;
  ghRenderBtn();
  ghDetectProxy().then(()=>{if(ghHasCfg())ghConnect(true).then(ok=>{if(ok){ghRefresh().then(refreshOfferNumber);setPullGh();}});});     // collegamento automatico all'apertura (server oppure token locale)
}
