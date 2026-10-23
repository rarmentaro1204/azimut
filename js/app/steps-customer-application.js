/* Configuratore Yacht — modulo "steps-customer-application" */
/* ============== RENDER STEPPER ============== */
function renderStepper(){
  const sp=$('#stepper');sp.innerHTML='';
  STEPS.forEach((s,i)=>{
    const d=ce('div','step'+(i===step?' active':'')+(i<step?' done':'')+(i<=maxReached?' clickable':''));
    d.innerHTML=`<span class="n">${i<step?'✓':i+1}</span>${t('step_'+s)}`;
    if(i<=maxReached)d.onclick=()=>{step=i;render();};
    sp.appendChild(d);
  });
}
let maxReached=0;

/* ============== STEP 1: CUSTOMER ============== */
function stepCustomer(){
  const v=$('#view');
  ghRefreshSoon();
  const repOpts=DATA.reps.map(r=>`<option value="${esc(r.name)}">`).join('');
  v.innerHTML=`
  <div class="card">
    <h2>${t('step_customer')}</h2><p class="hint">${t('hint_customer')}</p>
    ${typeof hsBannerHtml==='function'?hsBannerHtml():''}
    <button class="btn prim" id="btnOffers" style="margin-bottom:12px;margin-right:8px">${LANG==='it'?'Richiama un\'offerta':'Recall an offer'}</button>
    ${window.showDirectoryPicker?`<button class="btn ghost" id="btnRecall" style="margin-bottom:12px">${t('recall_offer')}</button>`:''}
    <button class="btn ghost" id="btnRecallUpload" style="margin-bottom:12px">${t('recall_upload')}</button>
    <div class="grid g3">
      <label class="fld">${t('f_rep')}<input id="i_rep" list="repList" value="${esc(S.rep.name)}" autocomplete="off"><datalist id="repList">${repOpts}</datalist></label>
      <label class="fld">${t('f_repmail')}<input id="i_repmail" value="${esc(S.rep.email)}"></label>
      <label class="fld">${t('f_repphone')}<input id="i_repphone" value="${esc(S.rep.phone)}"></label>
    </div>
    <details class="issuer" style="margin-top:16px"><summary style="cursor:pointer;font-weight:700;font-size:12.5px;color:#4a4a4a">${t('f_issuer')}</summary>
      <div class="grid g3" style="margin-top:10px">
        ${ISSUER_FIELDS.map(([k,lbl])=>`<label class="fld">${t(lbl)}<input data-issuer="${k}" value="${esc(issuerGet(k))}"></label>`).join('')}
      </div>
    </details>
    <div class="grid g3" style="margin-top:14px">
      <label class="fld">${t('f_offernum')}<input id="i_offernum" value="${esc(S.offerNum)}"></label>
      <label class="fld">${t('f_date')}<input id="i_date" value="${esc(S.date)}"></label>
      <label class="fld">${t('f_subject')}<input id="i_subject" value="${esc(S.subject)}" placeholder="${esc(t('ph_subject'))}"></label>
    </div>
    <div class="grid g2" style="margin-top:14px">
      <label class="fld" style="position:relative">${t('f_client')} ${CLIENTS.length?'<span style="color:var(--muted);font-weight:400">· '+CLIENTS.length+' '+t('clients')+'</span>':''}
        <input id="i_client" value="${esc(S.client)}" autocomplete="off" placeholder="${CLIENTS.length?esc(t('ph_client_search')):''}">
        <div id="cliSugg" style="position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid var(--line);border-radius:8px;box-shadow:0 8px 20px rgba(0,0,0,.12);z-index:20;max-height:230px;overflow:auto;display:none"></div>
      </label>
      <label class="fld">${t('f_contact')}<input id="i_contact" value="${esc(S.contact)}"></label>
      <label class="fld">${t('f_role')}<input id="i_role" value="${esc(S.role)}"></label>
      <label class="fld">${t('f_cphone')}<input id="i_phone" value="${esc(S.phone)}"></label>
      <label class="fld">${t('f_cemail')}<input id="i_email" value="${esc(S.email)}"></label>
    </div>
    <label class="fld" style="margin-top:14px">${t('f_intro')}
      <textarea id="i_intro" placeholder="${esc(t('intro_default'))}">${esc(S.intro)}</textarea></label>
  </div>`;
  // referente commerciale: tutto modificabile; se il nome coincide con un commerciale in elenco ne propone mail e telefono
  S.rep=Object.assign({name:'',email:'',phone:''},S.rep);
  $('#i_rep').oninput=e=>{S.rep.name=e.target.value;const r=DATA.reps.find(x=>x.name===e.target.value);if(r){S.rep.email=r.email||S.rep.email;S.rep.phone=r.phone||S.rep.phone;$('#i_repmail').value=S.rep.email;$('#i_repphone').value=S.rep.phone;}};
  $('#i_repmail').oninput=e=>{S.rep.email=e.target.value;};
  $('#i_repphone').oninput=e=>{S.rep.phone=e.target.value;};
  ['#i_rep','#i_repmail','#i_repphone'].forEach(id=>$(id).addEventListener('change',()=>{if(typeof repRemember==='function')repRemember();}));
  v.querySelectorAll('[data-issuer]').forEach(inp=>inp.oninput=e=>issuerSet(inp.dataset.issuer,e.target.value));
  if($('#btnOffers'))$('#btnOffers').onclick=openOfferList;
  if($('#btnRecall'))$('#btnRecall').onclick=recallOffer;
  if($('#btnRecallUpload'))$('#btnRecallUpload').onclick=openRecallUploadModal;
  const bind=(id,key)=>{$('#'+id).oninput=e=>S[key]=e.target.value;};
  bind('i_offernum','offerNum');bind('i_date','date');bind('i_subject','subject');
  bind('i_contact','contact');bind('i_role','role');
  bind('i_phone','phone');bind('i_email','email');bind('i_intro','intro');
  // client field with autocomplete from loaded clients file
  const ci=$('#i_client'), sg=$('#cliSugg');
  let hsT;
  function showSugg(){
    if(typeof HS!=='undefined'&&HS.active&&HS.apiBase){   // dati dal CRM HubSpot
      clearTimeout(hsT);hsT=setTimeout(async()=>{
        const res=await hsSearchClients(ci.value.trim());if(!res)return;
        CLIENTS=res;sg.innerHTML='';fillSugg(res);},200);return;}
    fillSugg(CLIENTS);
  }
  function fillSugg(all){
    if(!all.length){sg.style.display='none';return;}
    const q=ci.value.trim().toLowerCase();
    let list=all;
    if(q&&!(typeof HS!=='undefined'&&HS.active&&HS.apiBase))list=all.filter(c=>(c.company+' '+c.contact+' '+c.email).toLowerCase().includes(q));
    list=list.slice(0,40);
    if(!list.length){sg.style.display='none';return;}
    sg.innerHTML=list.map((c,i)=>`<div data-ci="${CLIENTS.indexOf(c)}" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #f0f2f5;font-size:13px">
      <b>${esc(c.company)}</b>${c.contact?' · '+esc(c.contact):''}${c.email?'<br><span style="color:#6f6f6f;font-size:11.5px">'+esc(c.email)+'</span>':''}</div>`).join('');
    sg.style.display='block';
    sg.querySelectorAll('[data-ci]').forEach(d=>{
      d.onmousedown=ev=>{ev.preventDefault();const c=CLIENTS[+d.dataset.ci];
        S.client=c.company;S.contact=c.contact||S.contact;S.role=c.role||S.role;
        S.email=c.email||S.email;S.phone=c.phone||S.phone;
        sg.style.display='none';render();};
    });
  }
  ci.oninput=e=>{S.client=e.target.value;showSugg();};
  ci.onfocus=showSugg;
  ci.onblur=()=>setTimeout(()=>{if(sg)sg.style.display='none';},150);
}

const APP_KEYS=['use','area','guests','crew','flag','port','interior','notes'];
/* ============== STEP 2: APPLICATION ============== */
function stepApplication(){
  const v=$('#view');
  // offers recalled from older files may lack some application fields: make sure all exist
  S.app=Object.assign({use:'',area:'',guests:'',crew:'',flag:'',port:'',interior:'',notes:''},S.app||{});
  const f=(k,ph)=>`<label class="fld">${t('a_'+k)}<input id="a_${k}" value="${esc(S.app[k])}" placeholder="${esc(ph||'')}"></label>`;
  v.innerHTML=`
  <div class="card">
    <h2>${t('step_application')}</h2><p class="hint">${t('hint_application')}</p>
    <div class="grid g3">
      ${f('use','Privato / charter')}${f('area','es. Mediterraneo occidentale')}${f('guests','n. ospiti')}
      ${f('crew','n. membri')}${f('flag','es. Italia')}${f('port','porto / cantiere')}
      ${f('interior','Classico / Contemporaneo')}
    </div>
    <label class="fld" style="margin-top:14px">${t('a_notes')}<textarea id="a_notes">${esc(S.app.notes)}</textarea></label>
  </div>`;
  APP_KEYS
    .forEach(k=>$('#a_'+k).oninput=e=>S.app[k]=e.target.value);
}
