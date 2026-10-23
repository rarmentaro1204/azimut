/* Configuratore Yacht — modulo "xlsx-loader" */
function norm(s){return String(s==null?'':s).trim();}
function num(v){return parseFloat(String(v).replace(/[^\d.,-]/g,'').replace(/\.(?=\d{3}(\D|$))/g,'').replace(',','.'))||0;}
// Read a sheet as objects, auto-detecting the header row (skips title/subtitle rows).
function sheetRows(sheet,markers){
  const aoa=XLSX.utils.sheet_to_json(sheet,{header:1,defval:''});
  let hi=-1;
  for(let i=0;i<Math.min(aoa.length,15);i++){
    const cells=aoa[i].map(c=>norm(c).toLowerCase());
    if(markers.some(m=>cells.includes(m))){hi=i;break;}
  }
  if(hi<0)hi=0;
  const head=aoa[hi].map(c=>norm(c));
  const out=[];
  for(let i=hi+1;i<aoa.length;i++){
    const row=aoa[i];if(!row.some(c=>norm(c)!==''))continue;
    const o={};head.forEach((h,j)=>{if(h)o[h]=row[j]!=null?row[j]:'';});
    out.push(o);
  }
  return out;
}
function handleXlsx(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>applyXlsxBuffer(ev.target.result,file.name);
  reader.readAsArrayBuffer(file);
}
function applyXlsxBuffer(buf,fileName){
  {
    {
    try{
      const wb=XLSX.read(buf,{type:'array'});
      const out={machines:[],accessories:[],reps:[]};
      const findSheet=(names)=>{for(const n of wb.SheetNames){if(names.some(x=>n.toLowerCase().includes(x)))return n;}return null;};
      const sM=findSheet(['macchin','machine','máquina','machines']);
      const sA=findSheet(['access','accessor','accesori']);
      const sR=findSheet(['commerc','rep','referent','vendeur','vendedor']);
      if(sM){const rows=sheetRows(wb.Sheets[sM],['codice','code','código']);
        rows.forEach(r=>{
          const code=norm(r.Codice||r.Code||r.code||r.CODICE);if(!code)return;
          const get=(...k)=>{for(const key of k){if(r[key]!=null&&r[key]!=='')return r[key];}return '';};
          out.machines.push({code,
            family:norm(get('Famiglia','Family','family')),
            category:norm(get('Categoria','Category','category')),
            name:norm(get('Nome','Name','name')),
            desc:norm(get('Descrizione_EN','Descrizione','Description','desc')),
            atex:/^(si|sì|yes|x|true|1)$/i.test(norm(get('ATEX','Atex','atex'))),
            price:num(get('Prezzo','Prezzo_EUR','Price')),priceUsd:num(get('Prezzo_USD','Price_USD','USD')),
            loa:norm(get('LOA','LOA_m')),beam:norm(get('Larghezza','Larghezza_m')),draft:norm(get('Pescaggio','Pescaggio_m')),
            hull:norm(get('Lunghezza_scafo','Lunghezza_scafo_m')),cabins:norm(get('Cabine')),
            engine:norm(get('Motore_Standard')),speed:norm(get('Velocita','Velocità')),engine_opt:norm(get('Motore_Optional')),speed_opt:norm(get('Velocita_Optional')),
            disp_empty:norm(get('Dislocamento_Vuoto','Dislocamento_Vuoto_kg')),disp_full:norm(get('Dislocamento_Carico','Dislocamento_Carico_kg')),
            fuel:norm(get('Carburante','Carburante_l')),water:norm(get('Acqua','Acqua_l')),persons:norm(get('Persone')),
            marking:'',application:norm(get('Applicazione')),url:norm(get('URL','url')),image:norm(get('Immagine_URL','image')),imageFile:norm(get('Immagine_File','imageFile')),
            subcategory:norm(get('Sottocategoria')),protection:norm(get('Protezione'))});
        });}
      if(sA){const rows=sheetRows(wb.Sheets[sA],['codice','code','código']);
        rows.forEach(r=>{const code=norm(r.Codice||r.Code||r.code);if(!code)return;
          const get=(...k)=>{for(const key of k){if(r[key]!=null&&r[key]!=='')return r[key];}return '';};
          out.accessories.push({code,desc:norm(get('Descrizione','Description','desc')),
            price:num(get('Prezzo','Prezzo_EUR','Price','Prezzo_L0','L0'))});});}
      if(sR){const rows=sheetRows(wb.Sheets[sR],['nome','name','nombre','nom']);
        rows.forEach(r=>{const name=norm(r.Nome||r.Name||r.name);if(!name)return;
          out.reps.push({name,email:norm(r.Email||r.email),phone:norm(r.Telefono||r.Phone||r.phone)});});}
      if(!out.machines.length){flash(t('load_err'));return;}
      if(!out.reps.length)out.reps=EMBEDDED.reps;
      if(typeof mergeRepsFromSettings==='function')out.reps=mergeRepsFromSettings(out.reps);
      if(!out.accessories.length)out.accessories=EMBEDDED.accessories;
      // fusione col catalogo incorporato: il file può contenere solo codice + prezzo (matrice prezzi);
      // i dati tecnici restano quelli del catalogo, il file vince solo dove ha un valore.
      const base=new Map(EMBEDDED.machines.map(m=>[m.code,m]));
      const merged=new Map();
      out.machines.forEach(m=>{const b=base.get(m.code)||{};const r={...b};
        Object.keys(m).forEach(k=>{if(m[k]!==''&&m[k]!=null&&!(k==='atex'&&!m[k]&&b.atex))r[k]=m[k];});
        if(!m.price&&b.price)r.price=b.price;
        if(!m.priceUsd&&b.priceUsd)r.priceUsd=b.priceUsd;
        merged.set(m.code,r);});
      base.forEach((b,c)=>{if(!merged.has(c))merged.set(c,b);});   // modelli non presenti nel file: restano (senza prezzo)
      out.machines=[...merged.values()].map(m=>({...m,category:m.category||'OTHER',name:m.name||m.code}));
      DATA=out;loadedFromFile=true;loadedFileName=fileName;
      if(!S.rep||!S.rep.name||/^\[Commerciale/.test(S.rep.name))S.rep=Object.assign({name:'',email:'',phone:''},DATA.reps[0]);   // non sovrascrive un referente già modificato
      if($('#xlsxTxt'))$('#xlsxTxt').textContent='✓ '+fileName;
      curCat=null;search='';
      flash(t('load_ok').replace('%n',DATA.machines.length));
      render();
    }catch(err){console.error(err);flash(t('load_err'));}
    }
  }
}
