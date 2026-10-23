/* Configuratore Yacht — modulo "settings"
   Impostazioni che devono restare salvate: dati emittente, commerciali, ultime condizioni usate, clienti inseriti.
   - Copia locale nel browser (localStorage) e, se GitHub è collegato (repo PRIVATA verificata), anche in <repo>/config/impostazioni.json.
   - All'apertura si leggono da GitHub: si ritrovano su qualunque computer collegato alla stessa repo. */
const SET_LS='yacht_settings_v1';
const SET={issuer:{},reps:[],rep:null,terms:{},clients:[],savedAt:0};
const SET_PATH='config/impostazioni.json';
const isPlaceholderRep=r=>/^\s*\[/.test(String(r&&r.name||''));
function setLoadLocal(){try{const o=JSON.parse(localStorage.getItem(SET_LS)||'null');if(o)Object.assign(SET,o);}catch(_){}}
function setSaveLocal(){try{localStorage.setItem(SET_LS,JSON.stringify(SET));}catch(_){}}
// elenco commerciali: quelli salvati sostituiscono i segnaposto
function mergeRepsFromSettings(list){
  const out=(list||[]).filter(r=>!isPlaceholderRep(r)||!SET.reps.length);
  SET.reps.forEach(r=>{if(r&&r.name&&!out.some(x=>x.name===r.name))out.push({name:r.name,email:r.email||'',phone:r.phone||'',role:r.role||''});});
  return out.length?out:list;
}
function setApplyAll(){
  Object.keys(SET.issuer||{}).forEach(k=>{if(SET.issuer[k]!=null)issuerSet(k,SET.issuer[k],true);});
  DATA.reps=mergeRepsFromSettings(DATA.reps);
  if(SET.rep&&SET.rep.name&&(!S.rep||!S.rep.name||isPlaceholderRep(S.rep)))S.rep=Object.assign({name:'',email:'',phone:''},SET.rep);
  // condizioni: solo se ancora quelle predefinite (non si sovrascrive quello che l'utente ha già digitato)
  const T=SET.terms||{};
  if(T.validity&&(S.validity==='30'||!S.validity))S.validity=T.validity;
  if(T.lead!=null&&!S.lead)S.lead=T.lead;
  if(T.payment&&!S.payment)S.payment=T.payment;
  if(T.incoterm&&(S.incoterm==='Ex Works'||!S.incoterm))S.incoterm=T.incoterm;
  if(T.exclusions&&!S.exclusions)S.exclusions=T.exclusions;
  (SET.clients||[]).forEach(c=>{if(c&&c.company&&!CLIENTS.some(x=>String(x.company).toLowerCase()===String(c.company).toLowerCase()))CLIENTS.push(c);});
}
let _setT;
function setQueue(){
  SET.issuer=Object.fromEntries(ISSUER_FIELDS.map(([f])=>[f,issuerGet(f)]));
  SET.savedAt=Date.now();setSaveLocal();
  clearTimeout(_setT);_setT=setTimeout(setPushGh,1500);
}
function repRemember(){
  const r=S.rep;if(!r||!String(r.name||'').trim())return;
  const i=SET.reps.findIndex(x=>x.name===r.name);
  const item={name:r.name,email:r.email||'',phone:r.phone||'',role:r.role||''};
  if(i>=0)SET.reps[i]=item;else SET.reps.push(item);
  SET.rep=item;setQueue();
}
// dopo il salvataggio di un'offerta: ricorda condizioni usate e cliente
function settingsAfterSave(){
  SET.terms={validity:S.validity,lead:S.lead,payment:S.payment,incoterm:S.incoterm,exclusions:S.exclusions};
  if(String(S.client||'').trim()){
    const item={company:S.client.trim(),contact:S.contact||'',role:S.role||'',phone:S.phone||'',email:S.email||''};
    const i=SET.clients.findIndex(c=>String(c.company).toLowerCase()===item.company.toLowerCase());
    if(i>=0)SET.clients[i]=item;else SET.clients.push(item);
    setApplyAll();
  }
  repRemember();
}
async function setPushGh(){
  if(!GH.ok)return false;
  try{
    const url=`${ghRepoPath()}/contents/${SET_PATH.split('/').map(encodeURIComponent).join('/')}`;
    for(let k=0;k<3;k++){
      const cur=await ghApi(`${url}?ref=${encodeURIComponent(GH.cfg.branch)}`);
      const sha=cur.ok?cur.body.sha:undefined;
      const r=await ghPut(SET_PATH,ghB64(JSON.stringify({version:1,savedAt:SET.savedAt||Date.now(),issuer:SET.issuer,reps:SET.reps,rep:SET.rep,terms:SET.terms,clients:SET.clients},null,1)),'Impostazioni configuratore',sha);
      if(r.ok)return true;
      if(r.status!==409&&r.status!==422)return false;
    }
  }catch(e){console.warn('impostazioni non salvate su GitHub',e);}
  return false;
}
async function setPullGh(){
  if(!GH.ok)return;
  try{
    const r=await ghApi(`${ghRepoPath()}/contents/${SET_PATH.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(GH.cfg.branch)}`);
    if(!r.ok){ if(r.status===404)setQueue(); return; }   // prima volta: crea il file con le impostazioni correnti
    const remote=JSON.parse(ghFromB64(r.body.content));
    if((remote.savedAt||0)>=(SET.savedAt||0)){
      ['issuer','reps','rep','terms','clients'].forEach(k=>{if(remote[k]!=null)SET[k]=remote[k];});
      SET.savedAt=remote.savedAt||0;setSaveLocal();
    }else setQueue();   // il locale è più recente: aggiorna GitHub
    setApplyAll();
    if(typeof step!=='undefined'&&step===0)render();
  }catch(e){console.warn('impostazioni da GitHub non lette',e);}
}
function settingsInit(){setLoadLocal();setApplyAll();}
