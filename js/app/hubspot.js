/* Configuratore Yacht — modulo "hubspot": il passo 1 (Cliente) prende i dati dal CRM HubSpot.
   Il configuratore gira in un iframe aperto dalla scheda sul Deal. Contratto (versione 1):
     la scheda HubSpot invia al configuratore, con postMessage, un oggetto
       { source:'yacht-configurator', v:1, type:'context', payload:{ portalId, deal:{id,name}, company:{id,name},
         contact:{id,name,role,email,phone}, owner:{name,email,phone}, apiBase, token } }
     `token` è una sessione a scadenza breve emessa dal backend del cliente (mai il token HubSpot);
     `apiBase` è l'indirizzo del backend del cliente, usato per cercare clienti e salvare sul Deal.
   Sicurezza: si accettano messaggi solo da origini HubSpot (elenco sotto) e solo dalla finestra che incornicia la pagina;
   ogni valore è ridotto a testo semplice e lunghezza limitata prima di toccare lo stato. */
const HS={
  active:false, ctx:null, apiBase:'', token:'',
  origins:['https://app.hubspot.com','https://app-eu1.hubspot.com','https://app-na2.hubspot.com','https://app.hubspotqa.com']
};
function hsOriginOk(o){
  if(HS.origins.includes(o))return true;
  return /^(localhost|127\.0\.0\.1)$/.test(location.hostname)&&/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);   // solo in sviluppo locale
}
function hsStr(v,n){return String(v==null?'':v).replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,n||200);}
function hsApiBaseOk(u){try{const x=new URL(u);return x.protocol==='https:'||(x.protocol==='http:'&&/^(localhost|127\.0\.0\.1)$/.test(x.hostname));}catch(_){return false;}}
function hsApply(p){
  if(!p||typeof p!=='object')return false;
  const co=p.company||{},ct=p.contact||{},ow=p.owner||{},dl=p.deal||{};
  HS.ctx={portalId:hsStr(p.portalId,20),dealId:hsStr(dl.id,30),dealName:hsStr(dl.name,150),companyId:hsStr(co.id,30),contactId:hsStr(ct.id,30)};
  if(hsApiBaseOk(p.apiBase)&&typeof p.token==='string'&&p.token.length<4096){HS.apiBase=p.apiBase.replace(/\/+$/,'');HS.token=p.token;}
  if(co.name)S.client=hsStr(co.name);
  if(ct.name)S.contact=hsStr(ct.name);
  if(ct.role)S.role=hsStr(ct.role);
  if(ct.email)S.email=hsStr(ct.email,120);
  if(ct.phone)S.phone=hsStr(ct.phone,40);
  if(ow.name)S.rep=Object.assign({name:'',email:'',phone:''},S.rep,{name:hsStr(ow.name),email:hsStr(ow.email,120),phone:hsStr(ow.phone,40)});
  if(dl.name&&(!S.subject||S.subject===t('def_subject')))S.subject=hsStr(dl.name,150);
  S.hubspot=Object.assign({},HS.ctx);                 // salvato con l'offerta: serve a riportare il risultato sul Deal giusto
  HS.active=true;
  if(typeof step!=='undefined'&&step===0&&typeof render==='function')render();
  return true;
}
window.addEventListener('message',ev=>{
  if(!hsOriginOk(ev.origin)||ev.source!==window.parent)return;
  const d=ev.data;
  if(d&&d.source==='yacht-configurator'&&d.v===1&&d.type==='context')hsApply(d.payload);
});
// ricerca clienti nel CRM (autocompletamento del passo 1): il backend del cliente interroga HubSpot, qui non passa nessun token HubSpot
async function hsSearchClients(q){
  if(!HS.active||!HS.apiBase||!HS.token)return null;
  try{
    const r=await fetch(HS.apiBase+'/clients?q='+encodeURIComponent(q),{headers:{Authorization:'Bearer '+HS.token},cache:'no-store'});
    if(!r.ok)return null;
    const j=await r.json();
    return (Array.isArray(j.clients)?j.clients:[]).slice(0,40).map(c=>({company:hsStr(c.company),contact:hsStr(c.contact),role:hsStr(c.role),email:hsStr(c.email,120),phone:hsStr(c.phone,40)}));
  }catch(_){return null;}
}
function hsBannerHtml(){
  if(!HS.active||!HS.ctx)return '';
  return `<div class="hsbar">🔗 ${L2('Dati dal CRM HubSpot','Data from HubSpot CRM')}${HS.ctx.dealName?` · <b>${esc(HS.ctx.dealName)}</b>`:''}${HS.ctx.dealId?` <span>Deal #${esc(HS.ctx.dealId)}</span>`:''}</div>`;
}
// la scheda sa che il configuratore è pronto a ricevere i dati (si scrive solo a un'origine HubSpot nota)
try{
  if(window.parent!==window&&document.referrer){const o=new URL(document.referrer).origin;if(hsOriginOk(o))window.parent.postMessage({source:'yacht-configurator',v:1,type:'ready'},o);}
}catch(_){}
