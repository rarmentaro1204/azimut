/* Configuratore Yacht — modulo "folder-pdf" */
let DIRHANDLE=null;
let SAVEDIR=null;
function idbSet(k,v){return new Promise((res,rej)=>{const r=indexedDB.open('yachtcfg',1);
  r.onupgradeneeded=()=>r.result.createObjectStore('kv');
  r.onsuccess=()=>{const tx=r.result.transaction('kv','readwrite');tx.objectStore('kv').put(v,k);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);};
  r.onerror=()=>rej(r.error);});}
function idbGet(k){return new Promise(res=>{const r=indexedDB.open('yachtcfg',1);
  r.onupgradeneeded=()=>r.result.createObjectStore('kv');
  r.onsuccess=()=>{try{const tx=r.result.transaction('kv','readonly');const g=tx.objectStore('kv').get(k);g.onsuccess=()=>res(g.result||null);g.onerror=()=>res(null);}catch(_){res(null);}};
  r.onerror=()=>res(null);});}
function fakeEvent(file){return {target:{files:[file]}};}
async function linkFolder(){
  try{
    const h=await window.showDirectoryPicker();
    DIRHANDLE=h;try{await idbSet('dir',h);}catch(_){}
    await loadFromDir(h);
    flash(t('folder_linked'));
  }catch(e){if(e&&e.name!=='AbortError')console.error(e);}
}
function showLoader(title){
  let o=document.getElementById('loadOverlay');
  if(!o){o=document.createElement('div');o.id='loadOverlay';o.className='load-overlay';
    o.innerHTML='<div class="load-card"><div class="load-title" id="loadTitle"></div><div class="load-status" id="loadStatus"></div><div class="load-track"><div class="load-fill" id="loadFill"></div></div><div class="load-pct" id="loadPct"></div></div>';
    document.body.appendChild(o);}
  o.style.display='flex';document.getElementById('loadTitle').textContent=title||'';setLoader(-1,'');
}
function setLoader(pct,status){
  const f=document.getElementById('loadFill'),p=document.getElementById('loadPct'),s=document.getElementById('loadStatus');
  if(f){if(pct<0){f.classList.add('indet');}else{f.classList.remove('indet');f.style.width=Math.max(0,Math.min(100,pct))+'%';}}
  if(p)p.textContent=pct<0?'':Math.round(pct)+'%';
  if(s&&status!=null)s.textContent=status;
}
function hideLoader(){const o=document.getElementById('loadOverlay');if(o)o.style.display='none';}
function uiTick(){return new Promise(r=>requestAnimationFrame(()=>r()));}
async function collectImages(dir,arr,onprog){
  for await(const [n,e] of dir.entries()){
    if(e.kind==='directory')await collectImages(e,arr,onprog);
    else if(/\.(png|jpe?g|webp|gif)$/i.test(n)){arr.push({key:imgKey(n.replace(/\.[^.]+$/,'')),handle:e});if(onprog)onprog();}
  }
}
async function loadFromDir(h){
  showLoader(t('linking_title'));
  setLoader(-1,t('reading_folder'));await uiTick();
  Object.values(IMGCACHE).forEach(u=>{try{URL.revokeObjectURL(u);}catch(_){}});
  IMGMAP={};IMGCACHE={};
  const files=[],imgDirs=[];
  try{
    for await(const [name,entry] of h.entries()){
      const lo=name.toLowerCase();
      if(entry.kind==='file')files.push([name,entry]);
      else if(entry.kind==='directory'&&/(immagin|image|foto)/.test(lo))imgDirs.push({name,entry,lo});
    }
    // if a 2026 images folder exists, use ONLY that one (ignore older "Immagini" / "IMMAGINI LISTINO 2025" folders)
    const imgDirs2026=imgDirs.filter(d=>/2026/.test(d.lo));
    const activeImgDirs=(imgDirs2026.length?imgDirs2026:imgDirs).map(d=>d.entry);
    // 1) data files
    // optional matrix: with several versions in the folder the last one by name wins (e.g. ..._v2)
    const matFiles=files.filter(([n])=>/\.(xlsx|xls)$/i.test(n)&&/(matrice|optional)/i.test(n)&&!/^~\$/.test(n)).sort((a,b)=>a[0].localeCompare(b[0],undefined,{numeric:true}));
    if(matFiles.length){const me=matFiles[matFiles.length-1][1];setLoader(-1,t('loading_matrix'));await uiTick();handleMatrix(fakeEvent(await me.getFile()));}
    for(const [name,entry] of files){
      const lo=name.toLowerCase();
      if(/(matrice|optional)/.test(lo))continue;
      if(/\.(xlsx|xls)$/.test(lo)&&/(sorgente|listino|listing)/.test(lo)){setLoader(-1,t('loading_pricelist'));await uiTick();handleXlsx(fakeEvent(await entry.getFile()));}
      else if(/\.(xlsx|xls|csv)$/.test(lo)&&/(contatt|client|aziend)/.test(lo)){setLoader(-1,t('loading_clients'));await uiTick();CLIENTS_FILE.handle=entry;CLIENTS_FILE.name=name;handleClients(fakeEvent(await entry.getFile()));}
      else if(/\.(xlsx|xls)$/.test(lo)&&/(registro|offert|registry)/.test(lo)){setLoader(-1,t('loading_registry'));await uiTick();REGISTRY.fileHandle=entry;handleRegistry(fakeEvent(await entry.getFile()));}
    }
    // 2) images: get the list of image files fast (from last session's cached list when available,
    //    so we skip re-walking every folder), then read them all CONCURRENTLY in batches — much
    //    faster wall-clock time than one file at a time, especially over a network drive
    setLoader(-1,t('scanning_images').replace('%n','0'));await uiTick();
    let imgList=null;
    try{
      const cached=await idbGet('imgIndex');
      if(cached && cached.length) imgList=cached;
    }catch(_){}
    if(!imgList){
      imgList=[];let last=0;
      for(const d of activeImgDirs){await collectImages(d,imgList,()=>{if(imgList.length-last>=200){last=imgList.length;setLoader(-1,t('scanning_images').replace('%n',String(imgList.length)));}});}
      try{await idbSet('imgIndex',imgList);}catch(_){}
    }
    const total=imgList.length;let done=0;
    const CONCURRENCY=32;
    let idx=0;
    async function worker(){
      while(idx<imgList.length){
        const it=imgList[idx++];
        try{ IMGMAP[it.key]=await it.handle.getFile(); }catch(_){}
        done++;
        if(done%16===0||done===total){setLoader(total?done/total*100:100,t('loading_images_n').replace('%d',String(done)).replace('%t',String(total)));await uiTick();}
      }
    }
    await Promise.all(Array.from({length:Math.min(CONCURRENCY,Math.max(1,imgList.length))},worker));
    if($('#imgTxt'))$('#imgTxt').textContent='✓ '+total+' '+t('images');
    const imgCount=total;
    S.solutions.forEach(s=>{if(!s.img){const u=imgUrlForCode(s.code);if(u){s.img=u;ensureImgs(s);if(!s.imgs.length)s.imgs.push(u);}}
      s.accessories.forEach(a=>{if(!a.img){const u=imgUrlForCode(a.code);if(u)a.img=u;}});});
    if($('#linkTxt'))$('#linkTxt').textContent='✓ '+t('linked');
    setLoader(100,t('done'));await uiTick();
    return files.length+imgCount;
  } finally {
    setTimeout(hideLoader,350);
    render();
  }
}
async function writeRegistryBack(){
  if(typeof DEMO!=='undefined'&&DEMO.on)return false;   // dati demo: mai scritti
  try{
    if(REGISTRY.fileHandle&&REGISTRY.fileHandle.createWritable){
      const w=await REGISTRY.fileHandle.createWritable();
      await w.write(buildRegistryBlob());await w.close();
      return true;
    }
  }catch(e){console.error(e);}
  return false;
}
// if the folder is linked but we don't yet have a writable registry handle, create/open it there
async function ensureRegistryHandleAndWrite(){
  try{
    if(!REGISTRY.fileHandle && DIRHANDLE && await ensurePerm(DIRHANDLE)){
      const name=REGISTRY.fileName||'Registro_Offerte_YACHT_2026.xlsx';
      REGISTRY.fileHandle=await DIRHANDLE.getFileHandle(name,{create:true});
    }
    return await writeRegistryBack();
  }catch(e){console.error(e);return false;}
}
async function ensurePerm(h){try{if((await h.queryPermission({mode:'readwrite'}))==='granted')return true;return (await h.requestPermission({mode:'readwrite'}))==='granted';}catch(_){return false;}}
// resolve target folder: "Offerte fatte_<year>" inside the linked source folder (auto-rolls each year)
async function getSaveDir(){
  const folderName='Offerte fatte_'+yr;
  if(DIRHANDLE && await ensurePerm(DIRHANDLE)){
    try{
      if(/^Offerte fatte/i.test(DIRHANDLE.name||'')){ SAVEDIR=DIRHANDLE; return DIRHANDLE; }
      const off=await DIRHANDLE.getDirectoryHandle(folderName,{create:true});
      SAVEDIR=off; try{await idbSet('savedir',off);}catch(_){}
      return off;
    }catch(e){console.error(e);}
  }
  if(SAVEDIR && await ensurePerm(SAVEDIR)) return SAVEDIR;
  const h=await window.showDirectoryPicker(); SAVEDIR=h; try{await idbSet('savedir',h);}catch(_){}
  return h;
}
function loadScript(src){return new Promise((res,rej)=>{if([...document.scripts].some(s=>s.src===src))return res();const el=document.createElement('script');el.src=src;el.onload=()=>res();el.onerror=()=>rej(new Error('script '+src));document.head.appendChild(el);});}
function addCanvasPaged(pdf,canvas,first,q){
  q=q||0.92;
  const pw=210, ph=297;
  const imgH=canvas.width? canvas.height*pw/canvas.width : ph;
  if(imgH<=ph+0.6){ if(!first)pdf.addPage(); pdf.addImage(canvas.toDataURL('image/jpeg',q),'JPEG',0,0,pw,imgH); return; }
  const pageHpx=Math.floor(canvas.width*ph/pw); let y=0, pnum=0;
  while(y<canvas.height){
    const sliceH=Math.min(pageHpx,canvas.height-y);
    const c=document.createElement('canvas');c.width=canvas.width;c.height=sliceH;
    c.getContext('2d').drawImage(canvas,0,y,canvas.width,sliceH,0,0,canvas.width,sliceH);
    if(!(first&&pnum===0))pdf.addPage();
    pdf.addImage(c.toDataURL('image/jpeg',q),'JPEG',0,0,pw,sliceH*pw/canvas.width);
    y+=sliceH; pnum++;
  }
}
async function svgToImg(svg,scale){
  const rect=svg.getBoundingClientRect();
  const w=Math.max(1,Math.round(rect.width))||100, h=Math.max(1,Math.round(rect.height))||100;
  const clone=svg.cloneNode(true);
  clone.setAttribute('width',w);clone.setAttribute('height',h);
  if(!clone.getAttribute('xmlns'))clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
  const svgStr=new XMLSerializer().serializeToString(clone);
  const url='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svgStr);
  const im=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=url;});
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
  canvas.getContext('2d').drawImage(im,0,0,canvas.width,canvas.height);
  const img=document.createElement('img');
  img.src=canvas.toDataURL('image/png');
  img.className=svg.getAttribute('class')||'';
  img.style.width=w+'px';img.style.height=h+'px';
  // the CSS that positioned/centered the original <svg> (e.g. ".clogo svg{margin:0 auto}") targets the
  // "svg" tag itself, which no longer matches once replaced by <img> — so copy the resolved layout explicitly
  const cs=getComputedStyle(svg);
  ['display','position','top','left','right','bottom','marginTop','marginRight','marginBottom','marginLeft','transform','transformOrigin'].forEach(p=>{
    const v=cs[p]; if(v && v!=='none' && v!=='auto')img.style[p]=v;
  });
  if(cs.display==='block' && (cs.marginLeft==='auto'||cs.marginRight==='auto')){img.style.display='block';img.style.marginLeft='auto';img.style.marginRight='auto';}
  return img;
}
// opts: {scale,q} — per GitHub si usa un profilo compatto (file più leggero: la funzione Netlify accetta richieste fino a ~6 MB)
async function buildPdfBlob(opts){
  opts=opts||{};
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  const {jsPDF}=window.jspdf;
  const pdf=new jsPDF('p','mm','a4');
  document.body.classList.add('exporting');
  const root=document.querySelector('#view .pages');
  const pages=[...document.querySelectorAll('#view .pages .page')];
  if(!pages.length) throw new Error('no pages');
  // html2canvas' inline-SVG support is unreliable (logo/symbol can vanish) — rasterize each SVG to a PNG <img> before capture
  for(const svg of [...root.querySelectorAll('svg')]){
    try{ const img=await svgToImg(svg,3); svg.replaceWith(img); }catch(e){ console.error('svg->img failed',e); }
  }
  try{await document.fonts.ready;}catch(_){}
  await new Promise(r=>setTimeout(r,120));
  try{
    for(let i=0;i<pages.length;i++){
      const canvas=await html2canvas(pages[i],{scale:opts.scale||2,useCORS:true,allowTaint:true,backgroundColor:'#ffffff',logging:false,imageTimeout:0,windowWidth:pages[i].scrollWidth,windowHeight:pages[i].scrollHeight});
      addCanvasPaged(pdf,canvas,i===0,opts.q);
    }
    return pdf.output('blob');
  } finally { document.body.classList.remove('exporting'); stepQuote(); }
}
async function savePdfToFolder(){
  if(!window.showDirectoryPicker){flash(t('pdf_save_err'));return;}
  try{
    flash(t('saving_pdf'));
    const blob=await buildPdfBlob();
    const dir=await getSaveDir();
    const fh=await dir.getFileHandle(suggestedFilename()+'.pdf',{create:true});
    const w=await fh.createWritable(); await w.write(blob); await w.close();
    flash(t('pdf_saved'));
  }catch(e){ if(e&&e.name==='AbortError')return; console.error(e); flash(t('pdf_save_err')); }
}
async function restoreFolder(){
  if(!window.showDirectoryPicker)return;
  try{const sd=await idbGet('savedir');if(sd){if((await sd.queryPermission({mode:'readwrite'}))==='granted')SAVEDIR=sd;}}catch(_){}
  const h=await idbGet('dir');if(!h)return;
  try{
    const q=await h.queryPermission({mode:'readwrite'});
    if(q==='granted'){DIRHANDLE=h;await loadFromDir(h);}
    else if($('#linkTxt')){$('#linkTxt').textContent=t('reconnect');}  // needs one click to re-grant
  }catch(_){}
}
