/* Configuratore Yacht — modulo "core" */
let LANG='it';   // listino prezzi unico
function t(k){return (I18N[LANG]&&I18N[LANG][k])||(I18N.en[k])||k;}

/* ============== STATE ============== */
let DATA = JSON.parse(JSON.stringify(EMBEDDED));
let loadedFromFile=false, loadedFileName='';
const yr=new Date().getFullYear();
let step=0;
const S={
  rep:Object.assign({name:'',email:'',phone:''},DATA.reps[0]),   // copia: modificarlo non cambia l'elenco commerciali
  offerNum:BRAND.offerPrefix+String(yr).slice(2)+'-001',
  date:new Date().toLocaleDateString('it-IT'),
  client:'', contact:'', role:'', phone:'', email:'', subject:t('def_subject'),
  isRevisionOffer:false,
  intro:'',
  app:{use:'',area:'',guests:'',crew:'',flag:'',port:'',interior:'',notes:''},
  listino:'EUR',   // listino prezzi: EUR (L€) oppure USD (L$)
  solutions:[], // {code,name,desc,atex,unit,qty,img,specs:{}, accessories:[{code,desc,qty,price}]}
  discount:0, discount2:0, discount3:0,
  validity:'30', lead:'', delivery:'', packaging:'', warranty:'', incoterm:'Ex Works', payment:'', cur:'EUR', fxRate:1, fxDate:'', curShow:false,
  exclusions:'', notes:''
};
const STEPS=['customer','product','options','quote'];   // 1 Cliente · 2 Prodotto · 3 Opzioni · 4 Offerta

/* ============== EXTERNAL RESOURCES (images, clients, registry) ============== */
let IMGMAP={};        // normalizedCode -> File (loaded eagerly at folder-link time)
let IMGCACHE={};      // normalizedCode -> object URL (lazy, fast)
let CLIENTS=(EMBEDDED_CLIENTS||[]).slice();   // auto-loaded from embedded list (zero-click)
let REGISTRY={rows:[], fileHandle:null, fileName:''};
let CLIENTS_FILE={handle:null, name:''};   // writable handle to the source contacts file (when folder linked)
// Immagine predefinita del modello, scaricata dallo scraper come images/<Codice>.png (colonna Immagine_File).
// Nel file HTML "con immagini" le stesse immagini sono incorporate (IMAGES_EMBED).
function catalogImageUrl(k){
  const m=(DATA&&DATA.machines||[]).find(x=>imgKey(x.code)===k);
  if(!m||!m.imageFile)return '';
  if(typeof IMAGES_EMBED!=='undefined'&&IMAGES_ALIAS[m.imageFile]&&IMAGES_EMBED[IMAGES_ALIAS[m.imageFile]])return IMAGES_EMBED[IMAGES_ALIAS[m.imageFile]];
  return IMAGES_BASE+encodeURIComponent(m.imageFile);
}
// foto di presentazione (images/brochure/<Codice>-N.jpg): file locale oppure incorporata nel build "con immagini"
function photoUrl(f){
  if(typeof IMAGES_EMBED!=='undefined'&&IMAGES_ALIAS[f]&&IMAGES_EMBED[IMAGES_ALIAS[f]])return IMAGES_EMBED[IMAGES_ALIAS[f]];
  return IMAGES_BASE+f.split('/').map(encodeURIComponent).join('/');
}
// miniatura (600 px) di una foto: per gamme e schede modello, così la pagina si apre subito
function thumbUrl(f){return IMAGES_BASE+'thumb/'+String(f).split('/').pop();}
function imgKey(code){return String(code||'').toUpperCase().replace(/[^A-Z0-9]/g,'');}
function imgUrlForCode(code){
  const k=imgKey(code);
  if(IMGCACHE[k])return IMGCACHE[k];
  const f=IMGMAP[k];
  if(!f)return catalogImageUrl(k);   // nessuna cartella collegata: immagine del catalogo (cartella images/ o incorporata)
  const url=URL.createObjectURL(f);   // instant, no base64 decode
  IMGCACHE[k]=url;return url;
}
// per-solution image gallery: keep s.imgs[] and mirror the primary into s.img (used by document/word/drawer)
function ensureImgs(s){ if(!Array.isArray(s.imgs)) s.imgs = s.img ? [s.img] : []; s.img = s.imgs[0]||''; return s.imgs; }
function addSolImages(si, urls){ const s=S.solutions[si]; ensureImgs(s); urls.forEach(u=>{if(u)s.imgs.push(u);}); s.img=s.imgs[0]||''; }
// optionals & spare parts read from the price lists, specific to each model
function machineOptionals(code){return MACHINE_OPTIONALS[code]||[];}
function machineSpares(code){return MACHINE_SPARES[code]||[];}
function liteP(o){const e=o.price??o.l0??o.le;return S.listino==='USD'?(o.usd!=null&&o.usd!==''?o.usd:(e==null?e:usdOf(e))):e;}   // listino scelto al passo Prodotto: € oppure $
function addItem(si,o){
  if(S.solutions[si].accessories.find(x=>x.code===o.code))return;
  const item={code:o.code,desc:(typeof optDesc==='function'?optDesc(o):o.desc)||'',group:o.group||'Altro',qty:1,price:liteP(o)||0,img:''};
  S.solutions[si].accessories.push(item);
  const u=imgUrlForCode(o.code);if(u)item.img=u;
  stepOptions();
}
function nextProgressivo(){
  let max=0;REGISTRY.rows.filter(r=>!r.demo).forEach(r=>{const p=parseInt(r.prog||r.Progressivo||0,10);if(p>max)max=p;});   // le offerte demo non contano
  return max+1;
}
// numero offerta mostrato subito aggiornato (dopo la lettura del registro/GitHub)
function refreshOfferNumber(){
  const b=S.offerNum;applyNextOfferNumber();
  if(S.offerNum!==b){
    const i=document.querySelector('#i_offernum');if(i)i.value=S.offerNum;
    if(typeof step!=='undefined'&&step===3&&typeof stepQuote==='function')stepQuote();
  }
}
function applyNextOfferNumber(){
  // never clobber a recalled offer's "<original>_REVn" number with a fresh progressive one —
  // this refresh runs automatically (e.g. every time the Offer step renders) so without this
  // guard a revision number gets silently overwritten before the user even hits Save
  if(S.isRevisionOffer||/_REV\d+$/i.test(String(S.offerNum||'')))return;
  const n=nextProgressivo();
  S.offerNum=BRAND.offerPrefix+String(yr).slice(2)+'-'+String(n).padStart(3,'0');
}

/* ============== HELPERS ============== */
const $=s=>document.querySelector(s);
const ce=(t,c)=>{const e=document.createElement(t);if(c)e.className=c;return e;};
function money(n){n=Number(n)||0;const neg=n<0;n=Math.abs(n);const p=n.toFixed(2).split('.');const int=p[0].replace(/\B(?=(\d{3})+(?!\d))/g,'.');return (neg?'-':'')+int+','+p[1]+' €';}
function priceOf(m){return S.listino==='USD'?(Number(m.priceUsd)||usdOf(m.price)):(Number(m.price)||0);}
function L2(it,en){return LANG==='en'?en:it;}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

const SPEC_FIELDS=[['loa','loa'],['beam','beam'],['draft','draft'],['hull','hull'],['cabins','cabins'],
  ['engine','engine'],['speed','speed'],
  ['disp_empty','disp_empty'],['disp_full','disp_full'],['fuel','fuel'],['water','water'],['persons','persons']];
// unità aggiunte in automatico per le imbarcazioni PERSONALIZZATE quando si digita solo un numero
const SPEC_UNITS={loa:'m',beam:'m',draft:'m',hull:'m',disp_empty:'kg',disp_full:'kg',fuel:'l',water:'l'};
function withUnit(k,v,custom){v=String(v==null?'':v).trim();if(!v)return v;if(!custom||!SPEC_UNITS[k])return v;const chk=k==='dimensions'?v.replace(/[xh]/gi,''):v;return /[a-zA-Z]/.test(chk)?v:v+' '+SPEC_UNITS[k];}
function unitFor(k,v,custom){v=String(v==null?'':v).trim();if(!v||!custom||!SPEC_UNITS[k])return '';const chk=k==='dimensions'?v.replace(/[xh]/gi,''):v;return /[a-zA-Z]/.test(chk)?'':SPEC_UNITS[k];}

// numeri nel catalogo in formato italiano (22,5 m · 48.000 kg): in inglese si mostrano come 22.5 m · 48,000 kg
function locSpec(v){
  v=String(v==null?'':v);if(LANG!=='en')return v;
  return v.replace(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+,\d+/g,m=>m.replace(/[.,]/g,c=>c==='.'?',':'.'));
}
