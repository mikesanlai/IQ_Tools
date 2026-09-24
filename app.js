"use strict";

const tests = [
  {id:"resolution",name:"Resolution",zh:"解析度",icon:"▥",chart:"ISO 12233",file:"iso12233 chart.bmp",desc:"以斜邊 ROI 估算 MTF50 與每圖高線寬。"},
  {id:"color",name:"Color Reproduction",zh:"色彩還原",icon:"◒",chart:"24 色卡",file:"24 color checker.bmp",desc:"比較 24 個色塊與 ColorChecker Classic sRGB 參考值。"},
  {id:"whiteBalance",name:"White Balance",zh:"白平衡",icon:"◐",chart:"24 色卡",file:"24 color checker.bmp",desc:"使用色卡最下排的中性灰階評估 RGB 平衡。"},
  {id:"grayScale",name:"Gray Scale",zh:"灰階",icon:"▤",chart:"24 色卡",file:"24 color checker.bmp",desc:"檢查六個中性灰階色塊的亮度層次。"},
  {id:"snr",name:"S/N Ratio",zh:"訊噪比",icon:"⌁",chart:"24 色卡",file:"24 color checker.bmp",desc:"從中性灰色色塊的單張空間變異估算訊噪比。"},
  {id:"uniformity",name:"Brightness Uniformity",zh:"亮度均勻度",icon:"◉",chart:"白板",file:"white chart.bmp",desc:"比較畫面九個位置相對中心的亮度。"},
  {id:"distortion",name:"Distortion",zh:"畸變",icon:"▦",chart:"棋盤格",file:"distortion chart.bmp",desc:"自動偵測棋盤格角點，估算水平與垂直格線彎曲量。"}
];
const defaults = {
  resolution:{x:.458,y:.235,w:.034,h:.19},
  checker:{x:.116,y:.072,w:.738,h:.867}, uniformity:{x:0,y:0,w:1,h:1},
  distortion:{x:.08,y:.03,w:.84,h:.95}
};
const $=id=>document.getElementById(id);
const nav=$("testNav"),canvas=$("imageCanvas"),ctx=canvas.getContext("2d",{willReadFrequently:true});
const stage=$("canvasStage"),fileInput=$("fileInput");
const state={index:0,img:null,imageData:null,filename:"",source:"sample",zoom:1,rois:structuredClone(defaults),corners:null,drag:null,result:null,uploads:{},imageToken:0};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmt=(v,n=1)=>Number.isFinite(v)?v.toFixed(n):"—";
const rgbHex=rgb=>`#${rgb.map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,"0")).join("").toUpperCase()}`;
const safe=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]);
const current=()=>tests[state.index];
const roiKey=()=>["color","whiteBalance","grayScale","snr"].includes(current().id)?"checker":current().id;
function invalidateResult(){state.result=null;state.corners=null;$("resultState").textContent="待分析";$("resultState").className="state-pill";$("exportButton").disabled=true;}
// ColorChecker Classic (legacy) sRGB reference, D65. Row-major order.
const colorCheckerReference=[
  [115,82,68],[194,150,130],[98,122,157],[87,108,67],[133,128,177],[103,189,170],
  [214,126,44],[80,91,166],[193,90,99],[94,60,108],[157,188,64],[224,163,46],
  [56,61,150],[70,148,73],[175,54,60],[231,199,31],[187,86,149],[8,133,161],
  [243,243,242],[200,200,200],[160,160,160],[122,122,121],[85,85,85],[52,52,52]
];

function buildNav(){nav.innerHTML=tests.map((t,i)=>`<button class="nav-item ${i===state.index?'active':''}" data-index="${i}" title="${t.name} · ${t.zh}"><span class="nav-icon">${t.icon}</span><span class="nav-copy"><strong>${t.name}</strong><small>${t.zh}</small></span></button>`).join("");nav.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>selectTest(+b.dataset.index)));}
function selectTest(i){state.index=i;state.result=null;state.corners=null;buildNav();const t=current();$("categoryLabel").textContent=`${t.chart.toUpperCase()} CHART · ${String(i+1).padStart(2,"0")} / 07`;$("testTitle").innerHTML=`${t.name} <span>${t.zh}</span>`;$("testDescription").textContent=t.desc;$("chartBadge").textContent=t.chart;$("resultState").textContent="待分析";$("resultState").className="state-pill";$("exportButton").disabled=true;renderPanel();const upload=state.uploads[t.file];if(upload){loadImage(upload.url,upload.name,true);}else if(location.protocol==="file:"){showImagePrompt();}else{loadImage(`images/${encodeURIComponent(t.file)}`,t.file,false);}}
function showImagePrompt(){++state.imageToken;state.img=null;state.imageData=null;state.filename="";canvas.width=0;canvas.height=0;clearCursorReadout();$("imageName").textContent="—";$("imageMeta").textContent="等待載入影像";$("loading").textContent="請按「開啟照片」選取影像。";$("loading").classList.remove("hidden");$("statusText").textContent="等待載入影像";}
function loadImage(src,name,isUpload){clearCursorReadout();const token=++state.imageToken;$("loading").textContent="載入影像中…";$("loading").classList.remove("hidden");const im=new Image();im.onload=()=>{if(token!==state.imageToken)return;try{const c=document.createElement("canvas");c.width=im.naturalWidth;c.height=im.naturalHeight;const cctx=c.getContext("2d",{willReadFrequently:true});cctx.drawImage(im,0,0);state.imageData=cctx.getImageData(0,0,c.width,c.height);state.img=im;state.corners=null;state.filename=name;state.source=isUpload?"upload":"sample";state.zoom=1;$("imageName").textContent=name;$("imageMeta").textContent=`${c.width} × ${c.height} px · ${isUpload?"自行上傳":"內建範例"}`;$("loading").classList.add("hidden");$("statusText").textContent="影像已載入，請確認選取位置";draw();renderPanel();}catch(e){showError(`無法讀取像素：${e.message}。請使用「開啟照片」載入，或透過本機 HTTP 伺服器開啟頁面。`);}};im.onerror=()=>{if(token===state.imageToken)showError(`無法載入 ${name}。`)};im.src=src;}
function showError(message){$("loading").textContent=message;$("loading").classList.remove("hidden");$("statusText").textContent="載入失敗";$("resultContent").innerHTML=`<div class="empty-state error-text">${safe(message)}</div>`;}
function fitScale(){if(!state.img)return 1;return Math.min((stage.clientWidth-30)/state.img.naturalWidth,(stage.clientHeight-30)/state.img.naturalHeight,1);}
function draw(){
  if(!state.img)return;
  const w=state.img.naturalWidth,h=state.img.naturalHeight,s=fitScale()*state.zoom;
  canvas.width=Math.max(1,Math.round(w*s));canvas.height=Math.max(1,Math.round(h*s));
  ctx.drawImage(state.img,0,0,canvas.width,canvas.height);
  ctx.save();ctx.lineWidth=2;ctx.strokeStyle="#48ecf0";ctx.fillStyle="#48ecf022";
  const key=roiKey();
  if(key==="checker"){
    const r=state.rois.checker,x=r.x*canvas.width,y=r.y*canvas.height,rw=r.w*canvas.width,rh=r.h*canvas.height;
    ctx.strokeRect(x,y,rw,rh);
    for(let row=0;row<4;row++)for(let col=0;col<6;col++){
      const px=x+rw*(col+.5)/6,py=y+rh*(row+.5)/4,pw=rw/6*.42,ph=rh/4*.42;
      ctx.fillStyle=row===3?"#4ef0d628":"#48ecf014";ctx.fillRect(px-pw/2,py-ph/2,pw,ph);
      ctx.strokeStyle=row===3?"#56ebcb":"#4bdbdc99";ctx.strokeRect(px-pw/2,py-ph/2,pw,ph);
    }
  }else{
    const r=state.rois[key];
    if(r){ctx.fillRect(r.x*canvas.width,r.y*canvas.height,r.w*canvas.width,r.h*canvas.height);ctx.strokeRect(r.x*canvas.width,r.y*canvas.height,r.w*canvas.width,r.h*canvas.height);}
  }
  if(key==="uniformity"){
    const r=state.rois.uniformity;
    for(const yy of [.14,.5,.86])for(const xx of [.14,.5,.86]){
      const x=(r.x+r.w*xx)*canvas.width,y=(r.y+r.h*yy)*canvas.height;
      ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fillStyle="#4aecd9";ctx.fill();
    }
  }
  if(key==="distortion"&&state.corners){
    const result=state.corners,scaleX=canvas.width/(w/result.scale),scaleY=canvas.height/(h/result.scale);
    for(const line of [...result.rows,...result.cols]){
      ctx.beginPath();line.points.forEach((p,i)=>i?ctx.lineTo(p.x*scaleX,p.y*scaleY):ctx.moveTo(p.x*scaleX,p.y*scaleY));
      ctx.strokeStyle="#ffca6f88";ctx.lineWidth=1;ctx.stroke();
    }
    for(const p of result.points){ctx.beginPath();ctx.arc(p.x*scaleX,p.y*scaleY,2.4,0,Math.PI*2);ctx.fillStyle="#4bf1e4";ctx.fill();}
  }
  ctx.restore();$("zoomLabel").textContent=`${Math.round(state.zoom*100)}%`;
}
function canvasPos(e){const rect=canvas.getBoundingClientRect();return {x:clamp((e.clientX-rect.left)/rect.width,0,1),y:clamp((e.clientY-rect.top)/rect.height,0,1)};}
function clearCursorReadout(){$("cursorReadout").textContent="R: —　G: —　B: —　X: —　Y: —";}
canvas.addEventListener("pointerdown",e=>{if(!state.img)return;state.drag=canvasPos(e);canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener("pointermove",e=>{if(!state.img||!state.imageData)return;const p=canvasPos(e),d=state.imageData,x=clamp(Math.floor(p.x*d.width),0,d.width-1),y=clamp(Math.floor(p.y*d.height),0,d.height-1),i=(y*d.width+x)*4;$("cursorReadout").textContent=`R: ${d.data[i]}　G: ${d.data[i+1]}　B: ${d.data[i+2]}　X: ${x}　Y: ${y}`;if(state.drag){const x=Math.min(state.drag.x,p.x),y=Math.min(state.drag.y,p.y);state.rois[roiKey()]={x,y,w:Math.abs(p.x-state.drag.x),h:Math.abs(p.y-state.drag.y)};draw();}});
canvas.addEventListener("pointerleave",()=>{if(!state.drag)clearCursorReadout();});
canvas.addEventListener("pointerup",e=>{if(!state.drag)return;const r=state.rois[roiKey()];if(r.w<.01||r.h<.01){state.rois[roiKey()]=structuredClone(defaults[roiKey()]);}state.drag=null;invalidateResult();draw();renderPanel();});
canvas.addEventListener("wheel",e=>{e.preventDefault();changeZoom(e.deltaY<0?1.15:1/1.15)},{passive:false});
function changeZoom(factor){state.zoom=clamp(state.zoom*factor,.5,4);draw();}
$("zoomIn").onclick=()=>changeZoom(1.25);$("zoomOut").onclick=()=>changeZoom(.8);$("fitButton").onclick=()=>{state.zoom=1;draw()};
$("resetButton").onclick=()=>{state.rois[roiKey()]=structuredClone(defaults[roiKey()]);invalidateResult();draw();renderPanel();};
$("uploadButton").onclick=()=>fileInput.click();fileInput.addEventListener("change",()=>{const file=fileInput.files?.[0];if(!file)return;const key=current().file;const old=state.uploads[key];if(old)URL.revokeObjectURL(old.url);const url=URL.createObjectURL(file);state.uploads[key]={url,name:file.name};invalidateResult();loadImage(url,file.name,true);fileInput.value="";});
$("analyzeButton").onclick=()=>analyze();$("exportButton").onclick=()=>{if(!state.result)return;const payload={test:current().name,chart:current().chart,image:state.filename,width:state.img.naturalWidth,height:state.img.naturalHeight,measuredAt:new Date().toISOString(),result:state.result.data,method:state.result.method};const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`camera-lab-${current().id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
window.addEventListener("resize",()=>draw());

function pixels(){if(!state.imageData)throw Error("影像尚未載入");return state.imageData;}
function region(r){const d=pixels();const x=clamp(Math.floor(r.x*d.width),0,d.width-1),y=clamp(Math.floor(r.y*d.height),0,d.height-1),w=clamp(Math.floor(r.w*d.width),1,d.width-x),h=clamp(Math.floor(r.h*d.height),1,d.height-y);return{x,y,w,h};}
function sample(r,step=2){const d=pixels(),q=region(r),arr=d.data;let n=0,R=0,G=0,B=0,Y=0,xx=0,yy=0,x2=0,y2=0,xy=0,xY=0,yY=0,Y2=0;for(let y=q.y;y<q.y+q.h;y+=step)for(let x=q.x;x<q.x+q.w;x+=step){const i=(y*d.width+x)*4,rr=arr[i],gg=arr[i+1],bb=arr[i+2],lum=.2126*rr+.7152*gg+.0722*bb,u=(x-q.x)/q.w,v=(y-q.y)/q.h;n++;R+=rr;G+=gg;B+=bb;Y+=lum;xx+=u;yy+=v;x2+=u*u;y2+=v*v;xy+=u*v;xY+=u*lum;yY+=v*lum;Y2+=lum*lum;}if(n<25)throw Error("選取區域太小，請重新框選。 ");const mean=Y/n;const Sxx=x2-xx*xx/n,Syy=y2-yy*yy/n,Sxy=xy-xx*yy/n,SxY=xY-xx*Y/n,SyY=yY-yy*Y/n,det=Sxx*Syy-Sxy*Sxy;let a=0,b=0;if(Math.abs(det)>1e-9){a=(SxY*Syy-SyY*Sxy)/det;b=(SyY*Sxx-SxY*Sxy)/det;}const explained=a*SxY+b*SyY;const variance=Math.max(0,(Y2-Y*Y/n-explained)/n);return {r:R/n,g:G/n,b:B/n,y:mean,std:Math.sqrt(variance),n};}
function checkerPatches(){const r=state.rois.checker,arr=[];for(let row=0;row<4;row++){const line=[];for(let col=0;col<6;col++){const cx=r.x+r.w*(col+.5)/6,cy=r.y+r.h*(row+.5)/4;line.push(sample({x:cx-r.w*.035,y:cy-r.h*.045,w:r.w*.07,h:r.h*.09},2));}arr.push(line);}return arr;}
function rgbToXyz(s){const lin=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4};const r=lin(s.r),g=lin(s.g),b=lin(s.b);return {X:.4124564*r+.3575761*g+.1804375*b,Y:.2126729*r+.7151522*g+.072175*b,Z:.0193339*r+.119192*g+.9503041*b};}
function rgbToLab(s){const xyz=rgbToXyz(s),x=xyz.X/.95047,y=xyz.Y,z=xyz.Z/1.08883;const f=v=>v>.008856?Math.cbrt(v):7.787*v+16/116;return {L:116*f(y)-16,a:500*(f(x)-f(y)),b:200*(f(y)-f(z))};}
function rgbToChromaticity(s){const {X,Y,Z}=rgbToXyz(s),sum=X+Y+Z;if(sum<=0)throw Error("灰階樣本過暗，無法計算色度座標。");return{x:X/sum,y:Y/sum};}
function castDirection(lab){if(Math.hypot(lab.a,lab.b)<2)return "接近中性";const directions=[];if(Math.abs(lab.a)>=2)directions.push(lab.a>0?"紅":"綠");if(Math.abs(lab.b)>=2)directions.push(lab.b>0?"黃":"藍");return directions.length?`偏${directions.join("、")}`:"接近中性";}
function neutralDelta(s){const lab=rgbToLab(s);return {delta:Math.hypot(lab.a,lab.b),lab};}
function calculateResolution(){const q=region(state.rois.resolution),d=pixels();if(q.w<30||q.h<30)throw Error("斜邊區域至少需要 30 × 30 像素。 ");const lum=(x,y)=>{const i=(y*d.width+x)*4,a=d.data;return .2126*a[i]+.7152*a[i+1]+.0722*a[i+2]};let gx=0,gy=0;for(let y=q.y+2;y<q.y+q.h-2;y+=3)for(let x=q.x+2;x<q.x+q.w-2;x+=3){gx+=Math.abs(lum(x+1,y)-lum(x-1,y));gy+=Math.abs(lum(x,y+1)-lum(x,y-1));}const vertical=gx>=gy,edges=[];if(vertical){for(let y=q.y+2;y<q.y+q.h-2;y+=2){let best=0,pos=0;for(let x=q.x+3;x<q.x+q.w-3;x++){const v=Math.abs(lum(x+1,y)-lum(x-1,y));if(v>best){best=v;pos=x;}}if(best>18)edges.push({t:y,n:pos,strength:best});}}else{for(let x=q.x+2;x<q.x+q.w-2;x+=2){let best=0,pos=0;for(let y=q.y+3;y<q.y+q.h-3;y++){const v=Math.abs(lum(x,y+1)-lum(x,y-1));if(v>best){best=v;pos=y;}}if(best>18)edges.push({t:x,n:pos,strength:best});}}if(edges.length<20)throw Error("找不到足夠清楚的斜邊；請框選單一黑白邊界。 ");const fit=pts=>{const n=pts.length,mt=pts.reduce((s,p)=>s+p.t,0)/n,mn=pts.reduce((s,p)=>s+p.n,0)/n;let a=0,b=0;for(const p of pts){a+=(p.t-mt)*(p.n-mn);b+=(p.t-mt)**2;}a/=b||1;return{a,b:mn-a*mt}};let line=fit(edges);const residuals=edges.map(p=>Math.abs(p.n-(line.a*p.t+line.b))).sort((a,b)=>a-b),limit=Math.max(2,residuals[Math.floor(residuals.length*.6)]*2);const good=edges.filter(p=>Math.abs(p.n-(line.a*p.t+line.b))<=limit);if(good.length<20)throw Error("斜邊定位不穩定；請縮小選取區域。 ");line=fit(good);const bins=Array(128).fill(0),counts=Array(128).fill(0),center=64;for(let y=q.y;y<q.y+q.h;y++)for(let x=q.x;x<q.x+q.w;x++){const t=vertical?y:x,n=vertical?x:y,dist=(n-(line.a*t+line.b))/Math.sqrt(1+line.a**2),k=Math.round(dist*4)+center;if(k>=0&&k<128){bins[k]+=lum(x,y);counts[k]++;}}const esf=bins.map((v,i)=>counts[i]?v/counts[i]:NaN);for(let i=1;i<esf.length;i++)if(!Number.isFinite(esf[i]))esf[i]=esf[i-1];for(let i=esf.length-2;i>=0;i--)if(!Number.isFinite(esf[i]))esf[i]=esf[i+1];if(esf.some(v=>!Number.isFinite(v)))throw Error("無法產生邊緣擴散曲線。 ");const smooth=esf.map((_,i)=>(esf[Math.max(0,i-1)]+2*esf[i]+esf[Math.min(esf.length-1,i+1)])/4);const lsf=smooth.slice(1).map((v,i)=>v-smooth[i]);const N=lsf.length,windowed=lsf.map((v,i)=>v*(.5-.5*Math.cos(2*Math.PI*i/(N-1))));const dc=Math.abs(windowed.reduce((a,b)=>a+b,0));if(dc<10)throw Error("邊緣對比不足，無法估算 MTF50。 ");let mtf50=NaN,prev=1;for(let k=1;k<=Math.floor(N/8);k++){let re=0,im=0;for(let i=0;i<N;i++){const angle=2*Math.PI*k*i/N;re+=windowed[i]*Math.cos(angle);im-=windowed[i]*Math.sin(angle);}const v=Math.hypot(re,im)/dc,f=k/(N*.25);if(v<=.5){const prevF=(k-1)/(N*.25);mtf50=prevF+(f-prevF)*(.5-prev)/(v-prev);break;}prev=v;}if(!Number.isFinite(mtf50))throw Error("MTF 未下降到 50%；請選取較清楚的單一斜邊。 ");const lwph=2*mtf50*d.height;return{label:"MTF50 解析度",value:fmt(lwph,0),unit:"LW/PH",detail:"由單一斜邊的邊緣擴散曲線估算。",metrics:[["MTF50",`${fmt(mtf50,3)} cycles/pixel`],["線對／圖高",`${fmt(lwph/2,0)} LP/PH`],["邊緣方向",vertical?"近垂直":"近水平"],["有效邊緣列",String(good.length)]],method:"斜邊 ESF → LSF → MTF50；LW/PH = 2 × cycles/pixel × image height",data:{mtf50CyclesPerPixel:mtf50,lwPerPictureHeight:lwph,edgeOrientation:vertical?"vertical":"horizontal",edgeSamples:good.length,roi:state.rois.resolution},note:"此數值是單一 ROI 的估算值。需選擇單條斜邊，避免文字、交叉線或多條邊同時進入區域。"};}
function calculateColor(){
  const measured=checkerPatches().flat();
  const patches=measured.map((s,i)=>{
    const reference=colorCheckerReference[i];
    const actual=[s.r,s.g,s.b];
    const m=rgbToLab(s),r=rgbToLab({r:reference[0],g:reference[1],b:reference[2]});
    return {number:i+1,measured:actual,reference,deltaE76:Math.hypot(m.L-r.L,m.a-r.a,m.b-r.b)};
  });
  const errors=patches.map(p=>p.deltaE76);
  const mean=errors.reduce((a,b)=>a+b,0)/patches.length;
  const worst=patches.reduce((a,b)=>b.deltaE76>a.deltaE76?b:a);
  const colorMean=errors.slice(0,18).reduce((a,b)=>a+b,0)/18;
  const grayMean=errors.slice(18).reduce((a,b)=>a+b,0)/6;
  return {label:"24 色平均色差",value:fmt(mean,2),unit:"ΔE*ab",detail:"24 個色塊與 ColorChecker Classic sRGB 參考值比較。",metrics:[["彩色色塊平均",`${fmt(colorMean,2)} ΔE`],["灰階色塊平均",`${fmt(grayMean,2)} ΔE`],["最大色差",`${fmt(worst.deltaE76,2)} · #${worst.number}`],["量測色塊","24 / 24"]],method:"各色塊平均 sRGB → CIELAB (D65)，以 ΔE*ab / CIE76 比較 24 組參考值，再取平均",patches,data:{meanDeltaE76:mean,colorPatchMeanDeltaE76:colorMean,grayPatchMeanDeltaE76:grayMean,patchDeltaE76:errors,measuredSRGB:patches.map(p=>p.measured),referenceSRGB:colorCheckerReference,referenceSource:"X-Rite ColorChecker Classic legacy sRGB D65",roi:state.rois.checker},note:"參考值採舊版 ColorChecker Classic、D65 sRGB。拍攝光源、曝光、色彩描述檔、色卡批次與框選位置會影響色差；不宜直接當作正式校正報告。"};
}
function calculateWhiteBalance(){const neutral=checkerPatches()[3].slice(1,5);const mean={r:neutral.reduce((s,v)=>s+v.r,0)/4,g:neutral.reduce((s,v)=>s+v.g,0)/4,b:neutral.reduce((s,v)=>s+v.b,0)/4};const imbalance=(Math.max(mean.r,mean.g,mean.b)-Math.min(mean.r,mean.g,mean.b))/((mean.r+mean.g+mean.b)/3)*100;const n=neutralDelta(mean),xy=rgbToChromaticity(mean),direction=castDirection(n.lab);return{label:"RGB 不平衡",value:fmt(imbalance,2),unit:"%",detail:`中間四塊灰階平均：${direction}。`,metrics:[["偏色方向",direction],["CIE 1931 xy",`${fmt(xy.x,4)}, ${fmt(xy.y,4)}`],["a* / b*",`${fmt(n.lab.a,1)} / ${fmt(n.lab.b,1)}`],["中性色偏",`${fmt(n.delta,2)} ΔE*ab`],["R / G",fmt(mean.r/mean.g,3)],["B / G",fmt(mean.b/mean.g,3)],["使用色塊","第 4 排 2–5 格"]],chromaticity:xy,method:"四塊中性灰平均 sRGB → 線性 RGB → XYZ (D65) → CIE 1931 xy；a* 正值偏紅、負值偏綠，b* 正值偏黃、負值偏藍；RGB 不平衡 = (max RGB − min RGB) ÷ mean RGB × 100%",data:{rgbImbalancePercent:imbalance,rgRatio:mean.r/mean.g,bgRatio:mean.b/mean.g,neutralDeltaE76:n.delta,labA:n.lab.a,labB:n.lab.b,castDirection:direction,cie1931xy:xy,referenceWhiteXY:{x:.3127,y:.3290},meanRGB:[mean.r,mean.g,mean.b],roi:state.rois.checker},note:"xy 是假設影像採 sRGB 色彩空間的灰階像素估算值，並非光源色度實測。色卡位置、曝光、色彩描述檔及相機處理都會影響結果。"};}
function calculateGray(){const p=checkerPatches()[3],l=p.map(v=>rgbToLab(v).L),steps=l.slice(0,5).map((v,i)=>v-l[i+1]),mono=steps.filter(v=>v>0).length;return{label:"可分辨灰階",value:`${mono} / 5`,unit:"階",detail:"相鄰色塊明度差大於 0 視為排序正確。",metrics:[["明度範圍",`${fmt(l[0],1)} → ${fmt(l[5],1)} L*`],["最小相鄰 ΔL*",fmt(Math.min(...steps),1)],["最大相鄰 ΔL*",fmt(Math.max(...steps),1)],["灰階順序",mono===5?"完整遞減":"有反轉"]],method:"24 色卡底排六塊平均 sRGB → CIELAB L*，比較相鄰明度",data:{labLightness:l,adjacentDeltaL:steps,correctOrderCount:mono,roi:state.rois.checker},swatches:p.map(v=>`rgb(${Math.round(v.r)},${Math.round(v.g)},${Math.round(v.b)})`),note:"此測試反映影像中的灰階排序與間距；沒有曝光及標準參考值時不評定絕對階調誤差。"};}
function calculateSNR(){const p=checkerPatches()[3].slice(1,5),values=p.map(s=>20*Math.log10(s.y/Math.max(s.std,.01))),avg=values.reduce((a,b)=>a+b,0)/values.length;return{label:"單張空間 S/N",value:fmt(avg,1),unit:"dB",detail:"中間四塊灰階，去除線性亮度斜率後估算。",metrics:[["最高灰塊 S/N",`${fmt(values[0],1)} dB`],["最低灰塊 S/N",`${fmt(values[3],1)} dB`],["平均亮度",fmt(p.reduce((a,b)=>a+b.y,0)/4,1)],["灰塊數量","4"]],method:"每塊 Y = 0.2126R + 0.7152G + 0.0722B；平面去趨勢；SNR = 20 log10(mean Y / residual σ)",data:{spatialSnrDb:avg,patchSnrDb:values,roi:state.rois.checker},note:"這是單張影像的空間雜訊估計，會包含紋理、壓縮及固定圖樣；正式 temporal SNR 需要多張同條件照片。"};}
function calculateUniformity(){const r=state.rois.uniformity,pts=[];for(const yy of [.14,.5,.86])for(const xx of [.14,.5,.86]){const cx=r.x+r.w*xx,cy=r.y+r.h*yy;pts.push(sample({x:cx-r.w*.035,y:cy-r.h*.035,w:r.w*.07,h:r.h*.07},3).y);}const center=pts[4],min=Math.min(...pts),max=Math.max(...pts),ratio=min/center*100,corners=[pts[0],pts[2],pts[6],pts[8]];return{label:"最低／中心亮度",value:fmt(ratio,1),unit:"%",detail:"九點採樣中的最低亮度相對中心。",metrics:[["中心亮度",fmt(center,1)],["最低 / 最高",`${fmt(min,1)} / ${fmt(max,1)}`],["四角平均／中心",`${fmt(corners.reduce((a,b)=>a+b,0)/4/center*100,1)} %`],["九點極差",`${fmt((max-min)/center*100,1)} %`]],method:"在選定白板區域的 3 × 3 位置取樣平均亮度，最低值 ÷ 中心值 × 100%",data:{minimumToCenterPercent:ratio,centerLuminance:center,ninePointLuminance:pts,roi:r},note:"請讓選取區域僅包含均勻白板；環境照明不均也會影響結果。"};}
function calculateDistortion(){
  const found=detectChessboard(pixels(),state.rois.distortion);
  state.corners=found;
  return {
    label:"自動格線彎曲率",value:fmt(found.percent,2),unit:"%",
    detail:"水平與垂直格線彎曲率中位數的平均。",
    metrics:[["偵測角點",String(found.cornerCount)],["有效水平／垂直線",`${found.rows.length} / ${found.cols.length}`],["水平彎曲率",`${fmt(found.horizontal,2)} %`],["垂直彎曲率",`${fmt(found.vertical,2)} %`]],
    method:"偵測棋盤格角點 → 依列與欄分組 → 各線最大垂距 ÷ 端點弦長 → 水平、垂直中位數平均",
    data:{lineBowPercent:found.percent,horizontalPercent:found.horizontal,verticalPercent:found.vertical,maxLinePercent:found.max,cornerCount:found.cornerCount,rowCount:found.rows.length,columnCount:found.cols.length,roi:state.rois.distortion,points:found.points.map(p=>({x:p.x*found.scale,y:p.y*found.scale}))},
    note:"自動結果是棋盤格線條彎曲的代理指標；透視傾斜、拍攝角度、格線不平與角點誤判會影響數值，並非經鏡頭模型校正的標準畸變率。"
  };
}
function analyze(){if(!state.img||!state.imageData){showError("請先載入影像。");return;}try{const id=current().id;const functions={resolution:calculateResolution,color:calculateColor,whiteBalance:calculateWhiteBalance,grayScale:calculateGray,snr:calculateSNR,uniformity:calculateUniformity,distortion:calculateDistortion};state.result=functions[id]();if(id==="distortion")draw();$("resultState").textContent="分析完成";$("resultState").className="state-pill done";$("statusText").textContent=`${current().name} 分析完成`;$("exportButton").disabled=false;renderPanel();}catch(e){invalidateResult();draw();$("resultState").textContent="需調整";$("resultState").className="state-pill error";$("statusText").textContent=e.message;renderPanel(e.message);}}
function renderColorComparison(patches){
  return `<div class="section-title">逐色色差</div><div class="patch-help">依色卡由左至右、由上至下排列；色碼為 sRGB，ΔE 採 CIE76。</div><div class="patch-list" role="table" aria-label="24 色量測與參考比較"><div class="patch-row patch-heading" role="row"><span>色塊</span><span>量測</span><span>參考</span><span>ΔE</span></div>${patches.map(p=>`<div class="patch-row" role="row"><span class="patch-number">${p.number}</span><span class="patch-color"><i class="patch-swatch" style="background:${rgbHex(p.measured)}"></i><code>${rgbHex(p.measured)}</code></span><span class="patch-color"><i class="patch-swatch" style="background:${rgbHex(p.reference)}"></i><code>${rgbHex(p.reference)}</code></span><strong>${fmt(p.deltaE76,2)}</strong></div>`).join("")}</div>`;
}
function renderChromaticity(xy){
  const white={x:.3127,y:.3290},pad=.025;
  const minX=Math.min(xy.x,white.x)-pad,maxX=Math.max(xy.x,white.x)+pad;
  const minY=Math.min(xy.y,white.y)-pad,maxY=Math.max(xy.y,white.y)+pad;
  const px=x=>40+(x-minX)/(maxX-minX)*220;
  const py=y=>185-(y-minY)/(maxY-minY)*165;
  const wx=px(white.x),wy=py(white.y),mx=px(xy.x),my=py(xy.y);
  return `<div class="section-title">CIE 1931 xy 色度座標</div><div class="xy-chart"><svg viewBox="0 0 280 218" role="img" aria-label="量測點 x ${fmt(xy.x,4)} y ${fmt(xy.y,4)}；D65 參考白點 x 0.3127 y 0.3290"><rect x="40" y="20" width="220" height="165" rx="4" fill="#101c2b" stroke="#375164"/><line x1="${wx}" y1="20" x2="${wx}" y2="185" stroke="#567587" stroke-dasharray="3 4"/><line x1="40" y1="${wy}" x2="260" y2="${wy}" stroke="#567587" stroke-dasharray="3 4"/><line x1="${wx}" y1="${wy}" x2="${mx}" y2="${my}" stroke="#f0be78" stroke-width="2"/><circle cx="${wx}" cy="${wy}" r="5" fill="#f4f7fb" stroke="#101c2b" stroke-width="2"/><circle cx="${mx}" cy="${my}" r="7" fill="#f0be78" stroke="#101c2b" stroke-width="2"/><text x="40" y="205">${fmt(minX,3)}</text><text x="260" y="205" text-anchor="end">${fmt(maxX,3)} x</text><text x="34" y="24" text-anchor="end">y</text><text x="34" y="184" text-anchor="end">${fmt(minY,3)}</text></svg><div class="xy-legend"><span><i class="xy-dot measured"></i>量測 (${fmt(xy.x,4)}, ${fmt(xy.y,4)})</span><span><i class="xy-dot reference"></i>D65 (0.3127, 0.3290)</span></div></div>`;
}
function renderPanel(error=""){
  const t=current(),key=roiKey();
  const hints={resolution:"拖曳框選 ISO 12233 上的一條斜邊，避開文字與其他線條。",checker:"拖曳框選色卡的完整 6 × 4 色塊矩陣。",uniformity:"拖曳框選白板有效區域；九個採樣點會隨區域移動。",distortion:"按「開始分析」自動抓取角點；必要時拖曳框選棋盤格範圍。"};
  $("interactionHint").textContent=hints[key];
  let html="";
  if(state.result){
    const r=state.result;
    html=`<div class="result-hero"><div class="label">${safe(r.label)}</div><div class="number">${safe(r.value)}<small>${safe(r.unit)}</small></div><div class="detail">${safe(r.detail)}</div></div><div class="section-title">量測數據</div><div class="metric-grid">${r.metrics.map(m=>`<div class="metric"><small>${safe(m[0])}</small><strong>${safe(m[1])}</strong></div>`).join("")}</div>`;
    if(r.chromaticity)html+=renderChromaticity(r.chromaticity);
    if(r.patches)html+=renderColorComparison(r.patches);
    if(r.swatches)html+=`<div class="section-title">灰階樣本</div><div class="swatch-row">${r.swatches.map(c=>`<div class="swatch" style="background:${c}"></div>`).join("")}</div><div class="swatch-row-label"><span>最亮</span><span>最暗</span></div>`;
    html+=`<div class="section-title">計算方法</div><div class="instructions">${safe(r.method)}</div><div class="caution">${safe(r.note)}</div>`;
  }else{
    html=`<div class="empty-state"><div class="empty-icon">◎</div>${error?`<span class="error-text">${safe(error)}</span>`:"選取測試區域後，按「開始分析」查看結果。"}</div><div class="section-title">操作指引</div><div class="instructions">${safe(hints[key])}</div>`;
    html+=`<div class="section-title">量測說明</div><div class="instructions">${safe(({resolution:"以局部斜邊 MTF50 評估影像清晰度。",color:"比較色卡 24 個色塊與標準參考值的平均色差。",whiteBalance:"分析色卡底排中間四個灰階色塊的 RGB 差異。",grayScale:"依底排六個灰階色塊檢查明度是否逐階遞減。",snr:"以灰階色塊去趨勢後的空間標準差估算 S/N。",uniformity:"取白板 3 × 3 九點亮度並與中心比較。",distortion:"自動抓取棋盤格角點，計算水平與垂直格線的彎曲率。"})[t.id])}</div>`;
  }
  $("resultContent").innerHTML=html;
}
selectTest(0);
