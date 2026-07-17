'use strict';
const $=id=>document.getElementById(id); const DB='ReformHubDB', STORE='projects';
const state={id:null,base:null,history:[],members:{},sendHistory:{},updatedAt:null};
const canvas=$('canvas'),ctx=canvas.getContext('2d'),today=new Date();
$('today').textContent=today.toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric',weekday:'long'});
$('date').value=new Date(Date.now()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);
$('staff').value=localStorage.getItem('rhStaff')||'';
let deferredPrompt,draw=false,drawMode=false,timer;
function toast(t){clearTimeout(timer);$('toast').textContent=t;$('toast').classList.add('show');timer=setTimeout(()=>$('toast').classList.remove('show'),2200)}
function screen(id){document.querySelectorAll('.screen').forEach(x=>x.classList.toggle('active',x.id===id));scrollTo({top:0,behavior:'smooth'})}
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>screen(b.dataset.go));
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE)){const s=r.result.createObjectStore(STORE,{keyPath:'id'});s.createIndex('updatedAt','updatedAt')}};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function all(){const db=await openDB();return new Promise((res,rej)=>{const r=db.transaction(STORE).objectStore(STORE).getAll();r.onsuccess=()=>res(r.result.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))));r.onerror=()=>rej(r.error)})}
async function put(x){const db=await openDB();return new Promise((res,rej)=>{const t=db.transaction(STORE,'readwrite');t.objectStore(STORE).put(x);t.oncomplete=()=>res();t.onerror=()=>rej(t.error)})}
async function del(id){const db=await openDB();return new Promise((res,rej)=>{const t=db.transaction(STORE,'readwrite');t.objectStore(STORE).delete(id);t.oncomplete=res;t.onerror=()=>rej(t.error)})}
const uid=()=>crypto.randomUUID?.()||Date.now()+'-'+Math.random();
function fields(){return {id:state.id||uid(),propertyName:$('projectName').value.trim()||'名称未入力の物件',workArea:$('area').value,date:$('date').value,staff:$('staff').value.trim(),note:$('note').value.trim(),image:state.base?canvas.toDataURL('image/jpeg',.8):null,baseImage:state.base,members:state.members||{},sendHistory:state.sendHistory||{},updatedAt:new Date().toISOString(),createdAt:state.createdAt||new Date().toISOString()}}
function draft(){localStorage.setItem('rhDraft',JSON.stringify({...fields(),id:state.id,history:undefined}));$('autosave').textContent='✓ 入力内容は途中保存されています'}
['projectName','area','date','staff','note'].forEach(id=>$(id).addEventListener('input',()=>{if(id==='projectName')syncName();draft()}));
function syncName(){$('workName').textContent=$('projectName').value.trim()||'新しい物件'}
async function refreshHome(){const p=await all();if(p[0]){$('currentWrap').classList.remove('hidden');$('currentName').textContent=p[0].propertyName;$('currentUpdated').textContent='最終更新 '+new Date(p[0].updatedAt).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});$('continueBtn').onclick=()=>load(p[0])}else $('currentWrap').classList.add('hidden')}
$('newProjectBtn').onclick=()=>{$('newName').value='';$('newDialog').showModal()};
$('createBtn').onclick=()=>{reset();$('projectName').value=$('newName').value.trim()||'新しい物件';syncName();$('newDialog').close();screen('work');setTimeout(()=>$('memberDialog').showModal(),300)};
$('listBtn').onclick=async()=>{await render();screen('projects')};
function reset(){state.id=null;state.base=null;state.history=[];state.members={};state.sendHistory={};state.createdAt=null;ctx.clearRect(0,0,canvas.width,canvas.height);$('empty').classList.remove('hidden');$('projectName').value='';$('note').value='';$('area').value='家全体';$('date').value=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);$('undoBtn').disabled=$('clearBtn').disabled=true;setDrawMode(false)}
$('photoInput').onchange=e=>loadPhoto(e.target.files?.[0]);
function loadPhoto(file){if(!file)return;const url=URL.createObjectURL(file),im=new Image();im.onload=()=>{const scale=Math.min(1,1800/Math.max(im.width,im.height));canvas.width=im.width*scale;canvas.height=im.height*scale;ctx.drawImage(im,0,0,canvas.width,canvas.height);state.base=canvas.toDataURL('image/jpeg',.84);state.history=[canvas.toDataURL()];$('empty').classList.add('hidden');$('undoBtn').disabled=$('clearBtn').disabled=false;URL.revokeObjectURL(url);draft();setDrawMode(false);toast('写真を読み込みました。必要な時だけ「写真に書く」を押してください')};im.src=url}
function pos(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}}
function setDrawMode(on){
  drawMode=!!on;
  $('drawbar').classList.toggle('hidden',!drawMode);
  $('startDrawBtn').classList.toggle('hidden',drawMode||!state.base);
  $('viewBadge').textContent=drawMode?'書くモード':'見るモード';
  $('viewBadge').classList.toggle('drawing',drawMode);
  canvas.classList.toggle('drawing',drawMode);
  canvas.style.touchAction=drawMode?'none':'pan-x pan-y pinch-zoom';
  draw=false;
}
$('startDrawBtn').onclick=()=>{if(!state.base)return;setDrawMode(true);toast('書くモードです。ペンだけで書けます')};
$('finishDrawBtn').onclick=()=>{setDrawMode(false);draft();toast('書き込みを終了しました')};
canvas.onpointerdown=e=>{
  if(!state.base||!drawMode)return;
  if(e.pointerType==='touch'&&!$('fingerDraw').checked)return;
  draw=true;e.preventDefault();canvas.setPointerCapture?.(e.pointerId);
  const p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y)
};
canvas.onpointermove=e=>{
  if(!draw||!drawMode)return;e.preventDefault();
  const p=pos(e);ctx.lineTo(p.x,p.y);ctx.strokeStyle=$('color').value;
  ctx.lineWidth=+$('width').value*canvas.width/canvas.getBoundingClientRect().width;
  ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke()
};
canvas.onpointerup=canvas.onpointercancel=()=>{
  if(!draw)return;draw=false;state.history.push(canvas.toDataURL());
  if(state.history.length>15)state.history.shift();draft()
};
function drawUrl(url){return new Promise(res=>{const im=new Image();im.onload=()=>{canvas.width=im.width;canvas.height=im.height;ctx.drawImage(im,0,0);res()};im.src=url})}
$('undoBtn').onclick=async()=>{if(state.history.length<2)return;state.history.pop();await drawUrl(state.history.at(-1));toast('一つ戻しました')};
$('clearBtn').onclick=async()=>{if(!state.base)return;await drawUrl(state.base);state.history=[state.base];toast('書いた線を消しました')};
$('voiceBtn').onclick=()=>{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){toast('この端末では音声入力を使えません');return}const r=new SR();r.lang='ja-JP';r.interimResults=false;r.onstart=()=>{$('voiceBtn').textContent='🎤 聞いています…'};r.onresult=e=>{$('note').value+=($('note').value?'\n':'')+e.results[0][0].transcript;draft()};r.onend=()=>{$('voiceBtn').textContent='🎤 話して入力'};r.start()};
$('memberBtn').onclick=()=>{fillMembers();$('memberDialog').showModal()};
function fillMembers(){const m=state.members||{};['customerName','customerEmail','customerPhone','vendorName','vendorEmail','vendorPhone','employeeName','employeeEmail','selfName','selfEmail'].forEach(k=>$(k).value=m[k]||'');['customerMethod','vendorMethod','employeeMethod','selfMethod'].forEach(k=>$(k).value=m[k]||({customerMethod:'email',vendorMethod:'email',employeeMethod:'teams',selfMethod:'teams'}[k]))}
$('saveMembersBtn').onclick=()=>{const m={};['customerName','customerEmail','customerPhone','vendorName','vendorEmail','vendorPhone','employeeName','employeeEmail','selfName','selfEmail'].forEach(k=>m[k]=$(k).value.trim());['customerMethod','vendorMethod','employeeMethod','selfMethod'].forEach(k=>m[k]=$(k).value);state.members=m;localStorage.setItem('rhSelf',JSON.stringify({selfName:m.selfName,selfEmail:m.selfEmail}));$('memberDialog').close();draft();toast('送る相手を登録しました')};
$('finishBtn').onclick=async()=>{if(!$('projectName').value.trim()){toast('物件名を入れてください');$('projectName').focus();return}const p=fields();state.id=p.id;state.updatedAt=p.updatedAt;localStorage.setItem('rhStaff',p.staff);await put(p);localStorage.removeItem('rhDraft');await refreshHome();openShare(p);toast('この端末に保存しました')};
function shareText(p){return `【Reform Hub 打合せ記録】\n物件：${p.propertyName}\n日付：${p.date||''}\n場所：${p.workArea||''}\n\n確認したこと\n${p.note||'写真をご確認ください'}\n\n担当：${p.staff||''}`}
function blobFromData(url){return fetch(url).then(r=>r.blob())}
function historyEntry(value){
  if(!value)return {};
  if(typeof value==='string')return {openedAt:value};
  return value;
}
async function markOpened(p,key){
  const stamp=new Date().toISOString();
  const old=historyEntry((p.sendHistory||{})[key]);
  p.sendHistory={...(p.sendHistory||{}),[key]:{...old,openedAt:stamp}};
  state.sendHistory=p.sendHistory;
  p.updatedAt=new Date().toISOString();
  await put(p);
  await refreshHome();
  localStorage.setItem('rhPendingShare',JSON.stringify({projectId:p.id,key,openedAt:stamp}));
  return stamp;
}
async function markConfirmed(p,key){
  const stamp=new Date().toISOString();
  const old=historyEntry((p.sendHistory||{})[key]);
  p.sendHistory={...(p.sendHistory||{}),[key]:{...old,confirmedAt:stamp}};
  state.sendHistory=p.sendHistory;
  p.updatedAt=new Date().toISOString();
  await put(p);
  await refreshHome();
  localStorage.removeItem('rhPendingShare');
  return stamp;
}
function recipientLabel(key){
  return {customer:'お客様',vendor:'業者',employee:'社員',self:'自分'}[key]||'相手';
}
let pendingConfirm=null;
async function showPendingConfirm(){
  if(document.visibilityState==='hidden'||$('confirmSentDialog').open)return;
  let pending;
  try{pending=JSON.parse(localStorage.getItem('rhPendingShare')||'null')}catch{}
  if(!pending)return;
  const projects=await all();
  const p=projects.find(x=>x.id===pending.projectId);
  if(!p){localStorage.removeItem('rhPendingShare');return}
  const h=historyEntry((p.sendHistory||{})[pending.key]);
  if(h.confirmedAt){localStorage.removeItem('rhPendingShare');return}
  pendingConfirm={p,key:pending.key};
  $('confirmSentWho').textContent=`${recipientLabel(pending.key)}への送信`;
  $('confirmSentDialog').showModal();
}
function recipientText(p,role){
  const lead={
    customer:'本日のお打合せで確認した内容をお送りします。',
    vendor:'施工に関する確認内容をお送りします。',
    employee:'社内共有用の打合せ記録です。',
    self:'自分用の打合せ控えです。'
  }[role]||'打合せ記録をお送りします。';
  return `${lead}\n\n${shareText(p)}`;
}
function methodLabel(method){
  return {email:'メール',sms:'SMS',teams:'Teams',share:'写真付き共有'}[method]||'送る';
}
async function sendToPerson(p,role,label,method,address,phone){
  const text=recipientText(p,role);
  try{
    await markOpened(p,role);
    if(method==='email'){
      if(!address){toast('メールアドレスを登録してください');localStorage.removeItem('rhPendingShare');return}
      location.href=`mailto:${encodeURIComponent(address)}?subject=${encodeURIComponent('【Reform Hub】'+p.propertyName+' 打合せ記録')}&body=${encodeURIComponent(text)}`;
      return;
    }
    if(method==='sms'){
      if(!phone){toast('携帯番号を登録してください');localStorage.removeItem('rhPendingShare');return}
      location.href=`sms:${phone}?body=${encodeURIComponent(text)}`;
      return;
    }
    if(method==='teams'){
      if(!address){toast('Teams用アドレスを登録してください');localStorage.removeItem('rhPendingShare');return}
      try{await navigator.clipboard?.writeText(text)}catch{}
      location.href=`https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(address)}&message=${encodeURIComponent(text)}`;
      return;
    }
    const data={title:`${p.propertyName} 打合せ記録`,text};
    if(p.image){
      const blob=await blobFromData(p.image);
      const file=new File([blob],`${p.propertyName}-打合せ.jpg`,{type:'image/jpeg'});
      if(navigator.canShare?.({files:[file]}))data.files=[file];
    }
    if(navigator.share){
      await navigator.share(data);
      toast(`${label}への共有画面を開きました`);
      setTimeout(showPendingConfirm,400);
    }else{
      await navigator.clipboard?.writeText(text);
      toast('文章をコピーしました');
      setTimeout(showPendingConfirm,400);
    }
  }catch(e){
    if(e.name==='AbortError')localStorage.removeItem('rhPendingShare');
    else{try{await navigator.clipboard?.writeText(text)}catch{};toast('文章をコピーしました')}
  }
}
async function openShare(p,reopen=false){
  const fresh=(await all()).find(x=>x.id===p.id)||p;
  p=fresh;
  $('shareProjectName').textContent=p.propertyName+'／'+(p.date||'');
  const m=p.members||{}, history=p.sendHistory||{};
  const box=$('recipientButtons');box.innerHTML='';
  const rec=[
    {key:'customer',icon:'🏠',role:'お客様',name:m.customerName,email:m.customerEmail,phone:m.customerPhone,method:m.customerMethod||'email'},
    {key:'vendor',icon:'👷',role:'業者',name:m.vendorName,email:m.vendorEmail,phone:m.vendorPhone,method:m.vendorMethod||'email'},
    {key:'employee',icon:'👥',role:'社員',name:m.employeeName,email:m.employeeEmail,phone:'',method:m.employeeMethod||'teams'},
    {key:'self',icon:'👤',role:'自分',name:m.selfName,email:m.selfEmail,phone:'',method:m.selfMethod||'teams'}
  ];
  let complete=0;
  rec.forEach(r=>{
    const card=document.createElement('section');card.className='recipient-card';
    const h=historyEntry(history[r.key]);
    const confirmed=!!h.confirmedAt;
    const opened=!!h.openedAt;
    if(confirmed)complete++;
    const status=confirmed?'✓ 確認済み':opened?'確認待ち':'未確認';
    const statusClass=confirmed?'sent':opened?'waiting':'unsent';
    const when=confirmed?h.confirmedAt:h.openedAt;
    const timeText=when?new Date(when).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
    const contact=r.email||r.phone||'送り先未登録';
    const method=methodLabel(r.method);
    card.innerHTML=`<div class="recipient-head"><div><strong>${r.icon} ${r.role}${r.name?'　'+esc(r.name):''}</strong><small>${esc(contact)}</small><em>${esc(method)}で送る設定</em></div><span class="${statusClass}">${status}</span></div><div class="recipient-time">${timeText}</div><button class="send-photo">📤 ${esc(method)}で送る</button><button class="change-method">送り方を変更</button>${opened&&!confirmed?'<button class="manual-confirm">✓ 送りました</button>':''}`;
    card.querySelector('.send-photo').onclick=()=>sendToPerson(p,r.key,r.role,r.method,r.email,r.phone);
    card.querySelector('.change-method').onclick=()=>{$('shareDialog').close();fillMembers();$('memberDialog').showModal()};
    const manual=card.querySelector('.manual-confirm');
    if(manual)manual.onclick=async()=>{await markConfirmed(p,r.key);toast(`${r.role}を確認済みにしました`);await openShare(p,true)};
    box.appendChild(card);
  });
  const finish=$('finishShareBtn');
  finish.textContent=complete===4?'✓ 全員の確認が完了':'送る作業を終える';
  finish.classList.toggle('complete',complete===4);
  if(!reopen||!$('shareDialog').open)$('shareDialog').showModal();
}
$('confirmSentYes').onclick=async()=>{
  if(!pendingConfirm)return;
  await markConfirmed(pendingConfirm.p,pendingConfirm.key);
  const label=recipientLabel(pendingConfirm.key);
  $('confirmSentDialog').close();
  toast(`${label}を確認済みにしました`);
  const p=(await all()).find(x=>x.id===pendingConfirm.p.id)||pendingConfirm.p;
  pendingConfirm=null;
  if($('shareDialog').open)await openShare(p,true);
};
$('confirmSentLater').onclick=()=>{
  $('confirmSentDialog').close();
  pendingConfirm=null;
  toast('確認待ちとして残しました');
};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(showPendingConfirm,500)});
window.addEventListener('focus',()=>setTimeout(showPendingConfirm,500));
$('closeShare').onclick=()=>{$('shareDialog').close();screen('home')};$('finishShareBtn').onclick=()=>{$('shareDialog').close();screen('home');toast('打合せ記録を保存しました')};
async function load(p){state.id=p.id;state.createdAt=p.createdAt;state.base=p.baseImage||p.image||null;state.members=p.members||{};state.sendHistory=p.sendHistory||{};$('projectName').value=p.propertyName||'';$('area').value=p.workArea||'家全体';$('date').value=p.date||$('date').value;$('staff').value=p.staff||'';$('note').value=p.note||'';syncName();if(p.image){await drawUrl(p.image);$('empty').classList.add('hidden');state.history=[p.image];$('undoBtn').disabled=$('clearBtn').disabled=false;setDrawMode(false)}else{$('empty').classList.remove('hidden');setDrawMode(false)}screen('work')}
async function render(){const q=$('search').value.toLowerCase(),ps=(await all()).filter(p=>(p.propertyName+' '+p.note+' '+p.workArea).toLowerCase().includes(q));$('projectList').innerHTML=ps.length?'':'<div class="project-item"><h3>まだ保存された物件はありません</h3><p>ホームから「新しい物件」を始めてください。</p></div>';ps.forEach(p=>{const d=document.createElement('article');d.className='project-item';d.innerHTML=`<h3>${esc(p.propertyName)}</h3><div class="meta">${esc(p.date||'')} ・ ${esc(p.workArea||'')}</div><p>${esc((p.note||'写真の記録').slice(0,120))}</p><div class="actions"><button class="open">開く</button><button class="share">送る</button><button class="delete">削除</button></div>`;d.querySelector('.open').onclick=()=>load(p);d.querySelector('.share').onclick=()=>openShare(p);d.querySelector('.delete').onclick=async()=>{if(confirm('この物件の記録を削除しますか？')){await del(p.id);render();refreshHome()}};$('projectList').appendChild(d)})}
$('search').oninput=render;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
$('exportBtn').onclick=async()=>{const data=JSON.stringify({version:1,exportedAt:new Date().toISOString(),projects:await all()},null,2);const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type:'application/json'}));a.download='reform-hub-backup.json';a.click();URL.revokeObjectURL(a.href)};
$('importInput').onchange=async e=>{try{const j=JSON.parse(await e.target.files[0].text());for(const p of j.projects||[])await put(p);await render();await refreshHome();toast('バックアップを読み込みました')}catch{toast('読み込めないファイルです')}};
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e});$('installBtn').onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null}else alert('iPadではSafariの共有ボタンを押し、「ホーム画面に追加」を選んでください。')};
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
(async()=>{try{const d=JSON.parse(localStorage.getItem('rhDraft')||'null');if(d){state.id=d.id||null;state.members=d.members||{};state.sendHistory=d.sendHistory||{};$('projectName').value=d.propertyName||'';$('area').value=d.workArea||'家全体';$('date').value=d.date||$('date').value;$('staff').value=d.staff||$('staff').value;$('note').value=d.note||'';syncName()}const self=JSON.parse(localStorage.getItem('rhSelf')||'{}');state.members.selfName=state.members.selfName||self.selfName||'';state.members.selfEmail=state.members.selfEmail||self.selfEmail||'';await refreshHome()}catch(e){console.error(e)}})();
