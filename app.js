(()=>{const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],K="field-mode-v1",HK="field-mode-history-v1";let S={project:"",date:"",customer:"",staff:"",memo:"",output:"",photos:[],font:"large"};let drawIndex=-1,drawColor="#ff3b30",drawWidth=9,drawing=false,history=[];const ids=["project","date","customer","staff","memo","output"];
const RULES=[
 {tag:"床",words:["床","フローリング","ぶかぶか","沈む","きしみ"],suggest:["床張替え","床下点検","シロアリ点検","断熱改修"]},
 {tag:"外壁",words:["外壁","ひび割れ","クラック","チョーキング","色あせ"],suggest:["外壁塗装","シーリング","下地補修","雨樋点検"]},
 {tag:"屋根",words:["屋根","瓦","棟板金","雨漏り"],suggest:["屋根点検","補修・葺き替え","防水確認","雨樋点検"]},
 {tag:"雨樋",words:["雨樋","樋","集水器"],suggest:["雨樋交換","詰まり清掃","勾配確認","屋根まわり点検"]},
 {tag:"基礎",words:["基礎","ひび","亀裂"],suggest:["基礎補修","床下点検","不同沈下確認","防蟻確認"]},
 {tag:"玄関",words:["玄関","ドア","引戸"],suggest:["玄関交換","断熱ドア","鍵・建付け調整","ポーチ補修"]},
 {tag:"窓",words:["窓","サッシ","結露","寒い"],suggest:["内窓","サッシ交換","断熱改修","ガラス交換"]},
 {tag:"水まわり",words:["浴室","風呂","キッチン","台所","トイレ","洗面","水漏れ"],suggest:["設備交換","配管点検","床下確認","換気改善"]},
 {tag:"その他",words:["雑草","草","防草"],suggest:["防草シート","人工芝","砂利敷き","排水確認"]},
 {tag:"その他",words:["カーポート","駐車場","土間"],suggest:["カーポート交換","土間コンクリート","排水計画","フェンス提案"]}
];
function toast(m){const e=$("#toast");e.textContent=m;e.classList.add("show");clearTimeout(e.t);e.t=setTimeout(()=>e.classList.remove("show"),2500)}

function getHistory(){try{return JSON.parse(localStorage.getItem(HK)||"[]")}catch(e){return[]}}
function setHistory(items){localStorage.setItem(HK,JSON.stringify(items))}
function currentSuggestions(){return [...new Set(matches().flatMap(x=>x.suggest))].slice(0,8)}
function makeCaseRecord(){
  ids.forEach(id=>S[id]=$("#"+id).value);
  return {
    id: Date.now(),
    savedAt: new Date().toISOString(),
    project:S.project||"物件名未入力",
    date:S.date||"",
    customer:S.customer||"",
    staff:S.staff||"",
    memo:S.memo||"",
    output:S.output||"",
    photoCount:S.photos.length,
    photoTags:[...new Set(S.photos.map(p=>p.tag).filter(t=>t&&t!=="未設定"))],
    suggestions:currentSuggestions()
  }
}
function saveCurrentCase(){
  const rec=makeCaseRecord();
  const items=getHistory();
  items.unshift(rec);
  setHistory(items.slice(0,100));
  toast("過去の現場に保存しました");
}
function renderHistory(filter=""){
  const list=$("#historyList");
  const q=filter.trim().toLowerCase();
  const items=getHistory().filter(x=>[x.project,x.customer,x.memo,x.output,(x.suggestions||[]).join(" "),(x.photoTags||[]).join(" ")].join(" ").toLowerCase().includes(q));
  if(!items.length){list.innerHTML='<div class="empty-history">保存された現場がありません。</div>';return}
  list.innerHTML=items.map(x=>`
    <div class="history-item" data-history-id="${x.id}">
      <h3>${esc(x.project)}</h3>
      <div class="history-meta">${esc(x.date||"日付未設定")}　写真${x.photoCount||0}枚${x.customer?`　${esc(x.customer)}`:""}</div>
      <div class="history-tags">${[...(x.photoTags||[]),...(x.suggestions||[]).slice(0,3)].map(t=>`<span class="history-tag">${esc(t)}</span>`).join("")}</div>
    </div>`).join("");
  $$("[data-history-id]").forEach(el=>el.onclick=()=>openHistoryDetail(+el.dataset.historyId))
}
function openHistoryDetail(id){
  const x=getHistory().find(v=>v.id===id); if(!x)return;
  $("#historyDetailTitle").textContent=x.project;
  $("#historyDetailBody").innerHTML=`
    <div class="history-detail-section"><h3>基本情報</h3><div class="history-text">${esc(x.date||"日付未設定")}${x.customer?`\n${esc(x.customer)}`:""}${x.staff?`\n担当：${esc(x.staff)}`:""}</div></div>
    <div class="history-detail-section"><h3>写真</h3><div class="history-text">${x.photoCount||0}枚${(x.photoTags||[]).length?`\nタグ：${esc((x.photoTags||[]).join("・"))}`:""}</div></div>
    <div class="history-detail-section"><h3>提案候補</h3><div class="history-text">${esc((x.suggestions||[]).map(v=>"・"+v).join("\n")||"なし")}</div></div>
    <div class="history-detail-section"><h3>現場メモ</h3><div class="history-text">${esc(x.memo||"なし")}</div></div>
    <div class="history-detail-section"><h3>保存文</h3><div class="history-text">${esc(x.output||"保存文なし")}</div></div>
    <div class="history-actions">
      <button id="historyCopyBtn">保存文をコピー</button>
      <button id="historyDeleteBtn" class="delete">削除</button>
    </div>`;
  $("#historyDetailModal").classList.add("open");
  $("#historyCopyBtn").onclick=async()=>{const t=x.output||x.memo||"";if(!t)return toast("コピーする文章がありません");try{await navigator.clipboard.writeText(t);toast("コピーしました")}catch(e){toast("コピーできませんでした")}};
  $("#historyDeleteBtn").onclick=()=>{if(confirm("この保存履歴を削除しますか？")){setHistory(getHistory().filter(v=>v.id!==id));$("#historyDetailModal").classList.remove("open");renderHistory($("#historySearch").value);toast("削除しました")}}
}
function load(){try{S={...S,...JSON.parse(localStorage.getItem(K)||"{}")}}catch(e){}if(!S.date)S.date=new Date().toISOString().slice(0,10);ids.forEach(id=>$("#"+id).value=S[id]||"");applyFont();renderPhotos();analyze()}
let timer;function later(){clearTimeout(timer);$("#status").textContent="保存中…";timer=setTimeout(save,280);analyze()}
function save(){ids.forEach(id=>S[id]=$("#"+id).value);try{localStorage.setItem(K,JSON.stringify(S));$("#status").textContent="端末に保存済み"}catch(e){$("#status").textContent="容量不足";toast("写真を減らしてください")}}
ids.forEach(id=>$("#"+id).addEventListener("input",later));
function applyFont(){const map={normal:"18px",large:"20px",xlarge:"23px"};document.documentElement.style.setProperty("--base",map[S.font]);$("#fontBtn").textContent="文字："+({normal:"標準",large:"大",xlarge:"特大"}[S.font])}
$("#fontBtn").onclick=()=>{S.font=S.font==="normal"?"large":S.font==="large"?"xlarge":"normal";applyFont();save()};
$("#voiceBtn").onclick=()=>{const m=$("#memo");m.focus();m.setSelectionRange(m.value.length,m.value.length);toast("キーボードのマイクを押して話してください")};
$("#timeBtn").onclick=()=>{const d=new Date(),m=$("#memo");m.value+=`\n[${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}] `;m.focus();later()};
$("#newBtn").onclick=()=>{if(confirm("現在の内容を消して新しい現場を始めますか？")){localStorage.removeItem(K);location.reload()}};
$("#saveCaseBtn").onclick=saveCurrentCase;
$("#historyBtn").onclick=()=>{renderHistory();$("#historyModal").classList.add("open")};
$("#historyClose").onclick=()=>$("#historyModal").classList.remove("open");
$("#historyDetailClose").onclick=()=>$("#historyDetailModal").classList.remove("open");
$("#historySearch").oninput=e=>renderHistory(e.target.value);
function esc(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
function fileToData(f){return new Promise((ok,no)=>{const r=new FileReader;r.onload=()=>{const i=new Image;i.onload=()=>{const q=Math.min(1,1600/Math.max(i.width,i.height)),c=document.createElement("canvas");c.width=Math.round(i.width*q);c.height=Math.round(i.height*q);c.getContext("2d").drawImage(i,0,0,c.width,c.height);ok(c.toDataURL("image/jpeg",.78))};i.onerror=no;i.src=r.result};r.onerror=no;r.readAsDataURL(f)})}
$("#photoInput").onchange=async e=>{const fs=[...e.target.files];if(S.photos.length+fs.length>20)return toast("写真は最大20枚です");for(const f of fs)try{S.photos.push({data:await fileToData(f),comment:"",tag:"未設定"})}catch(x){}e.target.value="";renderPhotos();save();analyze()};
const tags=["未設定","床","外壁","屋根","雨樋","基礎","玄関","窓","水まわり","設備","その他"];
function renderPhotos(){const g=$("#photos");g.innerHTML="";S.photos.forEach((p,i)=>{const a=document.createElement("article");a.className="photo-card";a.innerHTML=`<img src="${p.data}"><div class="photo-body"><div class="photo-title"><b>写真${i+1}</b><select class="tag-select" data-tag="${i}">${tags.map(t=>`<option ${p.tag===t?"selected":""}>${t}</option>`).join("")}</select></div><textarea data-comment="${i}" placeholder="写真の説明">${esc(p.comment||"")}</textarea><div class="photo-actions"><button data-draw="${i}">✏️ 描く</button><button class="delete" data-delete="${i}">削除</button></div></div>`;g.appendChild(a)});
 $$("[data-comment]").forEach(e=>e.oninput=x=>{S.photos[+x.target.dataset.comment].comment=x.target.value;later()});
 $$("[data-tag]").forEach(e=>e.onchange=x=>{S.photos[+x.target.dataset.tag].tag=x.target.value;save();analyze()});
 $$("[data-delete]").forEach(e=>e.onclick=x=>{const i=+x.target.dataset.delete;if(confirm(`写真${i+1}を削除しますか？`)){S.photos.splice(i,1);renderPhotos();save();analyze()}});
 $$("[data-draw]").forEach(e=>e.onclick=x=>openDraw(+x.target.dataset.draw))}
function matches(){const text=($("#memo").value+" "+S.photos.map(p=>p.comment).join(" ")).toLowerCase();return RULES.filter(r=>r.words.some(w=>text.includes(w.toLowerCase())))}
function analyze(){const box=$("#proposalBox"),m=matches();if(!m.length){box.innerHTML='<div class="empty">メモを入力すると提案候補が表示されます。</div>';return}const seen=new Set;box.innerHTML=m.filter(r=>{const k=r.tag+r.suggest.join();if(seen.has(k))return false;seen.add(k);return true}).map(r=>`<div class="proposal-group"><strong>${r.tag}から考えられる提案</strong><div class="proposal-chips">${r.suggest.map(s=>`<span class="chip">${s}</span>`).join("")}</div></div>`).join("")}
function missingTags(){const have=new Set(S.photos.map(p=>p.tag));return [...new Set(matches().map(r=>r.tag).filter(t=>t!=="その他"&&!have.has(t)))]}
$("#finishBtn").onclick=()=>{const miss=missingTags(),m=matches(),r=$("#finishResult");let h="";if(miss.length)h+=miss.map(t=>`<div class="finish-warning">⚠ ${t}の写真がありません。このまま帰りますか？</div>`).join("");else h+='<div class="finish-ok">✓ メモに出てきた部位の写真はそろっています。</div>';if(m.length){const all=[...new Set(m.flatMap(x=>x.suggest))].slice(0,8);h+=`<div class="proposal-final"><strong>提案候補</strong><br>${all.map(x=>"・"+x).join("<br>")}</div>`}r.innerHTML=h;$("#finishModal").classList.add("open")};
$("#finishClose").onclick=()=>$("#finishModal").classList.remove("open");
$("#leaveAnywayBtn").onclick=()=>{saveCurrentCase();$("#finishModal").classList.remove("open");toast("現場を保存して終了しました")};
$("#backCameraBtn").onclick=()=>{$("#finishModal").classList.remove("open");$("#photoInput").click()};
function openDraw(i){drawIndex=i;const c=$("#drawCanvas"),ctx=c.getContext("2d"),img=new Image;img.onload=()=>{c.width=img.width;c.height=img.height;ctx.drawImage(img,0,0);history=[c.toDataURL()];$("#drawModal").classList.add("open")};img.src=S.photos[i].data}
function point(e){const c=$("#drawCanvas"),r=c.getBoundingClientRect(),p=e.touches?e.touches[0]:e;return{x:(p.clientX-r.left)*c.width/r.width,y:(p.clientY-r.top)*c.height/r.height}}
function start(e){e.preventDefault();drawing=true;const c=$("#drawCanvas"),ctx=c.getContext("2d"),p=point(e);ctx.beginPath();ctx.moveTo(p.x,p.y)}
function move(e){if(!drawing)return;e.preventDefault();const c=$("#drawCanvas"),ctx=c.getContext("2d"),p=point(e);ctx.strokeStyle=drawColor;ctx.lineWidth=drawWidth;ctx.lineCap="round";ctx.lineJoin="round";ctx.lineTo(p.x,p.y);ctx.stroke()}
function end(){if(!drawing)return;drawing=false;history.push($("#drawCanvas").toDataURL());if(history.length>20)history.shift()}
const canvas=$("#drawCanvas");["mousedown","touchstart"].forEach(n=>canvas.addEventListener(n,start,{passive:false}));["mousemove","touchmove"].forEach(n=>canvas.addEventListener(n,move,{passive:false}));["mouseup","mouseleave","touchend","touchcancel"].forEach(n=>canvas.addEventListener(n,end));
$$("[data-color]").forEach(b=>b.onclick=()=>{$$("[data-color]").forEach(x=>x.classList.remove("active"));b.classList.add("active");drawColor=b.dataset.color});
$("#thinBtn").onclick=()=>drawWidth=5;$("#thickBtn").onclick=()=>drawWidth=14;
$("#undoBtn").onclick=()=>{if(history.length<=1)return;history.pop();const img=new Image;img.onload=()=>{const c=$("#drawCanvas"),x=c.getContext("2d");x.clearRect(0,0,c.width,c.height);x.drawImage(img,0,0)};img.src=history.at(-1)};
$("#resetDraw").onclick=()=>openDraw(drawIndex);
$("#saveDraw").onclick=()=>{S.photos[drawIndex].data=$("#drawCanvas").toDataURL("image/jpeg",.84);$("#drawModal").classList.remove("open");renderPhotos();save();toast("手書きを保存しました")};
$("#drawClose").onclick=()=>$("#drawModal").classList.remove("open");
function lines(){return $("#memo").value.split(/\n|。/).map(x=>x.trim()).filter(Boolean)}
function photoText(){return S.photos.map((p,i)=>`写真${i+1}［${p.tag}］${p.comment?`：${p.comment}`:""}`).join("\n")||"写真なし"}
function gen(mode){ids.forEach(id=>S[id]=$("#"+id).value);const b=(lines().length?lines():["現場メモが未入力です"]).map(x=>"・"+x).join("\n"),p=photoText(),n=S.project||"物件名未入力",d=S.date||"日付未入力",c=S.customer||"お客様名未入力",s=S.staff||"担当者未入力",pro=[...new Set(matches().flatMap(x=>x.suggest))].slice(0,8).map(x=>"・"+x).join("\n")||"・提案候補なし";const T={summary:`【現場調査 要点整理】\n物件：${n}\n調査日：${d}\nお客様：${c}\n担当：${s}\n\n■確認内容\n${b}\n\n■写真\n${p}\n\n■提案候補\n${pro}`,customer:`${c}\n\n本日は現場確認のお時間をいただき、ありがとうございました。\n以下の内容で承りました。\n\n${b}\n\n写真と現場状況を確認し、今後の進め方をご案内いたします。\n担当：${s}`,contractor:`【業者様 申し送り】\n物件：${n}\n調査日：${d}\n\n■依頼・確認事項\n${b}\n\n■写真\n${p}`,internal:`【現場日報】\n日付：${d}\n物件：${n}\nお客様：${c}\n担当：${s}\n\n■確認事項\n${b}\n\n■写真記録\n${p}\n\n■提案候補\n${pro}`};$("#output").value=T[mode];S.output=T[mode];save();toast("文章を整理しました")}
$$("[data-mode]").forEach(b=>b.onclick=()=>gen(b.dataset.mode));
$("#copyBtn").onclick=async()=>{const x=$("#output").value;if(!x)return toast("文章がありません");try{await navigator.clipboard.writeText(x);toast("コピーしました")}catch(e){$("#output").select();document.execCommand("copy");toast("コピーしました")}};
function openShare(){if(missingTags().length){toast("先に『帰る前にAI確認』をおすすめします")}const list=$("#shareList"),warn=$("#shareWarnings");list.innerHTML="";warn.innerHTML="";const miss=missingTags();warn.innerHTML=miss.length?miss.map(t=>`<div class="warning">⚠ ${t}写真がありません</div>`).join(""):'<div class="warning ok">✓ 大きな添付漏れはありません</div>';S.photos.forEach((p,i)=>{const d=document.createElement("label");d.className="share-item";d.innerHTML=`<input type="checkbox" data-share="${i}"><img src="${p.data}"><div><b>写真${i+1}［${p.tag}］</b><small>${esc(p.comment||"説明なし")}</small></div>`;list.appendChild(d)});$("#shareModal").classList.add("open")}
$("#shareOpenBtn").onclick=()=>{if(!$("#output").value)gen("summary");openShare()};
$("#shareClose").onclick=()=>$("#shareModal").classList.remove("open");
$("#selectAllBtn").onclick=()=>$$("[data-share]").forEach(x=>x.checked=true);
$("#shareNowBtn").onclick=async()=>{const idx=$$("[data-share]:checked").map(x=>+x.dataset.share);if(!idx.length)return toast("送る写真を選んでください");const text=$("#output").value;const files=[];for(const i of idx){const blob=await (await fetch(S.photos[i].data)).blob();files.push(new File([blob],`写真${i+1}_${S.photos[i].tag}.jpg`,{type:"image/jpeg"}))}if(navigator.canShare&&navigator.canShare({files})&&navigator.share){try{await navigator.share({title:S.project||"FIELD MODE",text,files});return}catch(e){}}await navigator.clipboard.writeText(text);toast("文章をコピーしました")};
$("#pdfBtn").onclick=()=>{if(!$("#output").value)gen("summary");setTimeout(()=>print(),300)};
load();if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js?v=2400").catch(()=>{})})();