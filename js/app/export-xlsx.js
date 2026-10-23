/* Configuratore Yacht — modulo "export-xlsx": l'offerta in Excel con la stessa impaginazione del catalogo Azimut
   (foglio inglese + foglio «_IT», colonne Qty / Price List / sconto, totali con formule, foglio «service» con i dati strutturati). */
const XL_GREY='FFCCCCCC', XL_ORANGE='FFFFC000';
function xlSheetName(base,used){
  let n=String(base).replace(/^Ferretti Yachts\s*/i,'').replace(/[\\\/?*\[\]:]/g,' ').trim().slice(0,26)||'Offerta';
  let k=n,i=2;while(used.has(k.toLowerCase())){k=n.slice(0,24)+'_'+i++;}
  used.add(k.toLowerCase());return k;
}
function xlFill(cell,argb){cell.fill={type:'pattern',pattern:'solid',fgColor:{argb}};}
function xlAddSheet(wb,sd,lang,name){
  const {s,rows}=sd,it=lang==='it',rate=curRate()||1;
  const L=(a,b)=>it?a:b;
  const sym=curInfo(docCur())[1],fmt=`#,##0.00 "${sym}"`;
  const ws=wb.addWorksheet(name);
  [12,60,5,17,17,20,17,20,20,40].forEach((w,i)=>ws.getColumn(i+1).width=w);
  const sp=effSpecs(s);
  // intestazione modello
  ws.mergeCells('A2:B2');ws.getCell('A2').value=String(s.name).replace(/^Ferretti Yachts\s*/i,'Ferretti ');
  ws.getCell('A2').font={bold:true,size:24};
  'ABCDEFGHIJ'.split('').forEach(c=>xlFill(ws.getCell(c+'2'),XL_GREY));
  ws.getCell('A3').value=L('MOTORI:','ENGINES:');ws.getCell('B3').value=sp.engine||'';
  ws.getCell('F3').value=L('IVA:','VAT:');ws.getCell('G3').value=0;ws.getCell('G3').numFmt='0%';
  ['F3','G3'].forEach(a=>{ws.getCell(a).font={bold:true};xlFill(ws.getCell(a),XL_ORANGE);});
  ws.getCell('A4').value=L('VELOCITÀ','SPEED');ws.getCell('B4').value=sp.speed||'';
  const head=(r,first,title,last)=>{
    const h=['',title,L('Qtà','Qty'),L('Prezzo Listino','Price List'),L('Prezzo esc IVA','Price exc VAT'),L('Prezzo incl IVA','Price Inc VAT'),L('Sconto %','Discount %'),L('Prezzo esc IVA incl Sconto','Price ex VAT incl. Discount'),L('Prezzo incl IVA incl Sconto','Price inc VAT incl. Discount'),last];
    h[0]=first;
    h.forEach((v,i)=>{const c=ws.getCell(r,i+1);c.value=v;c.font={bold:true};xlFill(c,XL_GREY);});
  };
  const line=(r,r0,code,desc,qty,unit,disc,note)=>{
    const g=Math.round((disc||0)*10000)/10000;
    const val=unit*qty,vat=val*0,h=val-g*val,ii=h;   // IVA = 0 di partenza (cella G3 modificabile)
    ws.getCell(r,1).value=code||'';ws.getCell(r,2).value=desc||'';ws.getCell(r,2).alignment={wrapText:true,vertical:'top'};
    ws.getCell(r,3).value=qty;ws.getCell(r,4).value=unit;
    ws.getCell(r,5).value={formula:`D${r}*C${r}`,result:val};
    ws.getCell(r,6).value={formula:`E${r}*$G$3+E${r}`,result:val+vat};
    ws.getCell(r,7).value=g;ws.getCell(r,7).numFmt='0.##%';
    ws.getCell(r,8).value={formula:`E${r}-G${r}*E${r}`,result:h};
    ws.getCell(r,9).value={formula:`F${r}-G${r}*F${r}`,result:ii+vat*(1-g)};
    if(note)ws.getCell(r,10).value=note;
    [4,5,6,8,9].forEach(c=>ws.getCell(r,c).numFmt=fmt);
  };
  const dsc=r=>r.partial>0?1-r.total/r.partial:0;
  // barca standard
  head(6,'',L('BARCA STANDARD','STANDARD BOAT'),'');
  const boat=rows[0];
  line(7,7,'',String(s.name).replace(/^Ferretti Yachts\s*/i,'Ferretti '),boat.qty,boat.unit*rate,dsc(boat));
  // optional
  head(9,L('Codice','Code'),L('OPTIONAL','OPTIONALS'),L('Note','Note'));
  let r=11,first=0,lastRow=0;
  const opts=rows.slice(1);
  OPT_GROUP_ORDER.concat(['__altri']).forEach(g=>{
    const rs=opts.filter(x=>g==='__altri'?!OPT_GROUP_ORDER.includes(x.group||'Altro'):(x.group||'Altro')===g);
    if(!rs.length)return;
    ws.getCell(r,2).value=(it?optGroupLabel(g).toUpperCase():(OPT_GROUP_EN[g]||g).toUpperCase());
    for(let c=1;c<=9;c++)xlFill(ws.getCell(r,c),XL_GREY);
    r++;
    rs.forEach(x=>{
      const en=(x.descEn&&x.descEn!==x.desc)?x.descEn:'';
      line(r,0,x.code,it?x.desc:(en||x.desc),x.qty,x.unit*rate,dsc(x));
      if(!first)first=r;lastRow=r;r++;});
  });
  const tot=r+1,grand=tot+4;
  const sumOf=col=>first?{formula:`SUM(${col}${first}:${col}${lastRow})`,result:opts.reduce((x,o)=>x+(col==='H'||col==='I'?o.total:o.partial)*rate,0)}:0;
  ws.getCell(tot,2).value=L('TOTALE OPTIONAL','TOTAL OF OPTIONALS');
  ['E','F','H','I'].forEach(c=>{const cell=ws.getCell(c+tot);cell.value=sumOf(c);cell.numFmt=fmt;});
  const bTot=boat.total*rate,bPar=boat.partial*rate,oTot=opts.reduce((x,o)=>x+o.total*rate,0),oPar=opts.reduce((x,o)=>x+o.partial*rate,0);
  ws.getCell(grand,2).value=L('SOMMA TOTALE','GRAND TOTAL');
  [['E',bPar+oPar],['F',bPar+oPar],['H',bTot+oTot],['I',bTot+oTot]].forEach(([c,v])=>{const cell=ws.getCell(c+grand);cell.value={formula:`${c}7+${c}${tot}`,result:v};cell.numFmt=fmt;});
  [tot,grand].forEach(rr=>{for(let c=1;c<=9;c++){const cell=ws.getCell(rr,c);cell.font={bold:true,size:12};xlFill(cell,XL_GREY);}});
  ws.getCell(grand+2,1).value=L(`Prezzi IVA esclusa. Validità offerta: ${S.validity||'30'} giorni. ${S.incoterm||'Ex Works'}.`,`Prices exclusive of VAT. Offer validity: ${S.validity||'30'} days. ${S.incoterm||'Ex Works'}.`);
  return {tot,grand};
}
// ExcelJS (≈1 MB) si scarica solo quando serve davvero: al primo salvataggio o «Scarica Excel»
let _exceljsP=null;
function loadExcelJS(){
  if(typeof ExcelJS!=='undefined')return Promise.resolve();
  return _exceljsP||(_exceljsP=new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';s.onload=res;s.onerror=()=>{_exceljsP=null;rej(new Error('ExcelJS non scaricato'));};document.head.appendChild(s);}));
}
async function buildOfferXlsx(){
  await loadExcelJS();
  const wb=new ExcelJS.Workbook();wb.creator=(S.rep&&S.rep.name)||BRAND.legalName;wb.created=new Date();
  const {sols}=lineTotals(),used=new Set(),svc=[];
  sols.filter(sd=>!sd.s.sparesOnly).forEach(sd=>{
    const nm=xlSheetName(sd.s.name,used);
    xlAddSheet(wb,sd,'en',nm);
    xlAddSheet(wb,sd,'it',xlSheetName(nm+'_IT',used));
    svc.push(sd);
  });
  if(!svc.length)throw new Error('nessuna imbarcazione da esportare');
  // foglio «service»: dati strutturati (stesso schema usato dai configuratori Azimut), utile per re-importare l'offerta
  const rate=curRate()||1,sd0=svc[0],s0=sd0.s;
  const sections=OPT_GROUP_ORDER.map((g,i)=>({id:i+1,name_en:(OPT_GROUP_EN[g]||g).toUpperCase(),name_local:optGroupLabel(g).toUpperCase(),
    items:sd0.rows.slice(1).filter(x=>(x.group||'Altro')===g).map(x=>({code:x.code,name_en:x.descEn||x.desc,name_local:x.desc,price:x.unit*rate,quantity:x.qty,discount:Math.round(((x.partial>0?1-x.total/x.partial:0))*10000)/10000,price_discount:x.total*rate,market:docCur(),_selected:true}))})).filter(x=>x.items.length);
  const svcData={dealer:(S.rep&&S.rep.email)||'',offerNum:S.offerNum,listino:S.listino||'EUR',
    boatModel:{name:s0.name,code:s0.code,engines:effSpecs(s0).engine||'',speed:effSpecs(s0).speed||'',price:sd0.rows[0].unit*rate,market:docCur(),discount:0},
    boatSections:sections,currentVAT:0,customBoatPrice:0};
  wb.addWorksheet('service').getCell('A1').value=JSON.stringify(svcData);
  const buf=await wb.xlsx.writeBuffer();
  return new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
async function downloadOfferXlsx(){
  try{
    const blob=await buildOfferXlsx();
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=suggestedFilename()+'.xlsx';
    document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1500);
  }catch(e){console.error(e);flash(L2('Excel non generato: ','Excel not generated: ')+(e&&e.message||e),4000);}
}
