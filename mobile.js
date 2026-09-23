(()=>{'use strict';
const $=id=>document.getElementById(id);
const STORAGE_KEY='skh-agricheck-cases-v1';
const DRAFT_KEY='skh-agricheck-draft-v1';
const inputIds=['frontW','backW','leftD','rightD','diagAC','actualParcelArea','dryLeftCm','dryRightCm','dryFrontCm','dryBackCm','houseShapeMode','houseW','houseD','configD','waterArea','roadArea','wallExpr','wallW','wallCorners','retExpr','retW','retCorners','houseX','houseY'];
const checkIds=['lockDrySides','autoConfig'];
let deferredInstall=null, toastTimer=null, draftTimer=null;

function toast(msg){const el=$('toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2200)}
function isConfirmed(){return $('parcelStatus')?.classList.contains('ok')||false}
function snapshot(name=''){const values={};inputIds.forEach(id=>{const el=$(id);if(el)values[id]=el.value});const checks={};checkIds.forEach(id=>{const el=$(id);if(el)checks[id]=!!el.checked});return{format:'SKH-AgriCheck',version:'1.1',name:name||$('caseName')?.value?.trim()||'未命名案件',savedAt:new Date().toISOString(),confirmed:isConfirmed(),values,checks}}
function getCases(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')}catch(_){return[]}}
function setCases(cases){localStorage.setItem(STORAGE_KEY,JSON.stringify(cases));renderRecentCases()}
function getDraft(){try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||'null')}catch(_){return null}}
function setDraft(data){try{localStorage.setItem(DRAFT_KEY,JSON.stringify(data))}catch(_){}updateCurrentSummary()}
function clearDraft(){localStorage.removeItem(DRAFT_KEY);updateCurrentSummary()}
function safeName(s){return String(s||'SKH-AgriCheck').replace(/[\\/:*?"<>|]/g,'_').slice(0,80)}
function formatTime(iso){try{return new Intl.DateTimeFormat('zh-TW',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(iso))}catch(_){return iso}}
function trigger(el,type){el?.dispatchEvent(new Event(type,{bubbles:true}))}

function hasMeaningfulInput(data){if(!data?.values)return false;return ['frontW','backW','leftD','rightD','diagAC','actualParcelArea','houseW','houseD','configD'].some(id=>Math.abs(Number(data.values[id])||0)>0)}
function updateCurrentSummary(){const el=$('currentCaseSummary');if(!el)return;const d=getDraft();if(!d||!hasMeaningfulInput(d)){el.textContent='尚未建立案件';return}const area=Number(d.values?.actualParcelArea)||Number(d.values?.parcelArea)||0;const status=d.confirmed?'基地已確認':'編輯中';el.textContent=`${d.name||'目前案件'} · ${status}${area?` · ${area.toFixed(2)}㎡`:''}`}
function scheduleDraft(){clearTimeout(draftTimer);draftTimer=setTimeout(()=>{const d=snapshot(($('caseName')?.value||'').trim()||'目前案件');if(hasMeaningfulInput(d)||d.confirmed)setDraft(d)},420)}

function applyCase(data,{toastMessage=true}={}){if(!data||!data.values)return false;
  $('resetBtn')?.click();
  inputIds.forEach(id=>{if(data.values[id]!==undefined&&$(id))$(id).value=data.values[id]});
  checkIds.forEach(id=>{if(data.checks&&data.checks[id]!==undefined&&$(id)){$(id).checked=!!data.checks[id];trigger($(id),'change')}});
  trigger($('frontW'),'input');
  if(data.confirmed){setTimeout(()=>$('confirmParcel')?.click(),0)}
  if($('caseName'))$('caseName').value=data.name||'';
  setDraft({...data,savedAt:new Date().toISOString()});
  if(toastMessage)toast(`已載入：${data.name||'案件'}`);
  return true;
}
function renderCases(){const list=$('caseList');if(!list)return;const cases=getCases().sort((a,b)=>(b.savedAt||'').localeCompare(a.savedAt||''));if(!cases.length){list.innerHTML='<div class="caseEmpty">尚未儲存案件</div>';return}list.innerHTML='';cases.forEach(item=>{const row=document.createElement('div');row.className='caseItem';const meta=document.createElement('div');meta.className='caseMeta';meta.innerHTML='<b></b><span></span>';meta.querySelector('b').textContent=item.name||'未命名案件';meta.querySelector('span').textContent=`${formatTime(item.savedAt)} · ${item.confirmed?'已確認基地':'未確認基地'}`;const actions=document.createElement('div');actions.className='caseItemActions';const load=document.createElement('button');load.textContent='開啟';load.onclick=()=>{applyCase(item);closeCaseDialog();switchTab('input')};const exp=document.createElement('button');exp.textContent='匯出';exp.onclick=()=>downloadJSON(item);const del=document.createElement('button');del.textContent='刪除';del.className='dangerBtn';del.onclick=()=>{if(confirm(`刪除「${item.name}」？`)){setCases(getCases().filter(x=>x.id!==item.id));renderCases();toast('案件已刪除')}};actions.append(load,exp,del);row.append(meta,actions);list.appendChild(row)})}
function renderRecentCases(){const box=$('recentCases');if(!box)return;const cases=getCases().sort((a,b)=>(b.savedAt||'').localeCompare(a.savedAt||'')).slice(0,3);if(!cases.length){box.innerHTML='<div class="recentEmpty">尚未儲存案件，從「新增案件」開始。</div>';return}box.innerHTML='';cases.forEach(item=>{const card=document.createElement('article');card.className='recentCard';const area=Number(item.values?.actualParcelArea)||0;const status=item.confirmed?'已確認':'未確認';card.innerHTML='<b></b><span></span><div class="recentMeta"><em></em><i></i></div>';card.querySelector('b').textContent=item.name||'未命名案件';card.querySelector('span').textContent=formatTime(item.savedAt);card.querySelector('em').textContent=status;card.querySelector('i').textContent=area?`${area.toFixed(2)}㎡`:'—';card.querySelector('em').style.fontStyle='normal';card.querySelector('i').style.fontStyle='normal';card.addEventListener('click',()=>{applyCase(item);switchTab('input')});box.appendChild(card)})}
function saveCurrent(){const name=($('caseName')?.value||'').trim()||`案件 ${new Date().toLocaleDateString('zh-TW')}`;const data=snapshot(name),cases=getCases();const existing=cases.find(x=>x.name===name);if(existing){data.id=existing.id;const i=cases.indexOf(existing);cases[i]=data}else{data.id=(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36));cases.push(data)}setCases(cases);$('caseName').value=name;setDraft(data);renderCases();toast(`已儲存：${name}`)}
function downloadJSON(data=snapshot()){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${safeName(data.name)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已匯出 JSON')}
async function shareCurrent(){const data=snapshot(),json=JSON.stringify(data,null,2),file=new File([json],`${safeName(data.name)}.json`,{type:'application/json'});try{if(navigator.canShare?.({files:[file]})){await navigator.share({title:data.name,text:'SKH AgriCheck 案件',files:[file]})}else if(navigator.share){await navigator.share({title:data.name,text:`SKH AgriCheck｜${data.name}`})}else{downloadJSON(data)}}catch(e){if(e?.name!=='AbortError')downloadJSON(data)}}
async function importJSON(file){try{const data=JSON.parse(await file.text());if(data.format!=='SKH-AgriCheck'&&!data.values)throw new Error('格式不符');applyCase(data);const cases=getCases();data.id=data.id||(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36));data.savedAt=new Date().toISOString();cases.push(data);setCases(cases);renderCases();toast('案件已匯入')}catch(e){alert('無法匯入此 JSON：'+e.message)}}
function openCaseDialog(){renderCases();const d=$('caseDialog');if(!d)return;if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','')}
function closeCaseDialog(){const d=$('caseDialog');if(!d)return;if(typeof d.close==='function')d.close();else d.removeAttribute('open')}
function switchTab(tab){document.body.classList.remove('app-home','mobile-tab-input','mobile-tab-drawing','mobile-tab-results');document.querySelectorAll('[data-mobile-tab]').forEach(b=>b.classList.toggle('active',b.dataset.mobileTab===tab));if(tab==='cases'){openCaseDialog();return}if(tab==='home'){document.body.classList.add('app-home');renderRecentCases();updateCurrentSummary()}else{document.body.classList.add(`mobile-tab-${tab}`)}if(tab==='drawing')setTimeout(()=>$('fitView')?.click(),50);window.scrollTo({top:0,behavior:'smooth'})}
function newCase(){if(hasMeaningfulInput(getDraft())&&!confirm('建立新案件會清除目前尚未儲存的內容，確定繼續？'))return;$('resetBtn')?.click();if($('caseName'))$('caseName').value='';clearDraft();switchTab('input');toast('已建立空白案件')}
function continueCase(){const d=getDraft();if(d&&hasMeaningfulInput(d)){applyCase(d,{toastMessage:false});switchTab('input');toast('已繼續目前案件')}else{switchTab('input')}}
function installHelp(){const isiOS=/iphone|ipad|ipod/i.test(navigator.userAgent),txt=$('installHelpText');if(txt)txt.textContent=isiOS?'在 Safari 點「分享」→「加入主畫面」，即可像 App 一樣使用。':'請用 Chrome／Edge 的選單選擇「安裝應用程式」或「加入主畫面」。';$('installHelp').hidden=false}
async function installApp(){if(deferredInstall){deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$('installBtn').hidden=true}else installHelp()}
function updateNetwork(){let badge=document.getElementById('offlineBadge');if(!navigator.onLine){if(!badge){badge=document.createElement('span');badge.id='offlineBadge';badge.className='offlineBadge';badge.textContent='離線';document.querySelector('header h1')?.appendChild(badge)}}else badge?.remove()}

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('installBtn').hidden=false});
window.addEventListener('appinstalled',()=>{deferredInstall=null;$('installBtn').hidden=true;toast('App 已安裝')});
window.addEventListener('online',updateNetwork);window.addEventListener('offline',updateNetwork);updateNetwork();

$('saveCaseBtn')?.addEventListener('click',()=>{openCaseDialog();setTimeout(()=>$('caseName')?.focus(),100)});
$('caseManagerBtn')?.addEventListener('click',openCaseDialog);$('installBtn')?.addEventListener('click',installApp);$('homeBtn')?.addEventListener('click',()=>switchTab('home'));
$('brandHome')?.addEventListener('click',()=>switchTab('home'));$('brandHome')?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();switchTab('home')}});
$('newCaseHome')?.addEventListener('click',newCase);$('openCasesHome')?.addEventListener('click',openCaseDialog);$('manageCasesHome')?.addEventListener('click',openCaseDialog);$('continueCaseHome')?.addEventListener('click',continueCase);
$('closeCaseDialog')?.addEventListener('click',closeCaseDialog);$('saveCurrentCase')?.addEventListener('click',saveCurrent);$('exportCaseBtn')?.addEventListener('click',()=>downloadJSON());$('shareCaseBtn')?.addEventListener('click',shareCurrent);$('importCaseBtn')?.addEventListener('click',()=>$('importCaseFile')?.click());$('importCaseFile')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)importJSON(f);e.target.value='' });
$('closeInstallHelp')?.addEventListener('click',()=>{$('installHelp').hidden=true});$('installHelp')?.addEventListener('click',e=>{if(e.target===$('installHelp'))$('installHelp').hidden=true});
$('caseDialog')?.addEventListener('click',e=>{if(e.target===$('caseDialog'))closeCaseDialog()});
document.querySelectorAll('[data-mobile-tab]').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.mobileTab)));

// 自動保留目前工作草稿，不寫入案件清單；正式案件仍由「儲存案件」管理。
[...inputIds,...checkIds].forEach(id=>{const el=$(id);if(!el)return;el.addEventListener('input',scheduleDraft);el.addEventListener('change',scheduleDraft)});
if($('parcelStatus'))new MutationObserver(scheduleDraft).observe($('parcelStatus'),{attributes:true,childList:true,subtree:true});

if('serviceWorker'in navigator && location.protocol!=='file:')window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
const isiOS=/iphone|ipad|ipod/i.test(navigator.userAgent);const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;if(isiOS&&!standalone)$('installBtn').hidden=false;
if(location.protocol==='file:'){$('installBtn').hidden=false;$('installBtn').title='PWA 安裝需透過本機伺服器或網站開啟'}
renderRecentCases();updateCurrentSummary();switchTab('home');
})();
