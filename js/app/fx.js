/* Configuratore Yacht — modulo "fx": valute e cambio.
   I prezzi (listino, registro, dashboard) sono SEMPRE in euro. La valuta scelta nel pannello «Prezzo netto» serve a lavorare
   l'importo finale (arrotondamento / prezzo manuale) e, se il flag è attivo, a mostrare il documento in quella valuta.
   Il cambio si controlla alla prima apertura di ogni giorno (open.er-api.com) e si ricorda; ogni offerta conserva il cambio usato. */
// [sigla, simbolo, codice paese della bandiera, nome]
const CURRENCIES=[['EUR','€','eu','Euro'],['USD','$','us','Dollaro USA'],['GBP','£','gb','Sterlina'],['CHF','CHF','ch','Franco svizzero'],['AED','AED','ae','Dirham EAU'],['CAD','C$','ca','Dollaro canadese'],['AUD','A$','au','Dollaro australiano'],
  ['SGD','S$','sg','Dollaro di Singapore'],['HKD','HK$','hk','Dollaro di Hong Kong'],['JPY','¥','jp','Yen'],['CNY','CN¥','cn','Yuan'],['NOK','kr','no','Corona norvegese'],['SEK','kr','se','Corona svedese']];
// bandiera come immagine (funziona su qualsiasi computer, a differenza delle emoji)
function flagImg(cc,w){return `<img class="flag" src="https://flagcdn.com/w40/${cc}.png" width="${w||22}" height="${Math.round((w||22)*0.75)}" alt="${cc.toUpperCase()}" loading="lazy">`;}
const FX_LS='yacht_fx_v1';
const FX={date:'',rates:{EUR:1},src:'',failed:false};
function fxLoad(){try{const o=JSON.parse(localStorage.getItem(FX_LS)||'null');if(o&&o.rates)Object.assign(FX,o);}catch(_){}}
function fxSave(){try{localStorage.setItem(FX_LS,JSON.stringify({date:FX.date,rates:FX.rates,src:FX.src}));}catch(_){}}
function fxToday(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
// aggiorna il cambio se non è già di oggi (o se force). Ritorna true se i tassi sono di oggi.
async function fxRefresh(force){
  if(!force&&FX.date===fxToday()&&FX.rates.USD)return true;
  const srcs=[['https://open.er-api.com/v6/latest/EUR',j=>j&&j.result==='success'?j.rates:null],
              ['https://api.frankfurter.dev/v1/latest?base=EUR',j=>j&&j.rates?Object.assign({EUR:1},j.rates):null]];
  for(const [u,pick] of srcs){
    try{
      const r=await fetch(u,{cache:'no-store'});if(!r.ok)continue;
      const rates=pick(await r.json());
      if(rates&&rates.USD){FX.rates=Object.assign({EUR:1},rates);FX.date=fxToday();FX.src=new URL(u).host;FX.failed=false;fxSave();return true;}
    }catch(_){}
  }
  FX.failed=true;return false;
}
function curInfo(c){return CURRENCIES.find(x=>x[0]===c)||CURRENCIES[0];}
// cambio dell'offerta: quello salvato con l'offerta, altrimenti l'ultimo noto
function curRate(){const c=S.cur||'EUR';if(c==='EUR')return 1;return Number(S.fxRate)||Number(FX.rates[c])||0;}
function fxSelect(c){S.cur=c;if(c==='EUR'){S.fxRate=1;S.fxDate=FX.date;}else{S.fxRate=Number(FX.rates[c])||0;S.fxDate=FX.date;}}
// il documento è nella valuta scelta (se il cambio è noto)
function docCur(){return (S.cur&&S.cur!=='EUR'&&curRate())?S.cur:'EUR';}
function fmtCur(n,c){
  try{return new Intl.NumberFormat(LANG==='en'?'en-GB':'it-IT',{style:'currency',currency:c,currencyDisplay:'narrowSymbol'}).format(n);}
  catch(e){return Number(n).toFixed(2)+' '+c;}
}
// importo in euro -> testo nella valuta del documento
function moneyD(eur){const c=docCur();return c==='EUR'?money(eur):fmtCur((Number(eur)||0)*curRate(),c);}
// importo in euro -> testo in una valuta qualsiasi (anteprima nel pannello)
function moneyIn(eur,c){return c==='EUR'?money(eur):fmtCur((Number(eur)||0)*(c===S.cur?curRate():(Number(FX.rates[c])||0)),c);}
fxLoad();
