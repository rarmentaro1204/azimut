/* Configuratore Yacht — modulo "persistence" */
/* ============== LOADERS (price list, images, clients, registry) ============== */
function mkLoaderBtn(id,label,attrs){
  const w=ce('label','');w.id=id+'Btn';
  w.style.cssText='display:inline-flex;align-items:center;gap:6px;background:#292929;border:1px solid #4a4a4a;color:#fff;padding:6px 10px;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer;margin-right:6px';
  w.innerHTML=`<span id="${id}Txt">${label}</span><input ${attrs} style="display:none" id="${id}Input">`;
  return w;
}
function setupLoader(){
  const bar=document.querySelector('.topbar .spacer');
  const wrapList=mkLoaderBtn('xlsx','📂 '+t('load_list'),'type="file" accept=".xlsx,.xls"');
  const wrapImg =mkLoaderBtn('img','🖼 '+t('load_images'),'type="file" accept="image/*" webkitdirectory multiple');
  const wrapCli =mkLoaderBtn('cli','👤 '+t('load_clients'),'type="file" accept=".xlsx,.xls,.csv"');
  const wrapReg =mkLoaderBtn('reg','📒 '+t('load_registry'),'type="file" accept=".xlsx,.xls"');
  const wrapMat =mkLoaderBtn('mat','📦 '+t('load_matrix'),'type="file" accept=".xlsx,.xls"');
  bar.after(wrapReg);bar.after(wrapCli);bar.after(wrapImg);bar.after(wrapMat);bar.after(wrapList);
  // Folder link (auto-load) — only where the File System Access API exists
  if(window.showDirectoryPicker){
    const link=ce('button','');link.id='linkBtn';
    link.style.cssText='display:inline-flex;align-items:center;gap:6px;background:var(--red);border:none;color:#fff;padding:6px 11px;border-radius:6px;font-size:11.5px;font-weight:700;cursor:pointer;margin-right:6px';
    link.innerHTML=`🔗 <span id="linkTxt">${t('link_folder')}</span>`;
    bar.after(link);
    link.onclick=linkFolder;
    const refresh=ce('button','');refresh.id='refreshImgBtn';refresh.title=t('refresh_images');
    refresh.style.cssText='display:inline-flex;align-items:center;gap:4px;background:transparent;border:1px solid var(--line);color:var(--steel);padding:6px 9px;border-radius:6px;font-size:11.5px;cursor:pointer;margin-right:6px';
    refresh.innerHTML='🔄';
    link.after(refresh);
    refresh.onclick=async()=>{ try{await idbSet('imgIndex',null);}catch(_){} if(DIRHANDLE)await loadFromDir(DIRHANDLE); };
  }
  // i pulsanti dati/listini sono nascosti: un solo ingranaggio li mostra quando servono
  [wrapList,wrapMat,wrapImg,wrapCli,wrapReg,$('#linkBtn'),$('#refreshImgBtn')].forEach(e=>{if(e)e.classList.add('data-tool');});
  const gear=ce('button','btn sm');gear.id='dataToolsBtn';gear.textContent='⚙';gear.title='Dati e listini (carica listino, optional, immagini, clienti, registro)';
  gear.style.cssText='background:transparent;border:1px solid #4a4a4a;color:#bbb;padding:6px 9px';
  gear.onclick=()=>document.body.classList.toggle('show-tools');
  bar.after(gear);
  $('#xlsxInput').onchange=handleXlsx;
  $('#imgInput').onchange=handleImages;
  $('#cliInput').onchange=handleClients;
  $('#regInput').onchange=handleRegistry;
  $('#matInput').onchange=handleMatrix;
}
function handleImages(e){
  const files=[...e.target.files].filter(f=>/\.(png|jpe?g|webp|gif)$/i.test(f.name));
  Object.values(IMGCACHE).forEach(u=>{try{URL.revokeObjectURL(u);}catch(_){}});
  IMGMAP={};IMGCACHE={};
  files.forEach(f=>{const base=f.name.replace(/\.[^.]+$/,'');IMGMAP[imgKey(base)]=f;});
  $('#imgTxt').textContent='✓ '+files.length+' '+t('images');
  flash(t('images_loaded').replace('%n',files.length));
  // backfill images for already-selected solutions
  S.solutions.forEach(s=>{if(!s.img){const u=imgUrlForCode(s.code);if(u){s.img=u;ensureImgs(s);if(!s.imgs.length)s.imgs.push(u);}}});
  S.solutions.forEach(s=>s.accessories.forEach(a=>{if(!a.img){const u=imgUrlForCode(a.code);if(u)a.img=u;}}));
  if(step===1||step===2||step===3)render();
}
function handleClients(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{
    try{
      const wb=XLSX.read(ev.target.result,{type:'array'});
      const sheet=wb.Sheets[wb.SheetNames[0]];
      const rows=sheetRows(sheet,['azienda','company','ragione sociale','cliente','nome','name','ragione']);
      if(!rows.length){flash(t('clients_empty'));return;}
      // figure out which header holds what, ONCE, from the keys
      const keys=Object.keys(rows[0]);
      const find=(...subs)=>keys.find(k=>{const kl=k.toLowerCase();return subs.some(s=>kl.includes(s));});
      const findPhone=()=>{
        // prefer office phone, then generic, then alternative
        return find('telefono ufficio','phone office','tel ufficio')||find('telefono','phone','tel ','cellulare','mobile','cell')||keys.find(k=>/tel|phone/i.test(k));
      };
      let companyKey=find('azienda','company','ragione','societ','cliente','account','ditta','denominazione');
      const contactKey=find('contatto','contact','referente','persona','nominativo','incaricato');
      const nameKey=find('nome','name');
      // if no explicit company column, the Nome/Name column IS the company
      if(!companyKey)companyKey=nameKey;
      const phoneKey=findPhone();
      const altPhoneKey=find('alternativ','secondario','mobile','cellulare');
      const emailKey=find('email','e-mail','mail');
      const roleKey=find('ruolo','role','posizione','titolo','qualifica');
      const addrKey=find('indirizzo','address','sede','città','citta','city');
      const g=(r,k)=>k?norm(r[k]):'';
      CLIENTS=rows.map(r=>({
        company:g(r,companyKey),
        contact:contactKey&&contactKey!==companyKey?g(r,contactKey):'',
        role:g(r,roleKey),
        email:g(r,emailKey),
        phone:g(r,phoneKey)||g(r,altPhoneKey),
        address:g(r,addrKey)
      })).filter(c=>c.company);
      if(!CLIENTS.length){flash(t('clients_empty'));return;}
      // keep the raw workbook + detected columns so we can write updates back to the SOURCE file
      CLIENTS_FILE.wb=wb;CLIENTS_FILE.sheetName=wb.SheetNames[0];CLIENTS_FILE.raw=rows;
      CLIENTS_FILE.keys={companyKey,contactKey,roleKey,emailKey,phoneKey,addrKey};
      $('#cliTxt').textContent='✓ '+CLIENTS.length+' '+t('clients');
      flash(t('clients_loaded').replace('%n',CLIENTS.length));
      if(step===0)render();
    }catch(err){console.error(err);flash(t('load_err'));}
  };
  reader.readAsArrayBuffer(file);
}
function parseRegistryRows(buf){
  const wb=XLSX.read(buf,{type:'array'});
  const findSheet=(names)=>{for(const n of wb.SheetNames){if(names.some(x=>n.toLowerCase().includes(x)))return n;}return wb.SheetNames[0];};
  const sheet=wb.Sheets[findSheet(['offert','offer','registro'])];
  const rows=sheetRows(sheet,['progressivo','numero_offerta','numero offerta','prog']);
  const out=rows.map(r=>{
    const g=(...k)=>{for(const key of Object.keys(r)){const kl=key.toLowerCase();if(k.some(x=>kl.includes(x)))return r[key];}return '';};
    return {prog:g('progressivo','prog'),num:g('numero_offerta','numero offerta','offerta'),
      date:g('data','date'),client:g('cliente','client'),rep:g('referente','rep'),
      total:g('totale','total'),
      machine:g('macchina','machine'),
      addedOptionals:g('optional_aggiunti','added_optionals'),note:g('note','notes'),
      status:g('stato'),outcomeDate:g('data_esito'),wonValue:g('valore_vinto'),validity:g('validita')};
  }).filter(r=>r.prog||r.num);
  // dettaglio macchine per offerta (foglio "Righe"): serve alle statistiche macchine della dashboard
  const sr=wb.SheetNames.find(n=>/righe|lines|dettaglio/i.test(n));
  if(sr){
    const by={};
    sheetRows(wb.Sheets[sr],['numero_offerta']).forEach(x=>{
      const num=String(x.Numero_Offerta||'').trim();if(!num)return;
      (by[num]=by[num]||[]).push({code:String(x.Codice||''),name:String(x.Nome||''),category:String(x.Categoria||''),
        qty:Number(x.Qta)||1,value:x.Valore_EUR===''?null:Number(x.Valore_EUR),pkg:Number(x.Pacchetto)||1,won:/^s/i.test(String(x.Venduta||''))});
    });
    out.forEach(r=>{const k=String(r.num).trim();if(by[k])r.lines=by[k];});
  }
  return out;
}
function handleRegistry(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{
    try{
      REGISTRY.rows=parseRegistryRows(ev.target.result);persistRegistryLocal();
      REGISTRY.fileName=file.name;
      $('#regTxt').textContent='✓ '+t('registry');
      applyNextOfferNumber();
      flash(t('registry_loaded').replace('%n',nextProgressivo()));
      if(step===0||step===3)render();
    }catch(err){console.error(err);flash(t('load_err'));}
  };
  reader.readAsArrayBuffer(file);
}
// re-read the shared registry file to see offers others may have added meanwhile
async function reloadRegistry(){
  try{
    if(REGISTRY.fileHandle&&REGISTRY.fileHandle.getFile){
      const f=await REGISTRY.fileHandle.getFile();
      REGISTRY.rows=parseRegistryRows(await f.arrayBuffer());
      return true;
    }
  }catch(e){console.error(e);}
  return false;
}
async function ensureRegistryHandle(){
  if(REGISTRY.fileHandle&&REGISTRY.fileHandle.createWritable)return true;
  if(DIRHANDLE&&await ensurePerm(DIRHANDLE)){
    try{REGISTRY.fileHandle=await DIRHANDLE.getFileHandle(REGISTRY.fileName||'Registro_Offerte_YACHT_2026.xlsx',{create:true});return true;}catch(e){console.error(e);}
  }
  return false;
}
function buildRegistryBlob(){
  const header=['Progressivo','Numero_Offerta','Data','Cliente','Referente','Totale_EUR','Macchina_Offerta','Optional_Aggiunti','Note','Stato','Data_Esito','Valore_Vinto','Validita_Giorni'];
  const aoa=[['FERRETTI YACHTS — REGISTRO OFFERTE 2026'],[],header];
  REGISTRY.rows.filter(r=>!r.demo).forEach(r=>aoa.push([r.prog,r.num,r.date,r.client,r.rep,r.total,r.machine||'',r.addedOptionals||'',r.note,
    ({won:'Vinta',lost:'Persa'})[rowStatus(r)]||'Aperta',r.outcomeDate||'',rowStatus(r)==='won'?rowWonValue(r):'',r.validity||'']));
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Offerte');
  const rig=[['Numero_Offerta','Pacchetto','Codice','Nome','Categoria','Qta','Valore_EUR','Venduta']];
  REGISTRY.rows.filter(r=>!r.demo).forEach(r=>rowLines(r).forEach(l=>rig.push([r.num,l.pkg||1,l.code,l.name,l.category||'',l.qty||1,l.value==null?'':l.value,l.won?'SI':'NO'])));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rig),'Righe');
  return XLSX.write(wb,{bookType:'xlsx',type:'array'});
}
function downloadRegistry(){
  const data=buildRegistryBlob();
  const blob=new Blob([data],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const a=ce('a');a.href=URL.createObjectURL(blob);a.download=REGISTRY.fileName||'Registro_Offerte_YACHT_2026.xlsx';a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),3000);
}
async function writeRegistryEntry(){
  const mkNum=p=>BRAND.offerPrefix+String(yr).slice(2)+'-'+String(p).padStart(3,'0');
  await ensureRegistryHandle();
  if(GH.ok)await ghRefresh();                          // numero progressivo globale (tutti i commerciali)
  const linked=await reloadRegistry();               // pull colleagues' latest numbers if the file is shared
  // a recalled offer already carries its own "<original>_REVn" number (see doRecall) —
  // keep it as-is instead of assigning a fresh progressive one
  const isRevision=!!S.isRevisionOffer||/_REV\d+$/i.test(String(S.offerNum||''));
  let prog,num,used=new Set(REGISTRY.rows.map(r=>String(r.num).trim()));
  if(isRevision){
    num=S.offerNum;
    const m=String(num).match(/^[A-Z]+-\d{2}-(\d+)_REV\d+$/i);
    prog=m?parseInt(m[1],10):nextProgressivo();
  }else{
    // assign the first free number based on the freshest data
    prog=nextProgressivo();
    num=mkNum(prog);
    while(used.has(num)){prog++;num=mkNum(prog);}
  }
  const {grand}=lineTotals();
  const machineSummary=S.solutions.map(s=>`${s.code||''} (${s.name||''})${s.qty>1?' x'+s.qty:''}`).join(' | ');
  const addedOptSummary=S.solutions.map(s=>{
    const acc=(s.accessories||[]).filter(a=>a.code||a.desc);
    return acc.length?`[${s.code}] `+acc.map(a=>a.desc?`${a.code||''} - ${a.desc}`.replace(/^ - /,''):a.code).join('; '):'';
  }).filter(Boolean).join(' || ');
  const row={prog,num,date:S.date,client:S.client,rep:S.rep.name,total:Number(grand.toFixed(2)),
    machine:machineSummary,addedOptionals:addedOptSummary,note:'',validity:String(S.validity||'30'),lang:LANG,status:'open',outcomeDate:'',wonValue:'',lines:offerLinesFromState()};
  REGISTRY.rows.push(row);S.offerNum=num;persistRegistryLocal();
  let ghSaved=false;
  const snapshot={__yachtOffer:true,baseOfferNum:String(num).replace(/_REV\d+$/i,''),savedAt:new Date().toISOString(),lang:LANG,state:JSON.parse(JSON.stringify(S))};
  if(GH.ok){
    try{
      const r=await ghSaveOffer(row,snapshot);ghSaved=!!r.saved;num=row.num;prog=row.prog;S.offerNum=num;persistRegistryLocal();
    }catch(e){console.error(e);flash('GitHub: offerta NON salvata ('+e.message+')');}
  }
  rememberSnapshotLocal(num,snapshot);                 // copia locale: l'offerta si può richiamare anche senza GitHub
  let saved=await writeRegistryBack();
  if(!saved&&ghSaved)saved=true;                       // salvata su GitHub anche senza cartella collegata
  if(!saved) saved=await ensureRegistryHandleAndWrite();
  // guard against a same-moment race: re-read; if our number ended up duplicated, take the next free one and rewrite
  if(saved&&linked){
    try{
      if(await reloadRegistry()){
        const dup=REGISTRY.rows.filter(r=>String(r.num).trim()===num).length;
        const mine=REGISTRY.rows.some(r=>String(r.num).trim()===num&&String(r.client).trim()===String(S.client).trim());
        if(dup>1||!mine){
          used=new Set(REGISTRY.rows.map(r=>String(r.num).trim()));
          if(isRevision){
            const base=String(S.offerNum).replace(/_REV\d+$/i,'');
            let rev=1;while(used.has(base+'_REV'+rev))rev++;
            num=base+'_REV'+rev;
          }else{
            prog=nextProgressivo();num=mkNum(prog);while(used.has(num)){prog++;num=mkNum(prog);}
          }
          row.prog=prog;row.num=num;S.offerNum=num;REGISTRY.rows.push(row);persistRegistryLocal();
          await writeRegistryBack();
        }
      }
    }catch(_){}
  }
  return {saved,num,row,ghSaved};
}
// single button: generate + save the PDF, register the offer number in the registry file,
// persist the client's data, then reset the form for the next offer (only after everything succeeded)
// reopen a previously saved offer by choosing its PDF from the "Offerte fatte" folder;
// the structured data needed to restore all fields is read from the companion file saved alongside it (same name)
async function recallOffer(){
  let dir;
  try{ dir=await getSaveDir(); }catch(e){ flash(t('recall_err')); return; }
  const pdfs=[];
  try{
    for await(const [name,entry] of dir.entries()){
      if(entry.kind==='file'&&/\.pdf$/i.test(name))pdfs.push(name);
    }
  }catch(e){ console.error(e); flash(t('recall_err')); return; }
  if(!pdfs.length){ flash(t('recall_none')); return; }
  pdfs.sort((a,b)=>b.localeCompare(a));
  showRecallPicker(pdfs,dir);
}
function showRecallPicker(pdfs,dir){
  const old=document.getElementById('recallOverlay');if(old)old.remove();
  const o=document.createElement('div');
  o.id='recallOverlay';o.className='load-overlay';o.style.display='flex';
  o.innerHTML=`<div class="load-card" style="max-height:74vh;overflow:auto;text-align:left">
    <div class="load-title">${t('recall_offer')}</div>
    <div class="load-status">${t('recall_pick_hint')}</div>
    <input type="text" id="recallSearch" class="search" placeholder="${esc(t('recall_search_ph'))}" style="margin-top:10px" autocomplete="off">
    <div id="recallList" style="display:flex;flex-direction:column;gap:6px;margin-top:10px;max-height:44vh;overflow:auto"></div>
    <button class="btn ghost" id="recallCancel" style="margin-top:14px;width:100%">${t('cancel')}</button>
  </div>`;
  document.body.appendChild(o);
  const list=o.querySelector('#recallList');
  function renderList(filter){
    const q=(filter||'').trim().toLowerCase();
    const shown=q?pdfs.filter(n=>n.toLowerCase().includes(q)):pdfs;
    list.innerHTML='';
    if(!shown.length){
      const d=document.createElement('div');d.style.cssText='color:#8592a8;font-size:12.5px;padding:8px 2px';
      d.textContent=t('recall_no_match');list.appendChild(d);return;
    }
    shown.forEach(name=>{
      const b=document.createElement('button');
      b.className='btn nav';b.style.textAlign='left';
      b.textContent=name.replace(/\.pdf$/i,'');
      b.onclick=()=>{o.remove();doRecall(name,dir);};
      list.appendChild(b);
    });
  }
  renderList('');
  const search=o.querySelector('#recallSearch');
  search.oninput=()=>renderList(search.value);
  search.focus();
  o.querySelector('#recallCancel').onclick=()=>o.remove();
}
// Shared restore logic: takes the parsed contents of a saved offer .json file and
// applies it to the live state S — used both by the folder-based recall (doRecall)
// and by the direct drag&drop / file-picker upload (restoreOfferFromUpload).
async function restoreOfferData(data,forcedBaseNum){
  if(!data||!data.__yachtOffer||!data.state){ hideLoader(); flash(t('recall_invalid')); return false; }
  const st=data.state;
  Object.keys(S).forEach(k=>delete S[k]);
  Object.assign(S,st);
  // lingua dell'offerta: il documento si riapre nella stessa lingua in cui era stato fatto
  if(data.lang&&I18N[data.lang]){LANG=data.lang;try{$('#langSel').value=LANG;document.documentElement.lang=LANG;}catch(_){}}
  // stored photos were session-only blob URLs and don't survive — clear them, then try to
  // re-fetch them by code from the currently linked images folder (same lookup used on folder link)
  S.solutions=(st.solutions||[]).map(s=>({...s,img:'',imgs:[],accessories:(s.accessories||[]).map(a=>({...a,img:''}))}));
  S.solutions.forEach(s=>{
    const u=imgUrlForCode(s.code);
    if(u){s.img=u;ensureImgs(s);if(!s.imgs.length)s.imgs.push(u);}
    s.accessories.forEach(a=>{const au=imgUrlForCode(a.code);if(au)a.img=au;});
  });
  const baseNum=String(forcedBaseNum||data.baseOfferNum||st.offerNum||'').replace(/_REV\d+$/i,'');
  try{ await ensureRegistryHandle(); }catch(_){}
  let maxRev=0;
  try{
    await reloadRegistry();
    const escNum=baseNum.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const re=new RegExp('^'+escNum+'_REV(\\d+)$','i');
    REGISTRY.rows.forEach(r=>{const m=String(r.num||'').match(re);if(m)maxRev=Math.max(maxRev,parseInt(m[1],10));});
  }catch(_){}
  S.offerNum=baseNum+'_REV'+(maxRev+1);
  S.isRevisionOffer=true;
  step=0;maxReached=0;
  hideLoader();
  flash(t('offer_recalled').replace('%n',S.offerNum));
  render();
  return true;
}
// upload path: read a .json file the user drops or picks directly, no folder/PDF matching needed
// pulls just the "DPC-26-164" prefix out of a saved offer's file name, ignoring any
// existing _REVn suffix or trailing client-name segment — this is always taken as the
// source of truth for which offer is being revised, instead of trusting a field stored
// inside the JSON payload (which could in principle be stale or mismatched)
function extractBaseNumFromFilename(name){
  const base=String(name||'').replace(/\.(json|pdf)$/i,'');
  const m=base.match(/^([A-Z]+-\d{2}-\d+)/i);
  return m?m[1]:'';
}
function restoreOfferFromUpload(file){
  showLoader(t('recall_offer'));setLoader(-1,t('reading_folder'));
  const forcedBaseNum=extractBaseNumFromFilename(file.name);
  const r=new FileReader();
  r.onload=async ev=>{
    let data;
    try{ data=JSON.parse(ev.target.result); }
    catch(_){ hideLoader(); flash(t('recall_invalid')); return; }
    await restoreOfferData(data,forcedBaseNum);
  };
  r.onerror=()=>{ hideLoader(); flash(t('recall_err')); };
  r.readAsText(file);
}
function openRecallUploadModal(){
  const old=document.getElementById('recallUploadOverlay');if(old)old.remove();
  const o=document.createElement('div');
  o.id='recallUploadOverlay';o.className='load-overlay';o.style.display='flex';
  o.innerHTML=`<div class="load-card" style="text-align:left">
    <div class="load-title">${t('recall_upload')}</div>
    <div class="load-status">${t('recall_upload_hint')}</div>
    <div id="recallDrop" style="margin-top:14px;border:2px dashed var(--line);border-radius:10px;padding:32px 12px;text-align:center;color:#8592a8;cursor:pointer;font-size:13px">
      ${t('recall_upload_drop')}
      <input type="file" accept="application/json,.json" id="recallFileInput" style="display:none">
    </div>
    <button class="btn ghost" id="recallUploadCancel" style="margin-top:14px;width:100%">${t('cancel')}</button>
  </div>`;
  document.body.appendChild(o);
  const drop=o.querySelector('#recallDrop');
  const fileInput=o.querySelector('#recallFileInput');
  drop.onclick=()=>fileInput.click();
  fileInput.onchange=e=>{const f=e.target.files[0];if(f){o.remove();restoreOfferFromUpload(f);}};
  drop.ondragover=e=>{e.preventDefault();drop.style.borderColor='var(--red)';drop.style.color='var(--red)';};
  drop.ondragleave=()=>{drop.style.borderColor='var(--line)';drop.style.color='#8592a8';};
  drop.ondrop=e=>{
    e.preventDefault();
    const f=e.dataTransfer.files&&e.dataTransfer.files[0];
    if(f){o.remove();restoreOfferFromUpload(f);}
  };
  o.querySelector('#recallUploadCancel').onclick=()=>o.remove();
}
async function doRecall(pdfName,dir){
  const base=pdfName.replace(/\.pdf$/i,'');
  showLoader(t('recall_offer'));setLoader(-1,t('reading_folder'));
  try{
    let jsonHandle;
    try{ jsonHandle=await dir.getFileHandle(base+'.json'); }
    catch(_){ hideLoader(); flash(t('recall_no_data').replace('%n',base)); return; }
    const file=await jsonHandle.getFile();
    const data=JSON.parse(await file.text());
    await restoreOfferData(data,extractBaseNumFromFilename(pdfName));
  }catch(e){ console.error(e); hideLoader(); flash(t('recall_err')); }
}
async function saveOfferComplete(){
  const btn=document.getElementById('btnSaveAll');
  if(btn){btn.disabled=true;btn.textContent=''+t('saving_all');}
  try{
    let pdfOk=false, pdfBlob=null, xlsxBlob=null;
    try{ xlsxBlob=await buildOfferXlsx(); }catch(e){ console.warn('Excel non generato',e); }   // prima del salvataggio: poi lo stato si azzera
    // con GitHub collegato il PDF va direttamente nella repo (nessuna richiesta di cartella)
    if(GH.ok){ try{pdfBlob=await buildPdfBlob({scale:1.5,q:0.72});}catch(e){console.error(e);} }
    else if(window.showDirectoryPicker){
      try{ const blob=await buildPdfBlob(); pdfBlob=blob; const dir=await getSaveDir();
        const fh=await dir.getFileHandle(suggestedFilename()+'.pdf',{create:true});
        const w=await fh.createWritable(); await w.write(blob); await w.close();
        pdfOk=true;
        if(xlsxBlob){try{const fx=await dir.getFileHandle(suggestedFilename()+'.xlsx',{create:true});const wx=await fx.createWritable();await wx.write(xlsxBlob);await wx.close();}catch(e){console.error('xlsx save failed',e);}}
        try{
          const base=String(S.offerNum||'').replace(/_REV\d+$/i,'');
          const snapshot={__yachtOffer:true,baseOfferNum:base,savedAt:new Date().toISOString(),state:JSON.parse(JSON.stringify(S))};
          const fh2=await dir.getFileHandle(suggestedFilename()+'.json',{create:true});
          const w2=await fh2.createWritable(); await w2.write(JSON.stringify(snapshot)); await w2.close();
        }catch(e){console.error('snapshot save failed',e);}
      }catch(e){ if(!(e&&e.name==='AbortError')) console.error(e); }
    }
    const {saved:regOk,num,row:regRow,ghSaved}=await writeRegistryEntry();
    if(ghSaved&&pdfBlob){ try{pdfOk=(await ghUploadPdf(regRow,pdfBlob))||pdfOk;}catch(e){console.error(e);} }
    if(ghSaved&&xlsxBlob){ try{await ghUploadFile(regRow,xlsxBlob,'.xlsx','Excel');}catch(e){console.error(e);} }
    let clientRes={target:'none'};
    if(regOk){ try{clientRes=await saveClientIfNew();}catch(_){} try{settingsAfterSave();}catch(e){console.warn(e);} }
    if(regOk){
      const parts=[];
      if(GH.ok){
        parts.push(ghSaved?t('saved_gh').replace('%n',num):t('gh_fail').replace('%n',num));
        parts.push(pdfOk?t('pdf_gh_ok'):t('pdf_gh_err'));
      }else{
        parts.push(t('offer_saved_file').replace('%n',num));
        parts.push(pdfOk?t('pdf_saved'):t('pdf_save_err'));
      }
      flash(parts.join(' · '),GH.ok?5200:undefined);
      resetOffer();
    } else {
      flash(GH.ok?t('gh_fail').replace('%n',S.offerNum):t('gh_not_linked'),5200);
      applyNextOfferNumber();
      render();
    }
  } finally { if(btn){btn.disabled=false;btn.textContent=''+t('save_all');} }
}
async function registerOffer(){
  const {saved,num}=await writeRegistryEntry();
  if(saved){
    flash(t('offer_saved_file').replace('%n',num));
    try{await saveClientIfNew();}catch(_){}
    resetOffer();
  } else {
    flash(t('offer_not_saved'));
    applyNextOfferNumber();
    render();
  }
}
function resetOffer(){
  S.offerNum=BRAND.offerPrefix+String(yr).slice(2)+'-001';
  S.date=new Date().toLocaleDateString('it-IT');
  S.client='';S.contact='';S.role='';S.phone='';S.email='';S.subject=t('def_subject');S.intro='';S.isRevisionOffer=false;
  S.app={use:'',area:'',guests:'',crew:'',flag:'',port:'',interior:'',notes:''};
  S.solutions=[];S.discount=0;S.discount2=0;S.discount3=0;
  S.validity='30';S.lead='';S.warranty='';S.listino='EUR';PSTEP=0;PCHOSEN=false;curCat=null;S.cur='EUR';S.fxRate=1;S.curShow=false;delete S.net;
  S.delivery=t('def_delivery');S.packaging=t('def_packaging');S.payment=t('def_payment');
  S.exclusions='';S.notes='';
  applyNextOfferNumber();
  step=0;maxReached=0;
  render();
}
// persist newly-entered client contact data (contact/role/phone/email) into a dedicated file in the linked folder
// write / overwrite the client's data directly into the SOURCE contacts file (xlsx)
function coreName(s){
  return String(s||'').trim().toLowerCase()
    .replace(/\b(s\.?r\.?l\.?|s\.?p\.?a\.?|s\.?a\.?s\.?|s\.?n\.?c\.?|s\.?c\.?a\.?r\.?l\.?|ltd\.?|inc\.?|gmbh|sarl|sl|nv|bv)\b/g,'')
    .replace(/[.,'"&\-]/g,' ').replace(/\s+/g,' ').trim();
}
async function saveClientToSource(){
  const company=(S.client||'').trim();if(!company)return {ok:false,reason:'no_company'};
  const norm2=s=>String(s||'').trim().toLowerCase();
  const incoming={company,contact:(S.contact||'').trim(),role:(S.role||'').trim(),phone:(S.phone||'').trim(),email:(S.email||'').trim()};
  const target=coreName(company);
  // update in-memory list for the autocomplete (exact match first, then fuzzy on the "core" business name)
  let c=CLIENTS.find(x=>norm2(x.company)===norm2(company)) || CLIENTS.find(x=>coreName(x.company)===target && target);
  if(!c){CLIENTS.push(incoming);} else {['contact','role','phone','email'].forEach(k=>{if(incoming[k])c[k]=incoming[k];});}
  if(!(CLIENTS_FILE.handle&&CLIENTS_FILE.handle.createWritable&&CLIENTS_FILE.raw&&CLIENTS_FILE.wb))return {ok:false,reason:'not_linked'};
  try{
    if(!(await ensurePerm(CLIENTS_FILE.handle)))return {ok:false,reason:'no_permission'};
    const K=CLIENTS_FILE.keys||{};
    const ck=K.companyKey||'Azienda', contactK=K.contactKey||'Referente', roleK=K.roleKey||'Ruolo',
          emailK=K.emailKey||'Email', phoneK=K.phoneKey||'Telefono';
    // exact match first; fall back to a fuzzy match ignoring legal-form suffixes/punctuation (e.g. "Violeta" ↔ "Violeta S.r.l.")
    let row=CLIENTS_FILE.raw.find(r=>norm2(r[ck])===norm2(company));
    if(!row && target) row=CLIENTS_FILE.raw.find(r=>coreName(r[ck])===target);
    const isNew=!row;
    if(!row){row={};row[ck]=company;CLIENTS_FILE.raw.push(row);}
    if(incoming.contact)row[contactK]=incoming.contact;
    if(incoming.role)row[roleK]=incoming.role;
    if(incoming.email)row[emailK]=incoming.email;
    if(incoming.phone)row[phoneK]=incoming.phone;
    const ws=XLSX.utils.json_to_sheet(CLIENTS_FILE.raw);
    CLIENTS_FILE.wb.Sheets[CLIENTS_FILE.sheetName]=ws;
    if(!CLIENTS_FILE.wb.SheetNames.includes(CLIENTS_FILE.sheetName))CLIENTS_FILE.wb.SheetNames.push(CLIENTS_FILE.sheetName);
    const out=XLSX.write(CLIENTS_FILE.wb,{bookType:'xlsx',type:'array'});
    const w=await CLIENTS_FILE.handle.createWritable();
    await w.write(new Blob([out]));await w.close();
    return {ok:true,isNew};
  }catch(e){console.error(e);return {ok:false,reason:'write_error'};}
}
async function saveClientIfNew(){
  // prefer writing straight into the source contacts file; fall back to a side CSV if it isn't linked/writable
  const res=await saveClientToSource();
  if(res.ok) return {target:'source', isNew:res.isNew};
  const company=(S.client||'').trim();if(!company)return {target:'none'};
  const norm=s=>String(s||'').trim().toLowerCase();
  const incoming={company,contact:(S.contact||'').trim(),role:(S.role||'').trim(),phone:(S.phone||'').trim(),email:(S.email||'').trim()};
  if(!(DIRHANDLE&&await ensurePerm(DIRHANDLE)))return {target:'none'};
  try{
    const fh=await DIRHANDLE.getFileHandle('Contatti_da_offerte_YACHT.csv',{create:true});
    const map={};
    try{const f=await fh.getFile();const txt=await f.text();
      txt.replace(/^\ufeff/,'').split(/\r?\n/).slice(1).forEach(line=>{if(!line.trim())return;const p=line.split(';');map[norm(p[0])]={company:p[0]||'',contact:p[1]||'',role:p[2]||'',phone:p[3]||'',email:p[4]||''};});
    }catch(_){}
    map[norm(company)]=incoming;
    const header='Nome;Referente;Ruolo;Telefono;Email';
    const rows=Object.values(map).map(x=>[x.company,x.contact,x.role,x.phone,x.email].map(v=>String(v||'').replace(/;/g,',')).join(';'));
    const w=await fh.createWritable();await w.write('\ufeff'+header+'\n'+rows.join('\n'));await w.close();
    return {target:'csv'};
  }catch(e){console.error(e);return {target:'none'};}
}

/* ---- File System Access: link a folder once, auto-load & auto-save ---- */
