'use strict';
const $=id=>document.getElementById(id); const DB='ReformHubDB', STORE='projects';
const state={id:null,base:null,history:[],photos:[],activePhoto:-1,members:{},sendHistory:{},updatedAt:null};
const canvas=$('canvas'),ctx=canvas.getContext('2d'),today=new Date();
$('today').textContent=today.toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric',weekday:'long'});
$('date').value=new Date(Date.now()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);
$('staff').value=localStorage.getItem('rhStaff')||'';
let deferredPrompt,draw=false,drawMode=false,drawArmedAt=0,strokeMoved=false,timer;
function toast(t){clearTimeout(timer);$('toast').textContent=t;$('toast').classList.add('show');timer=setTimeout(()=>$('toast').classList.remove('show'),2200)}
function screen(id){document.querySelectorAll('.screen').forEach(x=>x.classList.toggle('active',x.id===id));scrollTo({top:0,behavior:'smooth'})}
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>screen(b.dataset.go));
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE)){const s=r.result.createObjectStore(STORE,{keyPath:'id'});s.createIndex('updatedAt','updatedAt')}};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function all(){const db=await openDB();return new Promise((res,rej)=>{const r=db.transaction(STORE).objectStore(STORE).getAll();r.onsuccess=()=>res(r.result.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))));r.onerror=()=>rej(r.error)})}
async function put(x){const db=await openDB();return new Promise((res,rej)=>{const t=db.transaction(STORE,'readwrite');t.objectStore(STORE).put(x);t.oncomplete=()=>res();t.onerror=()=>rej(t.error)})}
async function del(id){const db=await openDB();return new Promise((res,rej)=>{const t=db.transaction(STORE,'readwrite');t.objectStore(STORE).delete(id);t.oncomplete=res;t.onerror=()=>rej(t.error)})}
const uid=()=>crypto.randomUUID?.()||Date.now()+'-'+Math.random();
function fields(){
  saveActivePhoto();
  const photos=state.photos.map((p,i)=>({
    id:p.id||uid(),
    image:p.image||null,
    baseImage:p.baseImage||p.image||null,
    caption:p.caption||`写真${i+1}`
  }));
  return {
    id:state.id||uid(),
    propertyName:$('projectName').value.trim()||'名称未入力の物件',
    workArea:$('area').value,
    date:$('date').value,
    staff:$('staff').value.trim(),
    note:$('note').value.trim(),
    photos,
    image:photos[0]?.image||null,
    baseImage:photos[0]?.baseImage||null,
    members:state.members||{},
    sendHistory:state.sendHistory||{},
    updatedAt:new Date().toISOString(),
    createdAt:state.createdAt||new Date().toISOString()
  }
}
function draft(){localStorage.setItem('rhDraft',JSON.stringify({...fields(),id:state.id,history:undefined}));$('autosave').textContent='✓ 入力内容は途中保存されています'}
['projectName','area','date','staff','note','photoCaption'].forEach(id=>$(id).addEventListener('input',()=>{if(id==='projectName')syncName();if(id==='photoCaption'&&state.activePhoto>=0)state.photos[state.activePhoto].caption=$('photoCaption').value;draft()}));
function syncName(){$('workName').textContent=$('projectName').value.trim()||'新しい物件'}
async function refreshHome(){const p=await all();if(p[0]){$('currentWrap').classList.remove('hidden');$('currentName').textContent=p[0].propertyName;$('currentUpdated').textContent='最終更新 '+new Date(p[0].updatedAt).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});$('continueBtn').onclick=()=>load(p[0])}else $('currentWrap').classList.add('hidden')}
$('newProjectBtn').onclick=()=>{$('newName').value='';$('newDialog').showModal()};
$('createBtn').onclick=()=>{reset();$('projectName').value=$('newName').value.trim()||'新しい物件';syncName();$('newDialog').close();screen('work');setTimeout(()=>$('memberDialog').showModal(),300)};
$('listBtn').onclick=async()=>{await render();screen('projects')};
function reset(){
  state.id=null;state.base=null;state.history=[];state.photos=[];state.activePhoto=-1;
  state.members={};state.sendHistory={};state.createdAt=null;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  $('empty').classList.remove('hidden');
  $('projectName').value='';$('note').value='';$('photoCaption').value='';
  $('area').value='家全体';
  $('date').value=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
  $('undoBtn').disabled=$('clearBtn').disabled=true;
  setDrawMode(false);renderPhotoAlbum()
}
$('photoInput').onchange=async e=>{
  const files=[...(e.target.files||[])];
  if(!files.length)return;
  const remaining=5-state.photos.length;
  if(remaining<=0){toast('この日の写真は5枚までです');e.target.value='';return}
  for(const file of files.slice(0,remaining)) await addPhoto(file);
  if(files.length>remaining)toast(`最大5枚のため、${remaining}枚だけ追加しました`);
  e.target.value='';
};
function imageFromFile(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file),im=new Image();
    im.onload=()=>{
      const scale=Math.min(1,1800/Math.max(im.width,im.height));
      const c=document.createElement('canvas');
      c.width=Math.round(im.width*scale);c.height=Math.round(im.height*scale);
      c.getContext('2d').drawImage(im,0,0,c.width,c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg',.84));
    };
    im.onerror=reject;im.src=url;
  })
}
async function addPhoto(file){
  if(state.photos.length>=5){toast('この日の写真は5枚までです');return}
  const data=await imageFromFile(file);
  state.photos.push({id:uid(),image:data,baseImage:data,caption:`写真${state.photos.length+1}`});
  await selectPhoto(state.photos.length-1);
  renderPhotoAlbum();draft();
  toast(`${state.photos.length}枚目の写真を追加しました`);
}
function saveActivePhoto(){
  if(state.activePhoto<0||!state.photos[state.activePhoto])return;
  if(state.base){
    state.photos[state.activePhoto].image=canvas.toDataURL('image/jpeg',.84);
    state.photos[state.activePhoto].baseImage=state.base;
  }
  state.photos[state.activePhoto].caption=$('photoCaption').value.trim()||`写真${state.activePhoto+1}`;
}
async function selectPhoto(index){
  if(index<0||index>=state.photos.length)return;
  saveActivePhoto();
  state.activePhoto=index;
  const p=state.photos[index];
  state.base=p.baseImage||p.image;
  state.history=[p.image||p.baseImage];
  await drawUrl(p.image||p.baseImage);
  $('photoCaption').value=p.caption||`写真${index+1}`;
  $('empty').classList.add('hidden');
  $('undoBtn').disabled=$('clearBtn').disabled=false;
  setDrawMode(false);renderPhotoAlbum();
}
function removePhoto(index){
  if(index<0||index>=state.photos.length)return;
  if(!confirm(`${index+1}枚目の写真を削除しますか？`))return;
  state.photos.splice(index,1);
  if(!state.photos.length){
    state.activePhoto=-1;state.base=null;state.history=[];
    ctx.clearRect(0,0,canvas.width,canvas.height);
    $('photoCaption').value='';$('empty').classList.remove('hidden');
    $('undoBtn').disabled=$('clearBtn').disabled=true;setDrawMode(false);
    renderPhotoAlbum();draft();return;
  }
  const next=Math.min(index,state.photos.length-1);
  state.activePhoto=-1;selectPhoto(next);draft();
}
function renderPhotoAlbum(){
  const box=$('photoThumbs');if(!box)return;
  $('photoCounter').textContent=`${state.photos.length} / 5`;
  $('activePhotoBadge').textContent=state.activePhoto>=0?`${state.activePhoto+1} / ${state.photos.length}`:`0 / 5`;
  $('photoLimitText').textContent=state.photos.length>=5?'5枚登録済み（上限）':`あと${5-state.photos.length}枚追加できます`;
  $('photoInput').disabled=state.photos.length>=5;
  box.innerHTML='';
  state.photos.forEach((p,i)=>{
    const item=document.createElement('button');
    item.type='button';item.className='photo-thumb'+(i===state.activePhoto?' active':'');
    item.innerHTML=`<img src="${p.image||p.baseImage}" alt=""><span>${i+1}</span><small>${esc(p.caption||`写真${i+1}`)}</small><i data-delete="${i}">×</i>`;
    item.onclick=e=>{
      const del=e.target.closest('[data-delete]');
      if(del){e.stopPropagation();removePhoto(i)}else selectPhoto(i)
    };
    box.appendChild(item);
  });
  if(state.photos.length<5){
    const add=document.createElement('label');
    add.className='photo-thumb add-thumb';
    add.innerHTML='<b>＋</b><small>追加</small><input type="file" accept="image/*" capture="environment">';
    add.querySelector('input').onchange=e=>{const f=e.target.files?.[0];if(f)addPhoto(f)};
    box.appendChild(add);
  }
}
function pos(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}}
function setDrawMode(on){
  drawMode=!!on;
  drawArmedAt=drawMode?Date.now()+450:0;
  $('drawbar').classList.toggle('hidden',!drawMode);
  $('startDrawBtn').classList.toggle('hidden',drawMode||!state.base);
  $('viewBadge').textContent=drawMode?'✎ 書くモード':'🔒 見るモード';
  $('viewBadge').classList.toggle('drawing',drawMode);
  canvas.classList.toggle('drawing',drawMode);
  canvas.style.touchAction=drawMode?'none':'pan-x pan-y pinch-zoom';
  draw=false;
}
$('startDrawBtn').onclick=()=>{if(!state.base||state.activePhoto<0)return;setDrawMode(true);toast('WRITE MODE：ペンだけで書けます')};
$('finishDrawBtn').onclick=()=>{setDrawMode(false);draft();toast('書き込みを終了しました')};
canvas.onpointerdown=e=>{
  if(!state.base||!drawMode)return;
  if(Date.now()<drawArmedAt)return;
  const fingerAllowed=$('fingerDraw').checked;
  if(e.pointerType==='touch'&&!fingerAllowed)return;
  if(e.pointerType==='touch'&&e.isPrimary===false)return;
  draw=true;
  strokeMoved=false;
  e.preventDefault();
  e.stopPropagation();
  canvas.setPointerCapture?.(e.pointerId);
  const p=pos(e);
  ctx.beginPath();
  ctx.moveTo(p.x,p.y)
};
canvas.onpointermove=e=>{
  if(!draw||!drawMode)return;e.preventDefault();
  const p=pos(e);strokeMoved=true;ctx.lineTo(p.x,p.y);ctx.strokeStyle=$('color').value;
  ctx.lineWidth=+$('width').value*canvas.width/canvas.getBoundingClientRect().width;
  ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke()
};
canvas.onpointerup=canvas.onpointercancel=()=>{
  if(!draw)return;
  draw=false;
  if(!strokeMoved){
    restore(state.history[state.history.length-1]||state.base);
    return;
  }
  state.history.push(canvas.toDataURL());if(state.activePhoto>=0)state.photos[state.activePhoto].image=canvas.toDataURL('image/jpeg',.84);
  if(state.history.length>15)state.history.shift();
  draft()
};
function drawUrl(url){return new Promise(res=>{const im=new Image();im.onload=()=>{canvas.width=im.width;canvas.height=im.height;ctx.drawImage(im,0,0);res()};im.src=url})}
$('undoBtn').onclick=async()=>{if(state.history.length<2)return;state.history.pop();await drawUrl(state.history.at(-1));toast('一つ戻しました')};
$('clearBtn').onclick=async()=>{if(!state.base)return;await drawUrl(state.base);state.history=[state.base];if(state.activePhoto>=0)state.photos[state.activePhoto].image=state.base;toast('書いた線を消しました')};
$('voiceBtn').onclick=()=>{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){toast('この端末では音声入力を使えません');return}const r=new SR();r.lang='ja-JP';r.interimResults=false;r.onstart=()=>{$('voiceBtn').textContent='🎤 聞いています…'};r.onresult=e=>{$('note').value+=($('note').value?'\n':'')+e.results[0][0].transcript;draft()};r.onend=()=>{$('voiceBtn').textContent='🎤 話して入力'};r.start()};
$('memberBtn').onclick=()=>{fillMembers();$('memberDialog').showModal()};
function fillMembers(){const m=state.members||{};['customerName','customerEmail','customerPhone','vendorName','vendorEmail','vendorPhone','employeeName','employeeEmail','selfName','selfEmail'].forEach(k=>$(k).value=m[k]||'');['customerMethod','vendorMethod','employeeMethod','selfMethod'].forEach(k=>$(k).value=m[k]||({customerMethod:'line',vendorMethod:'andpad',employeeMethod:'teams',selfMethod:'teams'}[k]))}
$('saveMembersBtn').onclick=()=>{const m={};['customerName','customerEmail','customerPhone','vendorName','vendorEmail','vendorPhone','employeeName','employeeEmail','selfName','selfEmail'].forEach(k=>m[k]=$(k).value.trim());m.customerMethod='line';m.vendorMethod='andpad';m.employeeMethod='teams';m.selfMethod='teams';state.members=m;localStorage.setItem('rhSelf',JSON.stringify({selfName:m.selfName,selfEmail:m.selfEmail}));$('memberDialog').close();draft();toast('共有先を登録しました')};
$('finishBtn').onclick=async()=>{
  if(!$('projectName').value.trim()){toast('物件名を入れてください');$('projectName').focus();return}
  saveActivePhoto();
  const p=fields();
  const existing=(await all()).find(x=>x.id!==p.id&&x.propertyName===p.propertyName&&x.date===p.date);
  if(existing){
    if(!confirm(`${p.propertyName}の${p.date}の記録は既にあります。今日の記録として上書きしますか？`))return;
    p.id=existing.id;p.createdAt=existing.createdAt;
  }
  state.id=p.id;state.updatedAt=p.updatedAt;
  localStorage.setItem('rhStaff',p.staff);await put(p);
  localStorage.removeItem('rhDraft');await refreshHome();openShare(p);
  toast(`${normalizePhotos(p).length}枚の写真を保存しました`)
};
function shareText(p){
  const photos=normalizePhotos(p);
  const captions=photos.length
    ? `\n内訳：${photos.map((x,i)=>`${i+1}. ${x.caption||`写真${i+1}`}`).join(' / ')}`
    : '';
  return `【Reform Hub 打合せ記録】
物件：${p.propertyName}
日付：${p.date||''}
場所：${p.workArea||''}
写真：${photos.length}枚${captions}

確認したこと
${p.note||'写真をご確認ください'}

担当：${p.staff||''}`
}
function normalizePhotos(p){
  if(Array.isArray(p.photos)&&p.photos.length)return p.photos.slice(0,5);
  if(p.image)return [{id:uid(),image:p.image,baseImage:p.baseImage||p.image,caption:'写真1'}];
  return [];
}
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
  return {line:'LINE',andpad:'ANDPADチャット',teams:'Teams'}[method]||'共有';
}
async function sendToPerson(p,role,label,method,address,phone){
  const text=recipientText(p,role);
  const appName=methodLabel(method);
  try{
    const data={
      title:`${p.propertyName} 打合せ記録`,
      text:`【${appName}へ共有】\n${text}`
    };

    const photos=normalizePhotos(p);
    if(photos.length){
      const files=[];
      for(let i=0;i<photos.length;i++){
        const blob=await blobFromData(photos[i].image);
        files.push(new File([blob],`${p.propertyName}-${p.date||'打合せ'}-${i+1}.jpg`,{type:'image/jpeg'}));
      }
      if(navigator.canShare?.({files})) data.files=files;
    }

    await markOpened(p,role);

    if(navigator.share){
      await navigator.share(data);
      toast(`共有画面で「${appName}」を選んでください`);
      setTimeout(showPendingConfirm,450);
      return;
    }

    try{await navigator.clipboard?.writeText(text)}catch{}
    toast(`文章をコピーしました。${appName}を開いて貼り付けてください`);
    setTimeout(showPendingConfirm,450);
  }catch(e){
    if(e.name==='AbortError'){
      localStorage.removeItem('rhPendingShare');
    }else{
      try{await navigator.clipboard?.writeText(text)}catch{}
      toast(`文章をコピーしました。${appName}へ貼り付けてください`);
      setTimeout(showPendingConfirm,450);
    }
  }
}
async function openShare(p,reopen=false){
  const fresh=(await all()).find(x=>x.id===p.id)||p;
  p=fresh;
  $('shareProjectName').textContent=p.propertyName+'／'+(p.date||'');
  const m=p.members||{}, history=p.sendHistory||{};
  const box=$('recipientButtons');box.innerHTML='';

  const rec=[
    {key:'customer',role:'お客様',name:m.customerName,method:'line',symbol:'L',routeClass:'line'},
    {key:'vendor',role:'協力業者',name:m.vendorName,method:'andpad',symbol:'A',routeClass:'andpad'},
    {key:'employee',role:'社内',name:m.employeeName,method:'teams',symbol:'T',routeClass:'teams'},
    {key:'self',role:'自分の控え',name:m.selfName,method:'teams',symbol:'T',routeClass:'teams'}
  ];

  let complete=0;
  rec.forEach(r=>{
    const card=document.createElement('section');
    card.className=`recipient-card route-card ${r.routeClass}`;
    const h=historyEntry(history[r.key]);
    const confirmed=!!h.confirmedAt;
    const opened=!!h.openedAt;
    if(confirmed)complete++;

    const status=confirmed?'確認済み':opened?'確認待ち':'未共有';
    const statusClass=confirmed?'sent':opened?'waiting':'unsent';
    const when=confirmed?h.confirmedAt:h.openedAt;
    const timeText=when?new Date(when).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
    const appName=methodLabel(r.method);
    const count=normalizePhotos(p).length;const photoTag=count?`写真${count}枚付き`:'メモのみ';

    card.innerHTML=`
      <div class="route-main">
        <span class="route-icon ${r.routeClass}">${r.symbol}</span>
        <div class="route-copy">
          <span class="route-role">${r.role}</span>
          <strong>${r.name?esc(r.name):'名前未登録'}</strong>
          <small>${appName}固定・${photoTag}</small>
        </div>
        <span class="route-status ${statusClass}">${status}</span>
      </div>
      ${timeText?`<div class="recipient-time">${timeText}</div>`:''}
      <button class="send-photo route-send">
        <b>${appName}で共有</b>
        <span>→</span>
      </button>
      ${opened&&!confirmed?'<button class="manual-confirm">共有しました</button>':''}
    `;

    card.querySelector('.send-photo').onclick=()=>sendToPerson(p,r.key,r.role,r.method,'','');
    const manual=card.querySelector('.manual-confirm');
    if(manual)manual.onclick=async()=>{
      await markConfirmed(p,r.key);
      toast(`${r.role}を確認済みにしました`);
      await openShare(p,true);
    };
    box.appendChild(card);
  });

  const finish=$('finishShareBtn');
  finish.textContent=complete===4?'✓ すべて確認済み':'共有作業を終える';
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
async function load(p){
  state.id=p.id;state.createdAt=p.createdAt;state.members=p.members||{};state.sendHistory=p.sendHistory||{};
  state.photos=normalizePhotos(p).map((x,i)=>({...x,caption:x.caption||`写真${i+1}`}));
  state.activePhoto=-1;state.base=null;state.history=[];
  $('projectName').value=p.propertyName||'';$('area').value=p.workArea||'家全体';
  $('date').value=p.date||$('date').value;$('staff').value=p.staff||'';$('note').value=p.note||'';
  $('photoCaption').value='';syncName();
  if(state.photos.length)await selectPhoto(0);
  else{
    ctx.clearRect(0,0,canvas.width,canvas.height);$('empty').classList.remove('hidden');
    $('undoBtn').disabled=$('clearBtn').disabled=true;setDrawMode(false);renderPhotoAlbum()
  }
  screen('work')
}
async function render(){const q=$('search').value.toLowerCase(),ps=(await all()).filter(p=>(p.propertyName+' '+p.note+' '+p.workArea).toLowerCase().includes(q));$('projectList').innerHTML=ps.length?'':'<div class="project-item"><h3>まだ保存された物件はありません</h3><p>ホームから「新しい物件」を始めてください。</p></div>';ps.forEach(p=>{const d=document.createElement('article');d.className='project-item';d.innerHTML=`<h3>${esc(p.propertyName)}</h3><div class="meta">${esc(p.date||'')} ・ ${esc(p.workArea||'')} ・ 写真${normalizePhotos(p).length}枚</div><p>${esc((p.note||'写真の記録').slice(0,120))}</p><div class="actions"><button class="open">開く</button><button class="share">送る</button><button class="delete">削除</button></div>`;d.querySelector('.open').onclick=()=>load(p);d.querySelector('.share').onclick=()=>openShare(p);d.querySelector('.delete').onclick=async()=>{if(confirm('この物件の記録を削除しますか？')){await del(p.id);render();refreshHome()}};$('projectList').appendChild(d)})}
$('search').oninput=render;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
$('exportBtn').onclick=async()=>{const data=JSON.stringify({version:1,exportedAt:new Date().toISOString(),projects:await all()},null,2);const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type:'application/json'}));a.download='reform-hub-backup.json';a.click();URL.revokeObjectURL(a.href)};
$('importInput').onchange=async e=>{try{const j=JSON.parse(await e.target.files[0].text());for(const p of j.projects||[])await put(p);await render();await refreshHome();toast('バックアップを読み込みました')}catch{toast('読み込めないファイルです')}};
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e});$('installBtn').onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null}else alert('iPadではSafariの共有ボタンを押し、「ホーム画面に追加」を選んでください。')};
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
(async()=>{try{const d=JSON.parse(localStorage.getItem('rhDraft')||'null');if(d){state.id=d.id||null;state.members=d.members||{};state.sendHistory=d.sendHistory||{};state.photos=normalizePhotos(d);state.activePhoto=-1;$('projectName').value=d.propertyName||'';$('area').value=d.workArea||'家全体';$('date').value=d.date||$('date').value;$('staff').value=d.staff||$('staff').value;$('note').value=d.note||'';syncName();if(state.photos.length)await selectPhoto(0);else renderPhotoAlbum()}const self=JSON.parse(localStorage.getItem('rhSelf')||'{}');state.members.selfName=state.members.selfName||self.selfName||'';state.members.selfEmail=state.members.selfEmail||self.selfEmail||'';renderPhotoAlbum();await refreshHome()}catch(e){console.error(e)}})();


// v5.0 desktop navigation helpers
const sideNewBtn=document.getElementById('sideNewBtn');
const sideProjectsBtn=document.getElementById('sideProjectsBtn');
if(sideNewBtn) sideNewBtn.onclick=()=>document.getElementById('newProjectBtn').click();
if(sideProjectsBtn) sideProjectsBtn.onclick=()=>document.getElementById('listBtn').click();

document.querySelectorAll('.nav-item').forEach(item=>{
  item.addEventListener('click',()=>{
    document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
    item.classList.add('active');
  });
});
