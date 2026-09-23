(()=>{'use strict';
const $=id=>document.getElementById(id), svg=$('site'), NS='http://www.w3.org/2000/svg';
let confirmed=false, dragging=false, dragOff={x:0,y:0}, solving=false;
let view={x:0,y:0,w:820,h:780}, panning=false, panStart=null, labelDrag=null;
let housePolyWorld=[], houseResolvedMode='rect';
const defaults={frontW:0,backW:0,leftD:0,rightD:0,diagAC:0,actualParcelArea:0,dryLeftCm:0,dryRightCm:0,dryFrontCm:0,dryBackCm:0,houseShapeMode:'rect',houseW:0,houseD:0,configD:0,waterArea:0,roadArea:0,wallExpr:'0',wallW:0,wallCorners:0,retExpr:'0',retW:0,retCorners:0,houseX:0,houseY:0};
const labelOffsets={};
const n=id=>Math.max(0,Number($(id).value)||0);
const fmt=(v,d=2)=>Number(v||0).toLocaleString('zh-TW',{minimumFractionDigits:d,maximumFractionDigits:d});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function evalExpr(raw){
  const src=String(raw??'').trim(); if(!src)return {ok:true,value:0,src:'0'};
  const z=src.replace(/×/g,'*').replace(/[÷／]/g,'/').replace(/[−–—]/g,'-');
  if(!/^[0-9+\-*/().\s]+$/.test(z))return {ok:false,value:0,src};
  try{const v=Function('"use strict";return ('+z+')')();return Number.isFinite(v)&&v>=0?{ok:true,value:v,src}:{ok:false,value:0,src}}catch(_){return {ok:false,value:0,src}}
}
function wallInfo(exprId,widthId,cornersId){
  const ex=evalExpr($(exprId).value), width=n(widthId), corners=Math.max(0,Math.floor(n(cornersId)));
  const raw=ex.ok?ex.value:0, deduct=corners*width, effective=Math.max(0,raw-deduct), area=effective*width;
  return {ok:ex.ok,expr:ex.src,raw,width,corners,deduct,effective,area};
}
const cross=(a,b,c={x:0,y:0})=>(a.x-c.x)*(b.y-c.y)-(a.y-c.y)*(b.x-c.x);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

function polyArea(pts){let s=0;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];s+=a.x*b.y-b.x*a.y}return Math.abs(s)/2}
function isConvex(pts){let sign=0;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length],c=pts[(i+2)%pts.length];const z=cross(b,c,a);if(Math.abs(z)<1e-8)continue;const s=Math.sign(z);if(!sign)sign=s;else if(sign!==s)return false}return true}
function triangleOK(a,b,c){return a>0&&b>0&&c>0&&a+b>c+1e-8&&a+c>b+1e-8&&b+c>a+1e-8}
function geometry(){
  const F=n('frontW'), BK=n('backW'), L=n('leftD'), R=n('rightD'), AC=n('diagAC');
  if(!(F&&BK&&L&&R&&AC)) return {valid:false,reason:'請完整輸入 AB、BC、CD、DA 與 AC 對角線。'};
  if(!triangleOK(F,R,AC)) return {valid:false,reason:'AB、BC、AC 無法形成三角形，請檢查尺寸。'};
  if(!triangleOK(L,BK,AC)) return {valid:false,reason:'AD、CD、AC 無法形成三角形，請檢查尺寸。'};
  const A={x:0,y:0}, B={x:F,y:0};
  const xC=(F*F+AC*AC-R*R)/(2*F);
  const yC2=AC*AC-xC*xC;
  if(yC2<=0) return {valid:false,reason:'右側三角形退化，請檢查對角線。'};
  const C={x:xC,y:Math.sqrt(yC2)};
  const ux=C.x/AC, uy=C.y/AC;
  const along=(L*L-BK*BK+AC*AC)/(2*AC);
  const h2=L*L-along*along;
  if(h2<=0) return {valid:false,reason:'左側三角形退化，請檢查對角線。'};
  const h=Math.sqrt(h2), foot={x:ux*along,y:uy*along};
  const D1={x:foot.x-uy*h,y:foot.y+ux*h};
  const D2={x:foot.x+uy*h,y:foot.y-ux*h};
  const signB=Math.sign(cross(C,B,A));
  let D=Math.sign(cross(C,D1,A))===-signB?D1:D2;
  let pts=[A,B,C,D];
  if(D.y<=0 || C.y<=0 || !isConvex(pts)){
    D=(D===D1?D2:D1);pts=[A,B,C,D];
  }
  if(D.y<=0 || C.y<=0 || !isConvex(pts)) return {valid:false,reason:'此組尺寸無法建立臨路 AB 在下方的凸四邊形，請確認四邊與對角線。'};
  return {valid:true,A,B,C,D,pts,area:polyArea(pts),avgSide:(L+R)/2,maxPerp:Math.max(C.y,D.y),minRearPerp:Math.min(C.y,D.y)};
}
const geom=()=>geometry();
const area=()=>{const g=geom();return g.valid?g.area:0};
const actualArea=()=>n('actualParcelArea');
const waterArea=()=>n('waterArea');
const roadArea=()=>n('roadArea');
const avgDepth=()=>{const g=geom();return g.valid?g.avgSide:0};
const depth40=()=>avgDepth()*.40;
function zonePts(d){
  const g=geom(); if(!g.valid)return [];
  const t=clamp(g.avgSide>0?d/g.avgSide:0,0,1);
  const Ct={x:g.B.x+(g.C.x-g.B.x)*t,y:g.B.y+(g.C.y-g.B.y)*t};
  const Dt={x:g.A.x+(g.D.x-g.A.x)*t,y:g.A.y+(g.D.y-g.A.y)*t};
  return [g.A,g.B,Ct,Dt];
}
const configAreaAt=d=>{const p=zonePts(d);return p.length?polyArea(p):0};
const configArea=()=>configAreaAt(n('configD'));
function rectHousePoly(){const x=n('houseX'),y=n('houseY'),w=n('houseW'),d=n('houseD');return w>0&&d>0?[{x,y},{x:x+w,y},{x:x+w,y:y+d},{x,y:y+d}]:[]}
function currentHousePoly(){return housePolyWorld.length>=3?housePolyWorld:rectHousePoly()}
const houseArea=()=>{const p=currentHousePoly();return p.length>=3?polyArea(p):0};
const wallArea=()=>wallInfo('wallExpr','wallW','wallCorners').area;
const retArea=()=>wallInfo('retExpr','retW','retCorners').area;
const dryArea=()=>Math.max(0,configArea()-houseArea()-wallArea()-retArea());
const facility=()=>dryArea()+wallArea()+retArea();
const total=()=>houseArea()+facility();
const dryL=()=>n('dryLeftCm')/100, dryR=()=>n('dryRightCm')/100, dryF=()=>n('dryFrontCm')/100, dryB=()=>n('dryBackCm')/100;
function setUnlocked(on){['drySidePanel','designPanel','occupancyPanel','facilityPanel','positionPanel','resultsPanel'].forEach(id=>$(id).classList.toggle('locked',!on))}
function sideWidthValid(v){return v===0||v>=3-.0001}
function normalizeSideWidths(){let l=dryL(),r=dryR(),f=dryF(),b=dryB(),mode=$('houseShapeMode')?.value||'rect';const sideOK=sideWidthValid(l)&&sideWidthValid(r),fbOK=sideWidthValid(f)&&sideWidthValid(b),ok=mode==='frontback'?fbOK:(mode==='auto'?(sideOK||fbOK):sideOK);$('drySideStatus').className='status '+(ok?'ok':'warn');$('drySideStatus').textContent=ok?`左右 ${Math.round(l*100)}/${Math.round(r*100)}cm；前後 ${Math.round(f*100)}/${Math.round(b*100)}cm`:'目前順形方向的留設寬度如大於0，必須至少300cm';return ok}
function updateBase(){
  const g=geom();
  $('parcelArea').value=fmt(g.valid?g.area:0);$('avgDepthOut').value=fmt(g.valid?g.avgSide:0);$('perpDepthOut').value=fmt(g.valid?g.maxPerp:0);
  if(g.valid){
    $('areaFormula').innerHTML=`已重建斜四邊形：圖算面積 <b>${fmt(g.area)}㎡</b>；實際基地面積 <b>${fmt(actualArea())}㎡</b><br>A(0,0)　B(${fmt(g.B.x)},0)　C(${fmt(g.C.x)},${fmt(g.C.y)})　D(${fmt(g.D.x)},${fmt(g.D.y)})`;
    if(!confirmed){if(actualArea()>0){$('parcelStatus').className='status ok';$('parcelStatus').textContent='尺寸與實際基地面積已輸入，請確認基地';}else{$('parcelStatus').className='status warn';$('parcelStatus').textContent='尺寸有效，請再輸入實際基地面積';}}
  }else{
    $('areaFormula').textContent=g.reason;
    $('parcelStatus').className='status warn';$('parcelStatus').textContent='基地尺寸尚未成立';
  }
  if(confirmed){confirmed=false;setUnlocked(false);$('parcelStatus').className='status warn';$('parcelStatus').textContent='基地尺寸已變更，請重新確認後再檢討';}
  draw();
}
function solveConfigDepth(targetHouse){
  const maxD=depth40(), target=targetHouse+329.99;
  if(configAreaAt(maxD)<=target)return maxD;
  let lo=0,hi=maxD;for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(configAreaAt(mid)<target)lo=mid;else hi=mid}return (lo+hi)/2;
}
function xIntervalAtY(poly,y){
  const xs=[]; for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length];
    if(Math.abs(a.y-b.y)<1e-10){if(Math.abs(y-a.y)<1e-8){xs.push(a.x,b.x)}continue}
    const minY=Math.min(a.y,b.y),maxY=Math.max(a.y,b.y); if(y<minY-1e-8||y>maxY+1e-8)continue;
    const t=(y-a.y)/(b.y-a.y); if(t>=-1e-8&&t<=1+1e-8)xs.push(a.x+t*(b.x-a.x));
  }
  xs.sort((a,b)=>a-b); if(xs.length<2)return null; return {left:xs[0],right:xs[xs.length-1]};
}
function usableTopY(cd){const p=zonePts(cd);if(p.length<4)return 0;return Math.max(0,Math.min(p[2].y,p[3].y));}
function availableHouseWidth(y0,y1,l,r,cd){
  const poly=zonePts(cd); if(!poly.length)return {w:0,x:0};
  const samples=[y0,(y0+y1)/2,y1]; let left=-Infinity,right=Infinity;
  for(const y of samples){const iv=xIntervalAtY(poly,y);if(!iv)return {w:0,x:0};left=Math.max(left,iv.left+l);right=Math.min(right,iv.right-r)}
  return {w:Math.max(0,right-left),x:left};
}
function solveHouseAtConfig(cd,target,l,r){
  const top=usableTopY(cd); if(top<=0||target<=0)return {w:0,d:0,x:0,y:0,area:0};
  let hd=Math.min(top,Math.max(.05,Math.sqrt(target)));
  for(let i=0;i<50;i++){
    const y0=Math.max(0,top-hd),av=availableHouseWidth(y0,top,l,r,cd); if(av.w<=0)return {w:0,d:0,x:0,y:0,area:0};
    const newHd=Math.min(top,target/av.w); if(Math.abs(newHd-hd)<1e-5){hd=newHd;break} hd=newHd;
  }
  let y0=Math.max(0,top-hd),av=availableHouseWidth(y0,top,l,r,cd); let w=av.w,actual=w*hd;
  if(actual>target+.001&&hd>0){w=target/hd;actual=target}
  if(actual<target-.01 && hd>=top-.001){actual=w*hd}
  return {w,d:hd,x:av.x,y:y0,area:actual};
}
function lerpPt(a,b,t){return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}}
function crossSectionAt(t){const g=geom();if(!g.valid)return null;t=clamp(t,0,1);return{L:lerpPt(g.A,g.D,t),R:lerpPt(g.B,g.C,t)}}
function lineIntersect(a,b,c,d){const r={x:b.x-a.x,y:b.y-a.y},s={x:d.x-c.x,y:d.y-c.y},den=r.x*s.y-r.y*s.x;if(Math.abs(den)<1e-9)return null;const q={x:c.x-a.x,y:c.y-a.y},u=(q.x*r.y-q.y*r.x)/den,t=(q.x*s.y-q.y*s.x)/den;return{x:a.x+t*r.x,y:a.y+t*r.y,u,t}}
function offsetBoundary(p1,p2,distAmt,interior){const dx=p2.x-p1.x,dy=p2.y-p1.y,L=Math.hypot(dx,dy)||1;let nx,ny;if(interior==='right'){nx=dy/L;ny=-dx/L}else{nx=-dy/L;ny=dx/L}return[{x:p1.x+nx*distAmt,y:p1.y+ny*distAmt},{x:p2.x+nx*distAmt,y:p2.y+ny*distAmt}]}
function polyBounds(poly){if(!poly.length)return{x:0,y:0,w:0,d:0};const xs=poly.map(p=>p.x),ys=poly.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);return{x:minX,y:minY,w:maxX-minX,d:maxY-minY}}
function sideFollowPoly(t0,t1,l,r){const g=geom();if(!g.valid||t1<=t0)return[];const left=offsetBoundary(g.A,g.D,l,'right'),right=offsetBoundary(g.B,g.C,r,'left'),q0=crossSectionAt(t0),q1=crossSectionAt(t1);if(!q0||!q1)return[];const p0=lineIntersect(left[0],left[1],q0.L,q0.R),p1=lineIntersect(right[0],right[1],q0.L,q0.R),p2=lineIntersect(right[0],right[1],q1.L,q1.R),p3=lineIntersect(left[0],left[1],q1.L,q1.R);if(!p0||!p1||!p2||!p3)return[];const poly=[p0,p1,p2,p3].map(({x,y})=>({x,y}));return isConvex(poly)&&polyArea(poly)>1e-5?poly:[]}
function solveSideFollow(cd,target,l,r){const g=geom();if(!g.valid||target<=0)return{poly:[],area:0,mode:'side'};const t1=clamp(g.avgSide?cd/g.avgSide:0,0,1);if(t1<=0)return{poly:[],area:0,mode:'side'};const full=sideFollowPoly(0,t1,l,r);if(!full.length)return{poly:[],area:0,mode:'side'};const fullA=polyArea(full);if(fullA<=target+.001)return{poly:full,area:fullA,mode:'side'};let lo=0,hi=t1,best=full;for(let i=0;i<60;i++){const mid=(lo+hi)/2,p=sideFollowPoly(mid,t1,l,r),a=p.length?polyArea(p):0;if(a>target){lo=mid}else{hi=mid;best=p}}const poly=best.length?best:sideFollowPoly(hi,t1,l,r);return{poly,area:poly.length?polyArea(poly):0,mode:'side'}}
function frontBackPoly(t0,t1,inset){const q0=crossSectionAt(t0),q1=crossSectionAt(t1);if(!q0||!q1||t1<=t0)return[];const u0=clamp(inset,0,.499),u1=1-u0;return[lerpPt(q0.L,q0.R,u0),lerpPt(q0.L,q0.R,u1),lerpPt(q1.L,q1.R,u1),lerpPt(q1.L,q1.R,u0)]}
function solveFrontBack(cd,target,front,back){const g=geom();if(!g.valid||target<=0)return{poly:[],area:0,mode:'frontback'};const tc=clamp(g.avgSide?cd/g.avgSide:0,0,1),t0=clamp(g.avgSide?front/g.avgSide:0,0,tc),t1=clamp(tc-(g.avgSide?back/g.avgSide:0),t0,tc);if(t1<=t0)return{poly:[],area:0,mode:'frontback'};const full=frontBackPoly(t0,t1,0),fullA=polyArea(full);if(fullA<=target+.001)return{poly:full,area:fullA,mode:'frontback'};let lo=0,hi=.499,best=full;for(let i=0;i<60;i++){const mid=(lo+hi)/2,p=frontBackPoly(t0,t1,mid),a=polyArea(p);if(a>target)lo=mid;else{hi=mid;best=p}}return{poly:best,area:polyArea(best),mode:'frontback'}}
function rectSolution(cd,target,l,r){const hs=solveHouseAtConfig(cd,target,l,r);const poly=hs.w>0&&hs.d>0?[{x:hs.x,y:hs.y},{x:hs.x+hs.w,y:hs.y},{x:hs.x+hs.w,y:hs.y+hs.d},{x:hs.x,y:hs.y+hs.d}]:[];return{...hs,poly,area:poly.length?polyArea(poly):0,mode:'rect'}}
function solveHouseCandidate(cd,target){const mode=$('houseShapeMode')?.value||'rect',l=dryL(),r=dryR(),f=dryF(),b=dryB(),sideOK=sideWidthValid(l)&&sideWidthValid(r),fbOK=sideWidthValid(f)&&sideWidthValid(b);if(mode==='rect')return rectSolution(cd,target,l,r);if(mode==='side')return sideOK?solveSideFollow(cd,target,l,r):{poly:[],area:0,mode:'side'};if(mode==='frontback')return fbOK?solveFrontBack(cd,target,f,b):{poly:[],area:0,mode:'frontback'};const side=sideOK?solveSideFollow(cd,target,l,r):{poly:[],area:0,mode:'side'},fb=fbOK?solveFrontBack(cd,target,f,b):{poly:[],area:0,mode:'frontback'};if(fb.area>side.area+.01)return fb;return side.area>0?side:fb}
function applyHouseSolution(sol){housePolyWorld=(sol.poly||[]).map(p=>({x:p.x,y:p.y}));houseResolvedMode=sol.mode||'rect';const b=polyBounds(housePolyWorld);$('houseW').value=fmt(b.w);$('houseD').value=fmt(b.d);$('houseX').value=fmt(b.x);$('houseY').value=fmt(b.y);if($('houseShapeStatus')){const labels={rect:'90°矩形',side:'順左右地界',frontback:'順前後界線'};$('houseShapeStatus').textContent=`目前：${labels[houseResolvedMode]||houseResolvedMode}｜圖算 ${fmt(sol.area)}㎡`;}}
function solveLockedHouse(){
  if(!confirmed||!$('lockDrySides').checked||solving)return;solving=true;normalizeSideWidths();
  const limit=actualArea()*.10; let cd=n('configD');
  if($('autoConfig').checked)cd=solveConfigDepth(limit); cd=Math.min(cd,depth40());
  let hs={poly:[],area:0,mode:'rect'};
  for(let i=0;i<12;i++){
    hs=solveHouseCandidate(cd,limit);
    if(!$('autoConfig').checked)break;
    const newCd=solveConfigDepth(hs.area); if(Math.abs(newCd-cd)<.001){cd=newCd;break} cd=newCd;
  }
  hs=solveHouseCandidate(cd,limit);$('configD').value=fmt(cd);applyHouseSolution(hs);solving=false;
}
function validateManualPosition(){
  housePolyWorld=[];houseResolvedMode='rect';
  if($('lockDrySides').checked)return; const cd=n('configD'),hw=n('houseW'),hd=n('houseD'); const top=usableTopY(cd);
  let y=clamp(n('houseY'),0,Math.max(0,top-hd)); let av=availableHouseWidth(y,y+hd,0,0,cd); let w=Math.min(hw,av.w); let x=clamp(n('houseX'),av.x,Math.max(av.x,av.x+av.w-w));
  $('houseW').value=fmt(w);$('houseX').value=fmt(x);$('houseY').value=fmt(y);
}
function updateWallUI(){
  const w=wallInfo('wallExpr','wallW','wallCorners'),r=wallInfo('retExpr','retW','retCorners');
  $('wallCalc').textContent=w.ok?`有效長度 ${fmt(w.effective)}m × ${fmt(w.width)}m = ${fmt(w.area)}㎡`:'圍牆總長算式錯誤';
  $('retCalc').textContent=r.ok?`有效長度 ${fmt(r.effective)}m × ${fmt(r.width)}m = ${fmt(r.area)}㎡`:'擋土牆總長算式錯誤';
}
function updateHouseModeUI(){const mode=$('houseShapeMode')?.value||'rect',conform=mode!=='rect';if(conform){$('lockDrySides').checked=true;$('lockDrySides').disabled=true;$('houseW').readOnly=true;$('houseD').readOnly=true;$('houseX').readOnly=true;$('houseY').readOnly=true}else{$('lockDrySides').disabled=false;const locked=$('lockDrySides').checked;$('houseW').readOnly=locked;$('houseD').readOnly=false;$('houseX').readOnly=locked;$('houseY').readOnly=false}if($('houseShapeStatus')&&mode==='rect')$('houseShapeStatus').textContent='目前：90°矩形';}
function recalc(){updateWallUI();updateHouseModeUI();if(!confirmed){draw();return}if($('lockDrySides').checked)solveLockedHouse();else validateManualPosition();$('houseArea').value=fmt(houseArea());$('houseLimit').value=fmt(actualArea()*.10);$('depth40').value=fmt(depth40());normalizeSideWidths();draw();results()}

function applyView(){svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);const z=820/view.w;$('zoomLabel').textContent=`${Math.round(z*100)}%`}
function resetView(){view={x:0,y:0,w:820,h:780};applyView()}
function zoomAt(cx,cy,factor){const old={...view};const aspect=780/820;let nw=clamp(old.w*factor,120,1800),nh=nw*aspect;const rx=(cx-old.x)/old.w,ry=(cy-old.y)/old.h;view={x:cx-rx*nw,y:cy-ry*nh,w:nw,h:nh};applyView()}
function screenToSvg(clientX,clientY){const r=svg.getBoundingClientRect();return{x:view.x+(clientX-r.left)/r.width*view.w,y:view.y+(clientY-r.top)/r.height*view.h}}
function e(name,attrs={},txt=''){const el=document.createElementNS(NS,name);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);if(txt!==undefined&&txt!=='')el.textContent=txt;return el}
function clearSvg(){while(svg.firstChild)svg.removeChild(svg.firstChild)}
function pointMapper(g){
  const pts=g.valid?g.pts:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}],xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);const spanX=Math.max(1,maxX-minX),spanY=Math.max(1,maxY-minY);const s=Math.min(500/spanX,600/spanY);const ox=410-(minX+maxX)/2*s, oy=700+minY*s; const P=(x,y)=>({x:ox+x*s,y:oy-y*s}); return {s,ox,oy,P,minX,maxX,minY,maxY};
}
function mapWorldPoints(points,P){
  return points.map(p=>P(p.x,p.y)).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
}
function addLabel(name,x,y,text,opts={}){
  const off=labelOffsets[name]||{dx:0,dy:0};
  const g=e('g',{'data-label':name,class:'draggable-label',transform:`translate(${off.dx} ${off.dy})`});
  const cls=opts.small?'svg-small':'svg-label', anchor=opts.anchor||'middle';
  const attrs={x,y,'text-anchor':anchor,class:cls};
  if(opts.fontSize)attrs['font-size']=opts.fontSize;
  if(opts.fill)attrs.fill=opts.fill;
  const t=e('text',attrs,text);g.appendChild(t);svg.appendChild(g);
  const bb=t.getBBox();
  const hit=e('rect',{x:bb.x-6,y:bb.y-5,width:bb.width+12,height:bb.height+10,fill:'transparent','pointer-events':'all'});
  g.insertBefore(hit,t);
  g.addEventListener('pointerdown',ev=>{ev.stopPropagation();labelDrag={name,start:screenToSvg(ev.clientX,ev.clientY),orig:{...(labelOffsets[name]||{dx:0,dy:0})}};g.setPointerCapture(ev.pointerId)});
  g.addEventListener('pointermove',ev=>{if(!labelDrag||labelDrag.name!==name)return;const cur=screenToSvg(ev.clientX,ev.clientY);const no={dx:labelDrag.orig.dx+(cur.x-labelDrag.start.x),dy:labelDrag.orig.dy+(cur.y-labelDrag.start.y)};labelOffsets[name]=no;g.setAttribute('transform',`translate(${no.dx} ${no.dy})`)});
  g.addEventListener('pointerup',()=>labelDrag=null);g.addEventListener('pointercancel',()=>labelDrag=null);
}
function drawDimension(x,y1,y2,label,color,dashed=false,name='dim'){
  svg.appendChild(e('line',{x1:x,y1,x2:x,y2,stroke:color,'stroke-width':1.4,'stroke-dasharray':dashed?'6 5':'0','vector-effect':'non-scaling-stroke'}));
  svg.appendChild(e('line',{x1:x-5,y1,x2:x+5,y2:y1,stroke:color,'stroke-width':1.1,'vector-effect':'non-scaling-stroke'}));
  svg.appendChild(e('line',{x1:x-5,y1:y2,x2:x+5,y2,stroke:color,'stroke-width':1.1,'vector-effect':'non-scaling-stroke'}));
  addLabel(name,x+8,y2,label,{anchor:'start',small:true,fill:color});
}
function draw(){
  clearSvg();
  svg.appendChild(e('rect',{x:0,y:0,width:820,height:780,fill:'#fbfcfa'}));
  const g=geom();
  if(!g.valid){addLabel('emptyHint',410,370,'請先輸入有效的基地四邊與 AC 對角線',{fontSize:14});return}

  const {s,P}=pointMapper(g),pp=mapWorldPoints(g.pts,P);
  const polyStr=pp.map(p=>`${p.x},${p.y}`).join(' ');

  // 基地白底。所有色塊都在此之後、基地外框之前繪製，避免被蓋掉。
  svg.appendChild(e('polygon',{points:polyStr,fill:'#ffffff',stroke:'none'}));

  const d40=Math.min(depth40(),g.avgSide);
  const z40World=zonePts(d40), z40=mapWorldPoints(z40World,P);
  let cd=0, cp=[];
  if(confirmed){cd=Math.min(n('configD'),d40);cp=mapWorldPoints(zonePts(cd),P)}

  // V0.9.2：完全改回 V0.4 的可靠圖層方式。
  // 先畫「整個 40% 範圍」的淺藍色，再疊上「目前配置範圍」的綠色。
  // 不使用 SVG style 字串，改用直接 fill / fill-opacity 屬性，避免部分 Chrome 本機檔案環境不顯示色塊。
  if(d40>0){
    svg.appendChild(e('polygon',{
      points:z40.map(p=>`${p.x},${p.y}`).join(' '),
      class:'zone-depth40',
      fill:'#3977c2','fill-opacity':'0.12',
      stroke:'#3977c2','stroke-width':'1.5','stroke-dasharray':'8 6',
      'vector-effect':'non-scaling-stroke','pointer-events':'none'
    }));

    if(confirmed && cd>0){
      svg.appendChild(e('polygon',{
        points:cp.map(p=>`${p.x},${p.y}`).join(' '),
        class:'zone-config',
        fill:'#6fbd62','fill-opacity':'0.55',
        stroke:'#559a4c','stroke-width':'1.7',
        'vector-effect':'non-scaling-stroke','pointer-events':'none'
      }));
    }

    // 40% 控制線再補畫一次，確保邊界永遠清楚。
    svg.appendChild(e('line',{
      x1:z40[3].x,y1:z40[3].y,x2:z40[2].x,y2:z40[2].y,
      stroke:'#3977c2','stroke-width':1.8,'stroke-dasharray':'8 6','vector-effect':'non-scaling-stroke'
    }));
  }

  if(confirmed){
    // 目前配置線
    if(cd>0){
      svg.appendChild(e('line',{
        x1:cp[3].x,y1:cp[3].y,x2:cp[2].x,y2:cp[2].y,
        stroke:'#559a4c','stroke-width':1.6,'stroke-dasharray':'5 4','vector-effect':'non-scaling-stroke'
      }));
    }

    const hpoly=currentHousePoly(),hsvg=mapWorldPoints(hpoly,P),hx=n('houseX'),hy=n('houseY'),hw=n('houseW'),hd=n('houseD');
    if(hsvg.length>=3&&houseArea()>0){
      const houseShape=e('polygon',{
        id:'houseShape',points:hsvg.map(p=>`${p.x},${p.y}`).join(' '),
        fill:'#ef6b1f',stroke:'#b9480d','stroke-width':2,'vector-effect':'non-scaling-stroke',
        class:'house-grab',style:`cursor:${(!$('lockDrySides').checked&&houseResolvedMode==='rect')?'grab':'not-allowed'}`
      });
      svg.appendChild(houseShape);
      const hc=hsvg.reduce((a,p)=>({x:a.x+p.x,y:a.y+p.y}),{x:0,y:0});hc.x/=hsvg.length;hc.y/=hsvg.length;
      addLabel('houseLabel',hc.x,hc.y-5,'農舍',{fontSize:12});
      addLabel('houseAreaLabel',hc.x,hc.y+12,`${fmt(houseArea())}㎡`,{small:true});
      addLabel('houseModeLabel',hc.x,hc.y+28,houseResolvedMode==='rect'?'90°矩形':(houseResolvedMode==='side'?'順左右地界':'順前後界線'),{small:true,fill:'#8a3a0b'});

      if($('lockDrySides').checked&&dryL()+dryR()>0){
        const ys=hpoly.map(p=>p.y),ym=(Math.min(...ys)+Math.max(...ys))/2,poly=zonePts(cd),iv=xIntervalAtY(poly,ym),hiv=xIntervalAtY(hpoly,ym);
        if(iv&&hiv){
          const lp=P(iv.left,ym),lh=P(hiv.left,ym),rh=P(hiv.right,ym),rp=P(iv.right,ym);
          svg.appendChild(e('line',{x1:lp.x,y1:lp.y,x2:lh.x,y2:lh.y,stroke:'#4d9251','stroke-width':1.5,'vector-effect':'non-scaling-stroke'}));
          svg.appendChild(e('line',{x1:rh.x,y1:rh.y,x2:rp.x,y2:rp.y,stroke:'#4d9251','stroke-width':1.5,'vector-effect':'non-scaling-stroke'}));
          addLabel('leftDryLabel',(lp.x+lh.x)/2,lp.y-8,`左 ${Math.round(dryL()*100)}cm`,{small:true});
          addLabel('rightDryLabel',(rh.x+rp.x)/2,rh.y-8,`右 ${Math.round(dryR()*100)}cm`,{small:true});
        }
      }
      if(!$('lockDrySides').checked&&houseResolvedMode==='rect'){
        houseShape.addEventListener('pointerdown',ev=>{dragging=true;const pt=screenToLocal(ev.clientX,ev.clientY);dragOff={x:pt.x-hx,y:pt.y-hy};svg.setPointerCapture(ev.pointerId);ev.stopPropagation()})
      }
    }

    if(cd>0){
      // 將曬場標示放在綠色配置區內、農舍下方優先，避免與農舍文字重疊。
      const bottomCenter={x:(cp[0].x+cp[1].x)/2,y:(cp[0].y+cp[1].y)/2};
      const topCenter={x:(cp[3].x+cp[2].x)/2,y:(cp[3].y+cp[2].y)/2};
      const labelY=bottomCenter.y+(topCenter.y-bottomCenter.y)*0.25;
      const labelX=bottomCenter.x+(topCenter.x-bottomCenter.x)*0.25;
      addLabel('dryAreaLabel',labelX,labelY,`曬場 ${fmt(dryArea())}㎡`,{fontSize:11,fill:'#356d35'});

      // 配置區面積標示靠配置線，與曬場文字分開。
      addLabel('configAreaLabel',(cp[3].x+cp[2].x)/2,(cp[3].y+cp[2].y)/2-12,`配置區 ${fmt(configArea())}㎡`,{fontSize:11,fill:'#3f7f3a'});
    }
  }

  const A=P(g.A.x,g.A.y),B=P(g.B.x,g.B.y),C=P(g.C.x,g.C.y),D=P(g.D.x,g.D.y);

  // 臨路側強調線
  svg.appendChild(e('line',{x1:A.x,y1:A.y,x2:B.x,y2:B.y,stroke:'#111','stroke-width':5,'stroke-linecap':'round','vector-effect':'non-scaling-stroke'}));
  addLabel('frontLabel',(A.x+B.x)/2,(A.y+B.y)/2+24,`臨路側 ${fmt(n('frontW'))}m`,{fontSize:12});
  addLabel('backLabel',(C.x+D.x)/2,(C.y+D.y)/2-12,`背面 ${fmt(n('backW'))}m`,{small:true});
  addLabel('leftLabel',(A.x+D.x)/2-18,(A.y+D.y)/2,`左 ${fmt(n('leftD'))}m`,{small:true});
  addLabel('rightLabel',(B.x+C.x)/2+18,(B.y+C.y)/2,`右 ${fmt(n('rightD'))}m`,{small:true});

  svg.appendChild(e('line',{x1:A.x,y1:A.y,x2:C.x,y2:C.y,stroke:'#8b8f8c','stroke-width':1.1,'stroke-dasharray':'7 6','vector-effect':'non-scaling-stroke'}));
  addLabel('diagLabel',(A.x+C.x)/2+10,(A.y+C.y)/2-9,`AC ${fmt(n('diagAC'))}m`,{small:true});

  // 右側深度尺寸：基地最大深度、40%最大縱深、目前配置縱深
  const rightX=Math.max(...pp.map(p=>p.x)); const yBase=(A.y+B.y)/2;
  const maxY=P(0,g.maxPerp).y;
  drawDimension(rightX+30,yBase,maxY,`基地最大深度 ${fmt(g.maxPerp)}m`,'#66736a',false,'maxDepthLabel');
  if(d40>0){const y40=(z40[2].y+z40[3].y)/2;drawDimension(rightX+58,yBase,y40,`40% 最大縱深 ${fmt(d40)}m`,'#3977c2',true,'depth40Label')}
  if(confirmed&&cd>0){const yc=(cp[2].y+cp[3].y)/2;drawDimension(rightX+86,yBase,yc,`目前配置 ${fmt(cd)}m`,'#5b9953',false,'configDepthLabel')}

  [['A',A],['B',B],['C',C],['D',D]].forEach(([name,p])=>{
    svg.appendChild(e('circle',{cx:p.x,cy:p.y,r:3.4,fill:'#fff',stroke:'#1d2921','stroke-width':1.6,'vector-effect':'non-scaling-stroke'}));
    svg.appendChild(e('text',{x:p.x+6,y:p.y-6,class:'svg-small'},name))
  });

  // 基地外框最後重畫，固定在最上層，不會再被藍／綠色塊遮掉。
  svg.appendChild(e('polygon',{points:polyStr,fill:'none',stroke:'#26342b','stroke-width':2.2,'vector-effect':'non-scaling-stroke','pointer-events':'none'}));
}
function screenToLocal(clientX,clientY){const g=geom();if(!g.valid)return{x:0,y:0};const m=pointMapper(g),q=screenToSvg(clientX,clientY);return{x:(q.x-m.ox)/m.s,y:(m.oy-q.y)/m.s}}
function results(){
  const g=geom();if(!g.valid)return;
  const graphA=area(),A=actualArea(),hA=houseArea(),hL=A*.10,w=wallInfo('wallExpr','wallW','wallCorners'),r=wallInfo('retExpr','retW','retCorners'),wA=w.area,rA=r.area;
  const rawDry=configArea()-hA-wA-rA,dA=Math.max(0,rawDry),fac=dA+wA+rA,cd=n('configD'),d40v=depth40(),l=dryL(),rr=dryR();
  const water=waterArea(),road=roadArea(),ag40Total=hA+dA+water+road,ag40Limit=A*.40;
  const f=dryF(),b=dryB(),sideOK=sideWidthValid(l)&&sideWidthValid(rr)&&sideWidthValid(f)&&sideWidthValid(b),houseOK=hA<=hL+.02,facOK=fac<=330+.02,depthOK=cd<=d40v+.02,ag40OK=ag40Total<=ag40Limit+.02;
  const data=[
    ['圖算基地面積',graphA,'㎡',true],
    ['實際基地面積',A,'㎡',A>0],
    ['農舍面積',hA,'㎡',houseOK],
    ['農舍10%上限',hL,'㎡',true],
    ['曬場面積',dA,'㎡',rawDry>=-.01],
    ['圍牆面積',wA,'㎡',w.ok],
    ['擋土牆面積',rA,'㎡',r.ok],
    ['曬場＋牆體',fac,'㎡',facOK],
    ['水利溝占用',water,'㎡',true],
    ['道路占用',road,'㎡',true],
    ['40%農設用地合計',ag40Total,'㎡',ag40OK],
    ['40%農設用地上限',ag40Limit,'㎡',true],
    ['配置平均縱深',cd,'m',depthOK],
    ['40%最大縱深',d40v,'m',true],
    ['左側曬場',l,'m',sideWidthValid(l)],
    ['右側曬場',rr,'m',sideWidthValid(rr)],
    ['前側保留',f,'m',sideWidthValid(f)],
    ['後側保留',b,'m',sideWidthValid(b)]
  ];
  $('cards').innerHTML=data.map(([k,v,u,ok])=>`<div class="card"><small>${k}</small><b>${fmt(v)} ${u}</b><span class="${ok?'pass':'fail'}">${ok?'✓ OK':'✕ 需調整'}</span></div>`).join('');
  const wallFormula=w.ok
    ? `圍牆：總長 ${w.expr} = <b>${fmt(w.raw)}m</b>；轉角扣除 ${w.corners} × ${fmt(w.width)} = <b>${fmt(w.deduct)}m</b>；面積 (${fmt(w.raw)} − ${w.corners}×${fmt(w.width)}) × ${fmt(w.width)} = <b>${fmt(wA)}㎡</b>`
    : `圍牆：<b>總長算式錯誤</b>`;
  const retFormula=r.ok
    ? `擋土牆：總長 ${r.expr} = <b>${fmt(r.raw)}m</b>；轉角扣除 ${r.corners} × ${fmt(r.width)} = <b>${fmt(r.deduct)}m</b>；面積 (${fmt(r.raw)} − ${r.corners}×${fmt(r.width)}) × ${fmt(r.width)} = <b>${fmt(rA)}㎡</b>`
    : `擋土牆：<b>總長算式錯誤</b>`;
  const lines=[
    `基地面積：圖算 <b>${fmt(graphA)}㎡</b>；法規檢討採實際基地面積 <b>${fmt(A)}㎡</b>`,
    `農舍10%上限：${fmt(A)} × 10% = <b>${fmt(hL)}㎡</b>`,
    `40%最大平均縱深：(${fmt(n('leftD'))}+${fmt(n('rightD'))}) ÷ 2 × 40% = <b>${fmt(d40v)}m</b>`,
    `配置區幾何面積：<b>${fmt(configArea())}㎡</b>；目前配置縱深：<b>${fmt(cd)}m</b>`,
    houseResolvedMode==='rect'?`農舍（90°矩形）：${fmt(n('houseW'))} × ${fmt(n('houseD'))} = <b>${fmt(hA)}㎡</b>`:`農舍用地（${houseResolvedMode==='side'?'順左右地界':'順前後界線'}）：多邊形圖算面積 = <b>${fmt(hA)}㎡</b>；包絡寬 ${fmt(n('houseW'))}m／深 ${fmt(n('houseD'))}m`,
    wallFormula,
    retFormula,
    `曬場：${fmt(configArea())} − ${fmt(hA)} − ${fmt(wA)} − ${fmt(rA)} = <b>${fmt(rawDry)}㎡</b>`,
    `曬場＋圍牆＋擋土牆：${fmt(dA)} + ${fmt(wA)} + ${fmt(rA)} = <b>${fmt(fac)}㎡</b> ≤ 330㎡`,
    `水利溝占用：<b>${fmt(water)}㎡</b>；道路占用：<b>${fmt(road)}㎡</b>`,
    `40%農業設施用地面積：農舍 ${fmt(hA)} + 曬場 ${fmt(dA)} + 水利溝 ${fmt(water)} + 道路 ${fmt(road)} = <b>${fmt(ag40Total)}㎡</b> ≤ 實際基地 ${fmt(A)} × 40% = <b>${fmt(ag40Limit)}㎡</b>`,
    `留設寬度：左 <b>${fmt(l)}m</b>／右 <b>${fmt(rr)}m</b>／前 <b>${fmt(f)}m</b>／後 <b>${fmt(b)}m</b>；有留設時最窄需 ≥ 3.00m`
  ];
  $('formulas').innerHTML=lines.map(x=>`<div class="formula-line">${x}</div>`).join('');
  updateWallUI();
}
function confirmParcel(){const g=geom();if(!g.valid){confirmed=false;setUnlocked(false);$('parcelStatus').className='status warn';$('parcelStatus').textContent=g.reason;draw();return}if(actualArea()<=0){confirmed=false;setUnlocked(false);$('parcelStatus').className='status warn';$('parcelStatus').textContent='請先輸入實際基地面積，再確認基地';draw();return}confirmed=true;setUnlocked(true);$('parcelStatus').className='status ok';$('parcelStatus').textContent='基地尺寸與實際面積已確認，開始自動配置農舍／曬場';$('houseLimit').value=fmt(actualArea()*.10);$('depth40').value=fmt(depth40());recalc()}

['frontW','backW','leftD','rightD','diagAC'].forEach(id=>$(id).addEventListener('input',updateBase));
$('actualParcelArea').addEventListener('input',()=>{if(confirmed)recalc();else updateBase()});
['dryLeftCm','dryRightCm','dryFrontCm','dryBackCm'].forEach(id=>$(id).addEventListener('input',recalc));
['waterArea','roadArea'].forEach(id=>$(id).addEventListener('input',recalc));
['wallExpr','wallW','wallCorners','retExpr','retW','retCorners'].forEach(id=>$(id).addEventListener('input',recalc));
['houseD','configD'].forEach(id=>$(id).addEventListener('input',recalc));
['houseW','houseX','houseY'].forEach(id=>$(id).addEventListener('input',()=>{if(!$('lockDrySides').checked){validateManualPosition();draw();results()}}));
$('lockDrySides').addEventListener('change',()=>{updateHouseModeUI();recalc()});
$('houseShapeMode').addEventListener('change',()=>{housePolyWorld=[];updateHouseModeUI();recalc()});
$('fitHouseBtn').addEventListener('click',()=>{$('houseShapeMode').value='auto';housePolyWorld=[];updateHouseModeUI();recalc()});
$('autoConfig').addEventListener('change',recalc);$('confirmParcel').addEventListener('click',confirmParcel);$('printBtn').addEventListener('click',()=>window.print());
$('resetLabelsBtn').addEventListener('click',()=>{Object.keys(labelOffsets).forEach(k=>delete labelOffsets[k]);draw()});
$('resetBtn').addEventListener('click',()=>{for(const[k,v]of Object.entries(defaults))$(k).value=v;$('lockDrySides').checked=true;$('autoConfig').checked=true;$('houseW').readOnly=true;$('houseX').readOnly=true;Object.keys(labelOffsets).forEach(k=>delete labelOffsets[k]);housePolyWorld=[];houseResolvedMode='rect';confirmed=false;setUnlocked(false);$('parcelStatus').className='status warn';$('parcelStatus').textContent='尚未確認基地';$('houseArea').value=fmt(0);$('houseLimit').value=fmt(0);$('depth40').value=fmt(0);resetView();updateWallUI();updateHouseModeUI();updateBase()});
svg.addEventListener('wheel',ev=>{ev.preventDefault();const p=screenToSvg(ev.clientX,ev.clientY);zoomAt(p.x,p.y,ev.deltaY<0?0.84:1.19)},{passive:false});
$('zoomIn').addEventListener('click',()=>zoomAt(view.x+view.w/2,view.y+view.h/2,0.84));$('zoomOut').addEventListener('click',()=>zoomAt(view.x+view.w/2,view.y+view.h/2,1.19));$('fitView').addEventListener('click',resetView);

// Desktop: one-pointer pan. Mobile: one-finger pan + two-finger pinch zoom.
const activePointers=new Map(); let pinchStart=null;
function ptrDistance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function ptrMid(a,b){return{x:(a.x+b.x)/2,y:(a.y+b.y)/2}}
svg.addEventListener('pointerdown',ev=>{
  if(ev.target&&(ev.target.id==='houseShape'||(ev.target.closest&&ev.target.closest('[data-label]'))))return;
  activePointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});svg.setPointerCapture(ev.pointerId);
  if(activePointers.size===1){panning=true;pinchStart=null;panStart={clientX:ev.clientX,clientY:ev.clientY,view:{...view}};svg.classList.add('panning')}
  else if(activePointers.size===2){const [a,b]=[...activePointers.values()],mid=ptrMid(a,b),r=svg.getBoundingClientRect(),old={...view};pinchStart={dist:ptrDistance(a,b),view:old,centerSvg:{x:old.x+(mid.x-r.left)/r.width*old.w,y:old.y+(mid.y-r.top)/r.height*old.h}};panning=false;panStart=null;svg.classList.add('panning')}
});
svg.addEventListener('pointermove',ev=>{
  if(dragging&&!$('lockDrySides').checked){const pt=screenToLocal(ev.clientX,ev.clientY);$('houseX').value=fmt(pt.x-dragOff.x);$('houseY').value=fmt(pt.y-dragOff.y);validateManualPosition();draw();results();return}
  if(activePointers.has(ev.pointerId))activePointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
  if(activePointers.size>=2&&pinchStart){const [a,b]=[...activePointers.values()],curDist=Math.max(10,ptrDistance(a,b)),mid=ptrMid(a,b),r=svg.getBoundingClientRect(),aspect=780/820,nw=clamp(pinchStart.view.w*(pinchStart.dist/curDist),120,1800),nh=nw*aspect,rx=(mid.x-r.left)/r.width,ry=(mid.y-r.top)/r.height;view.x=pinchStart.centerSvg.x-rx*nw;view.y=pinchStart.centerSvg.y-ry*nh;view.w=nw;view.h=nh;applyView();return}
  if(!panning||!panStart)return;const r=svg.getBoundingClientRect(),dx=ev.clientX-panStart.clientX,dy=ev.clientY-panStart.clientY;view.x=panStart.view.x-dx*panStart.view.w/r.width;view.y=panStart.view.y-dy*panStart.view.h/r.height;applyView()
});
function endPan(ev){dragging=false;if(ev&&activePointers.has(ev.pointerId))activePointers.delete(ev.pointerId);pinchStart=null;if(activePointers.size===1){const [id,p]=[...activePointers.entries()][0];panning=true;panStart={clientX:p.x,clientY:p.y,view:{...view}}}else{panning=false;panStart=null;svg.classList.remove('panning')}}
svg.addEventListener('pointerup',endPan);svg.addEventListener('pointercancel',endPan);
$('houseW').readOnly=true;$('houseX').readOnly=true;setUnlocked(false);resetView();updateHouseModeUI();$('resetBtn').click();
})();
