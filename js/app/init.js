/* Configuratore Yacht — modulo "init" */
/* ============== INIT ============== */
$('#brandLogo').innerHTML=logoLight(30);
setupLoader();
$('#dashBtn').onclick=()=>toggleDashboard(!DASH);
$('#offersBtn').onclick=openOfferList;
loadRegistryLocal();
settingsInit();
applyNextOfferNumber();
ghInit();
if(!S.delivery)S.delivery=t('def_delivery');
if(!S.packaging)S.packaging=t('def_packaging');
if(!S.payment)S.payment=t('def_payment');
$('#langSel').value=LANG;
if(CLIENTS.length&&$('#cliTxt'))$('#cliTxt').textContent='✓ '+CLIENTS.length+' '+t('clients');
render();
restoreFolder();

// Prezzi e optional: si caricano da soli da data/ (sito pubblicato: dist/data/) oppure da data-private/ (sviluppo locale).
// Se i file non ci sono, si caricano a mano dall'ingranaggio ⚙ (Carica listino / Carica matrice optional).
async function fetchFirst(name){
  for(const dir of ['data/','data-private/']){
    try{const r=await fetch(dir+name,{cache:'no-cache'});if(r.ok&&!/text\/html/.test(r.headers.get('content-type')||''))return await r.arrayBuffer();}catch(e){}
  }
  return null;
}
// la libreria Excel si carica in parallelo alla pagina (async): prima di leggere i listini si aspetta che sia pronta
function xlsxReady(){return window.XLSX?Promise.resolve():new Promise(r=>{const t=setInterval(()=>{if(window.XLSX){clearInterval(t);r();}},25);});}
async function autoLoadPrivate(){
  if(!/^https?:/.test(location.protocol))return;
  try{
    await xlsxReady();
    const a=await fetchFirst('01_Listino_Prezzi_Ferretti.xlsx');
    if(a)applyXlsxBuffer(a,'01_Listino_Prezzi_Ferretti.xlsx');
    const b=await fetchFirst('02_Matrice_Optional_Ferretti.xlsx');
    if(b){applyMatrixWorkbook(XLSX.read(b,{type:'array'}),'02_Matrice_Optional_Ferretti.xlsx');if($('#matTxt'))$('#matTxt').textContent='✓ 02_Matrice_Optional_Ferretti.xlsx';render();}
  }catch(e){console.warn('listini non caricati',e);}
  try{ensureDemoSeed();}catch(e){console.warn('demo',e);}   // offerte demo: caricate da sole, a listino pronto
}
autoLoadPrivate();

// cambio: si verifica alla prima apertura di ogni giorno
fxRefresh().then(ok=>{if(ok&&S.cur&&S.cur!=='EUR'&&!S.fxRate){fxSelect(S.cur);} if(typeof step!=='undefined'&&step===3)render();});
