'use strict';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const imageInput = $('imageInput');
const emptyState = $('emptyState');
const projectName = $('projectName');
const staffName = $('staffName');
const projectNote = $('projectNote');
const workArea = $('workArea');
const completeAndShareBtn = $('completeAndShareBtn');
const visitDate = $('visitDate');
const visitTitle = $('visitTitle');
const penColor = $('penColor');
const penWidth = $('penWidth');
const penWidthValue = $('penWidthValue');
const drawToggleBtn = $('drawToggleBtn');
const undoBtn = $('undoBtn');
const clearDrawingBtn = $('clearDrawingBtn');
const saveProjectBtn = $('saveProjectBtn');
const downloadBtn = $('downloadBtn');
const shareBtn = $('shareBtn');
const shareDialog = $('shareDialog');
const nativeShareBtn = $('nativeShareBtn');
const lineShareBtn = $('lineShareBtn');
const emailShareBtn = $('emailShareBtn');
const smsShareBtn = $('smsShareBtn');
const teamsShareBtn = $('teamsShareBtn');
const teamsEmail = $('teamsEmail');
const lastShareStatus = $('lastShareStatus');
const aiBtn = $('aiBtn');
const aiDialog = $('aiDialog');
const aiPrompt = $('aiPrompt');
const savePromptBtn = $('savePromptBtn');
const projectList = $('projectList');
const saveStatus = $('saveStatus');
const newProjectBtn = $('newProjectBtn');
const deleteAllBtn = $('deleteAllBtn');
const toast = $('toast');
const installBtn = $('installBtn');
const projectSearch = $('projectSearch');
const propertyCount = $('propertyCount');
const recordCount = $('recordCount');
const quickMemoBtn = $('quickMemoBtn');
const todayLabel = $('todayLabel');

let baseImageData = null;
let activeProjectId = null;
let isDrawing = false;
let drawingEnabled = true;
let history = [];
let deferredPrompt = null;
let toastTimer = null;

const soundToggleBtn = document.getElementById('soundToggleBtn');
const currentSiteName = document.getElementById('currentSiteName');
let soundEnabled = localStorage.getItem('reformHubSound') !== 'off';
let audioContext = null;

function updateCurrentSiteBanner() {
  if (!currentSiteName) return;
  currentSiteName.textContent = projectName.value.trim() || '新しい物件';
}

function playTone(kind = 'tap') {
  if (!soundEnabled) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const now = audioContext.currentTime;
    const notes = kind === 'save' ? [660, 880] : kind === 'delete' ? [260] : kind === 'open' ? [520, 660] : [440];
    notes.forEach((frequency, index) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + index * 0.07);
      gain.gain.exponentialRampToValueAtTime(kind === 'tap' ? 0.035 : 0.055, now + index * 0.07 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.07 + 0.08);
      osc.connect(gain).connect(audioContext.destination);
      osc.start(now + index * 0.07);
      osc.stop(now + index * 0.07 + 0.09);
    });
  } catch (_) {}
}

function refreshSoundButton() {
  if (!soundToggleBtn) return;
  soundToggleBtn.setAttribute('aria-pressed', String(soundEnabled));
  soundToggleBtn.textContent = soundEnabled ? '🔊 操作音 ON' : '🔇 操作音 OFF';
}
refreshSoundButton();
soundToggleBtn?.addEventListener('click', (event) => {
  event.stopPropagation();
  soundEnabled = !soundEnabled;
  localStorage.setItem('reformHubSound', soundEnabled ? 'on' : 'off');
  refreshSoundButton();
  if (soundEnabled) playTone('open');
});
document.addEventListener('click', (event) => {
  const button = event.target.closest('button, .mega-photo-button');
  if (!button || button.disabled || button === soundToggleBtn) return;
  if (button.dataset.delete || button.id === 'deleteAllBtn') playTone('delete');
  else if (button.id === 'saveProjectBtn') playTone('save');
  else if (button.dataset.load || button.dataset.addVisit || button.id === 'showProjectsBtn') playTone('open');
  else playTone('tap');
}, { capture: true });


function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('show');
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2300);
}

function markDirty() {
  saveStatus.textContent = '未保存';
  saveStatus.classList.remove('saved');
}

function markSaved() {
  saveStatus.textContent = '保存済み';
  saveStatus.classList.add('saved');
}

function setEnabled(enabled) {
  [drawToggleBtn, clearDrawingBtn, downloadBtn, aiBtn].forEach((button) => {
    button.disabled = !enabled;
  });
  shareBtn.disabled = false;
  saveProjectBtn.disabled = false;
  undoBtn.disabled = !enabled || history.length < 2;
}

function createSnapshot() {
  history.push(canvas.toDataURL('image/jpeg', 0.9));
  if (history.length > 18) history.shift();
  undoBtn.disabled = history.length < 2;
}

function drawDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);
      resolve();
    };
    image.onerror = reject;
    image.src = dataUrl;
  });
}

async function loadImageFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('画像ファイルを選んでください');
    return;
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    const maxDimension = 1800;
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    baseImageData = canvas.toDataURL('image/jpeg', 0.82);
    history = [baseImageData];
    activeProjectId = null;
    emptyState.classList.add('hidden');
    setEnabled(true);
    markDirty();
    URL.revokeObjectURL(objectUrl);
    showToast('写真を読み込みました');
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    showToast('写真を読み込めませんでした');
  };
  image.src = objectUrl;
}

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * canvas.width / rect.width,
    y: (event.clientY - rect.top) * canvas.height / rect.height
  };
}

canvas.addEventListener('pointerdown', (event) => {
  if (!baseImageData || !drawingEnabled) return;
  event.preventDefault();
  isDrawing = true;
  canvas.setPointerCapture?.(event.pointerId);
  const point = pointerPosition(event);
  ctx.beginPath();
  ctx.moveTo(point.x, point.y);
});

canvas.addEventListener('pointermove', (event) => {
  if (!isDrawing) return;
  event.preventDefault();
  const point = pointerPosition(event);
  ctx.lineTo(point.x, point.y);
  ctx.strokeStyle = penColor.value;
  ctx.lineWidth = Number(penWidth.value) * canvas.width / canvas.getBoundingClientRect().width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
});

function endDrawing() {
  if (!isDrawing) return;
  isDrawing = false;
  createSnapshot();
  markDirty();
}
canvas.addEventListener('pointerup', endDrawing);
canvas.addEventListener('pointercancel', endDrawing);
canvas.addEventListener('pointerleave', (event) => {
  if (event.buttons === 0) endDrawing();
});

imageInput.addEventListener('change', (event) => loadImageFile(event.target.files?.[0]));
penWidth.addEventListener('input', () => { penWidthValue.textContent = penWidth.value; });
[projectName, staffName, projectNote, visitDate, visitTitle, aiPrompt, workArea].forEach((field) => field.addEventListener('input', () => { markDirty(); saveDraft(); updateCurrentSiteBanner(); }));

function todayValue(){ const d=new Date(); const local=new Date(d.getTime()-d.getTimezoneOffset()*60000); return local.toISOString().slice(0,10); }
visitDate.value = todayValue();
if (todayLabel) todayLabel.textContent = new Date().toLocaleDateString('ja-JP', { year:'numeric', month:'long', day:'numeric', weekday:'short' });
staffName.value = localStorage.getItem('reformHubLastStaff') || '';

drawToggleBtn.addEventListener('click', () => {
  drawingEnabled = !drawingEnabled;
  drawToggleBtn.textContent = drawingEnabled ? '✏️ 描く：ON' : '✋ 描く：OFF';
  drawToggleBtn.classList.toggle('accent', drawingEnabled);
});

undoBtn.addEventListener('click', async () => {
  if (history.length <= 1) return;
  history.pop();
  await drawDataUrl(history[history.length - 1]);
  undoBtn.disabled = history.length < 2;
  markDirty();
});

clearDrawingBtn.addEventListener('click', async () => {
  if (!baseImageData) return;
  await drawDataUrl(baseImageData);
  history = [baseImageData];
  undoBtn.disabled = true;
  markDirty();
  showToast('手描きだけ消しました');
});

const DB_NAME = 'ReformHubDB';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('データベースを開けませんでした'));
  });
}

async function getProjects() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      const projects = Array.isArray(request.result) ? request.result : [];
      projects.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
      resolve(projects);
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

async function putProject(project) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(project);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
    transaction.onabort = () => { database.close(); reject(transaction.error); };
  });
}

async function deleteProject(id) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

async function clearProjects() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).clear();
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

function safeId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function canvasDataUrl(quality = 0.76) {
  return canvas.toDataURL('image/jpeg', quality);
}


const DRAFT_KEY = 'reformHubDraftV17';
function saveDraft() {
  const draft = { propertyName: projectName.value, staff: staffName.value, note: projectNote.value, visitDate: visitDate.value, visitTitle: visitTitle.value, workArea: workArea?.value || '', savedAt: Date.now() };
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (_) {}
}
function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (_) {} }
function restoreDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (!draft || Date.now() - Number(draft.savedAt || 0) > 7 * 86400000) return;
    if (!projectName.value) projectName.value = draft.propertyName || '';
    if (!projectNote.value) projectNote.value = draft.note || '';
    if (!visitTitle.value) visitTitle.value = draft.visitTitle || '';
    if (draft.visitDate) visitDate.value = draft.visitDate;
    if (!staffName.value) staffName.value = draft.staff || '';
    if (workArea && !workArea.value) workArea.value = draft.workArea || '';
    if (draft.propertyName || draft.note) showToast('前回の入力途中を復元しました');
  } catch (_) {}
}

async function saveProject() {
  const hasText = projectName.value.trim() || projectNote.value.trim() || visitTitle.value.trim();
  if (!baseImageData && !hasText) { showToast('物件名かメモを入力してください'); document.querySelector('.details-card')?.setAttribute('open',''); projectName.focus(); return; }
  saveProjectBtn.disabled = true;
  saveProjectBtn.textContent = '保存中…';
  const now = new Date().toISOString();
  const item = {
    id: activeProjectId || safeId(),
    name: projectName.value.trim() || `無題の物件 ${new Date().toLocaleDateString('ja-JP')}`,
    propertyName: projectName.value.trim() || `無題の物件 ${new Date().toLocaleDateString('ja-JP')}`,
    visitDate: visitDate.value || todayValue(),
    visitTitle: visitTitle.value.trim() || '現場打ち合わせ',
    staff: staffName.value.trim(),
    workArea: workArea?.value || '',
    note: projectNote.value.trim(),
    aiPrompt: aiPrompt.value.trim(),
    baseImage: baseImageData,
    image: baseImageData ? canvasDataUrl(0.76) : null,
    createdAt: now,
    updatedAt: now
  };

  try {
    if (activeProjectId) {
      const projects = await getProjects();
      const existing = projects.find((project) => project.id === activeProjectId);
      if (existing?.createdAt) item.createdAt = existing.createdAt;
    }
    await putProject(item);
    if (item.staff) localStorage.setItem('reformHubLastStaff', item.staff);
    clearDraft();
    activeProjectId = item.id;
    updateCurrentSiteBanner();
    markSaved();
    await renderProjects();
    showToast('物件ファイルに記録を保存しました');
  } catch (error) {
    console.error(error);
    showToast('保存できませんでした。Safariのプライベートブラウズを解除して再度お試しください');
  } finally {
    saveProjectBtn.textContent = '💾 この記録を保存';
    saveProjectBtn.disabled = false;
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
  }[character]));
}

async function renderProjects() {
  try {
    const projects = await getProjects();
    recordCount.textContent = projects.length;
    if (!projects.length) {
      propertyCount.textContent = '0';
      projectList.innerHTML = '<p class="hint">まだ物件ファイルはありません。写真がなくても、メモだけ保存できます。</p>';
      return;
    }
    const groups = new Map();
    projects.forEach((project) => {
      const property = (project.propertyName || project.name || '無題の物件').trim();
      const key = property.toLocaleLowerCase('ja-JP');
      if (!groups.has(key)) groups.set(key, { property, visits: [] });
      groups.get(key).visits.push(project);
    });
    propertyCount.textContent = groups.size;
    const folders = [...groups.values()].sort((a,b) => {
      const ad = Math.max(...a.visits.map(v => new Date(v.visitDate || v.updatedAt || 0).getTime()));
      const bd = Math.max(...b.visits.map(v => new Date(v.visitDate || v.updatedAt || 0).getTime()));
      return bd - ad;
    });
    projectList.innerHTML = folders.map((folder) => {
      const visits = folder.visits.sort((a,b) => String(b.visitDate || b.updatedAt || '').localeCompare(String(a.visitDate || a.updatedAt || '')));
      const latest = visits[0];
      const past = visits.slice(1);
      const encodedProperty = encodeURIComponent(folder.property);
      const searchable = [folder.property, ...visits.flatMap(v => [v.visitTitle, v.staff, v.workArea, v.note])].join(' ').toLocaleLowerCase('ja-JP');
      const latestDate = latest.visitDate ? new Date(`${latest.visitDate}T00:00:00`).toLocaleDateString('ja-JP', {year:'numeric',month:'long',day:'numeric',weekday:'short'}) : new Date(latest.updatedAt || latest.createdAt).toLocaleDateString('ja-JP');
      const latestNote = latest.note?.trim() || '打ち合わせ内容はまだ入力されていません。';
      const isCurrent = activeProjectId && visits.some((visit) => visit.id === activeProjectId);
      return `<section class="property-folder latest-layout ${isCurrent ? 'current-property' : 'past-property'}" data-search="${escapeHtml(searchable)}">
        <div class="property-folder-header">
          <div class="property-folder-title"><span class="folder-icon">📁</span><div><strong>${escapeHtml(folder.property)}</strong><small>打ち合わせ記録 ${visits.length}件</small></div></div>
          <button class="add-visit-btn" data-add-visit="${encodedProperty}" data-count="${visits.length}" type="button">＋ この物件に記録を追加</button>
        </div>
        <article class="latest-status-card">
          <div class="latest-status-top"><div><span class="latest-label">📍 最新状況</span><h3>${escapeHtml(latest.visitTitle || '現場打ち合わせ')}</h3><p class="latest-date">${escapeHtml(latestDate)}　${latest.staff ? `担当：${escapeHtml(latest.staff)}` : ''}</p></div><span class="latest-badge">最新</span></div>
          <div class="latest-status-body">
            ${latest.image ? `<img class="latest-image" src="${latest.image}" alt="${escapeHtml(latest.visitTitle || folder.property)}" />` : ''}
            ${latest.workArea ? `<div class="latest-work-area">工事場所：${escapeHtml(latest.workArea)}</div>` : ''}<div class="latest-note">${escapeHtml(latestNote).replace(/\n/g,'<br>')}</div>
          </div>
          <div class="latest-actions"><button class="open-latest" data-load="${latest.id}" type="button">大きく開く・編集する</button><button data-delete="${latest.id}" type="button">削除</button></div>
        </article>
        ${past.length ? `<details class="past-history"><summary>過去の打ち合わせ ${past.length}件を見る</summary><div class="visit-list">${past.map((project,index) => {
          const dateText = project.visitDate ? new Date(`${project.visitDate}T00:00:00`).toLocaleDateString('ja-JP') : new Date(project.updatedAt || project.createdAt).toLocaleDateString('ja-JP');
          return `<article class="visit-item compact-visit">
            ${project.image ? `<img src="${project.image}" alt="${escapeHtml(project.visitTitle || folder.property)}" />` : '<div class="property-empty-photo">📝</div>'}
            <div><span class="visit-date">${escapeHtml(dateText)}</span><strong>${escapeHtml(project.visitTitle || `過去の打ち合わせ`)}</strong><span class="project-note-preview">${escapeHtml(project.note || 'メモなし')}</span></div>
            <div class="visit-actions"><button data-load="${project.id}" type="button">開く</button><button data-delete="${project.id}" type="button">削除</button></div>
          </article>`;
        }).join('')}</div></details>` : '<p class="no-past-history">過去の記録はまだありません</p>'}
      </section>`;
    }).join('');
  } catch (error) {
    console.error(error);
    projectList.innerHTML = '<p class="hint">物件ファイルを読み込めませんでした。Safariの通常モードで開いてください。</p>';
  }
}

projectList.addEventListener('click', async (event) => {
  const target = event.target.closest('button');
  if (!target) return;
  const loadId = target.dataset.load;
  const deleteId = target.dataset.delete;
  const addVisitProperty = target.dataset.addVisit;

  if (addVisitProperty) {
    const property = decodeURIComponent(addVisitProperty);
    const count = Number(target.dataset.count || 0);
    resetProject(false);
    projectName.value = property;
    visitDate.value = todayValue();
if (todayLabel) todayLabel.textContent = new Date().toLocaleDateString('ja-JP', { year:'numeric', month:'long', day:'numeric', weekday:'short' });
staffName.value = localStorage.getItem('reformHubLastStaff') || '';
    visitTitle.value = `第${count + 1}回 現場打ち合わせ`;
    document.querySelector('.details-card')?.setAttribute('open', '');
    document.querySelector('.details-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('同じ物件に新しい記録を追加します');
    return;
  }

  if (loadId) {
    const projects = await getProjects();
    const project = projects.find((item) => item.id === loadId);
    if (!project) return;
    projectName.value = project.propertyName || project.name || '';
    visitDate.value = project.visitDate || todayValue();
    visitTitle.value = project.visitTitle || '現場打ち合わせ';
    staffName.value = project.staff || '';
    if (workArea) workArea.value = project.workArea || '';
    projectNote.value = project.note || '';
    aiPrompt.value = project.aiPrompt || '';
    baseImageData = project.baseImage || project.image || null;
    activeProjectId = project.id;
    updateCurrentSiteBanner();
    await renderProjects();
    if (project.image) {
      await drawDataUrl(project.image);
      history = [project.image];
      emptyState.classList.add('hidden');
      setEnabled(true);
    } else {
      history = [];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      emptyState.classList.remove('hidden');
      setEnabled(false);
    }
    markSaved();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('打ち合わせ記録を開きました');
  }

  if (deleteId) {
    if (!confirm('この案件を削除しますか？')) return;
    await deleteProject(deleteId);
    if (activeProjectId === deleteId) resetProject(false);
    await renderProjects();
    showToast('案件を削除しました');
  }
});

function fileName() {
  return `${(projectName.value.trim() || 'reform-hub').replace(/[\\/:*?"<>|]/g, '_')}.jpg`;
}

completeAndShareBtn?.addEventListener('click', async () => {
  const hasText = projectName.value.trim() || projectNote.value.trim() || visitTitle.value.trim();
  if (!baseImageData && !hasText) {
    showToast('まず物件名か打合せ内容を入力してください');
    document.querySelector('.details-card')?.setAttribute('open','');
    projectName.focus();
    return;
  }
  await saveProject();
  teamsEmail.value = localStorage.getItem('reformHubTeamsEmail') || '';
  lastShareStatus.textContent = localStorage.getItem('reformHubLastShare') || 'まだ送信記録はありません';
  shareDialog.showModal();
});

saveProjectBtn.addEventListener('click', saveProject);
downloadBtn.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = fileName();
  link.href = canvas.toDataURL('image/jpeg', 0.93);
  document.body.appendChild(link);
  link.click();
  link.remove();
});

function formattedVisitDate() {
  if (!visitDate.value) return new Date().toLocaleDateString('ja-JP');
  return new Date(`${visitDate.value}T00:00:00`).toLocaleDateString('ja-JP', { year:'numeric', month:'long', day:'numeric' });
}

function shareMessage(short = false) {
  const property = projectName.value.trim() || '現場記録';
  const title = visitTitle.value.trim() || '現場打ち合わせ';
  const note = projectNote.value.trim() || '本日の打ち合わせ内容をご確認ください。';
  const staff = staffName.value.trim();
  const area = workArea?.value || '';
  const selectedAudience = [...document.querySelectorAll('.audience-check:checked')].map(el => el.value).join('・') || '関係者';
  if (short) {
    return `【${property}】${formattedVisitDate()}の打ち合わせ内容です。${area ? `\n工事場所：${area}` : ''}\n共有先：${selectedAudience}\n${note}\nご確認をお願いいたします。`;
  }
  return [
    `${property} ご担当者様`,
    '',
    `本日（${formattedVisitDate()}）の「${title}」の共通打合せ記録をお送りします。`,
    area ? `工事場所：${area}` : '',
    `共有先：${selectedAudience}`,
    'この内容を、お客様・業者・社員・担当者で同じ記録として確認します。',
    '',
    note,
    '',
    'ご確認をお願いいたします。',
    staff ? `CAINZ365　${staff}` : 'CAINZ365',
    '',
    'Reform Hubから送信'
  ].join('\n');
}

function shareSubject() {
  return `【CAINZ365】${projectName.value.trim() || '現場'} ${visitTitle.value.trim() || '打ち合わせ内容'}`;
}

function hasCanvasImage() {
  return Boolean(baseImageData) && !emptyState.classList.contains('hidden');
}

async function canvasShareFile() {
  if (!hasCanvasImage()) return null;
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  return blob ? new File([blob], fileName(), { type:'image/jpeg' }) : null;
}

function markShared(channel) {
  const stamp = new Date().toLocaleString('ja-JP', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' });
  const text = `✅ ${stamp}　${channel}を開きました`;
  localStorage.setItem('reformHubLastShare', text);
  lastShareStatus.textContent = text;
}

shareBtn.addEventListener('click', () => {
  teamsEmail.value = localStorage.getItem('reformHubTeamsEmail') || '';
  lastShareStatus.textContent = localStorage.getItem('reformHubLastShare') || 'まだ送信記録はありません';
  shareDialog.showModal();
});

nativeShareBtn.addEventListener('click', async () => {
  try {
    const file = await canvasShareFile();
    const data = { title: shareSubject(), text: shareMessage(false) };
    if (file && navigator.canShare?.({ files:[file] })) data.files = [file];
    if (!navigator.share) {
      showToast('この端末では共有メニューを開けません');
      return;
    }
    await navigator.share(data);
    markShared('共有メニュー');
    shareDialog.close();
  } catch (error) {
    if (error?.name !== 'AbortError') showToast('共有メニューを開けませんでした');
  }
});

lineShareBtn.addEventListener('click', () => {
  markShared('LINE');
  window.open(`https://line.me/R/msg/text/?${encodeURIComponent(shareMessage(false))}`, '_blank', 'noopener');
});

emailShareBtn.addEventListener('click', () => {
  markShared('メール');
  window.location.href = `mailto:?subject=${encodeURIComponent(shareSubject())}&body=${encodeURIComponent(shareMessage(false))}`;
});

smsShareBtn.addEventListener('click', () => {
  markShared('ショートメール');
  window.location.href = `sms:&body=${encodeURIComponent(shareMessage(true))}`;
});

teamsShareBtn.addEventListener('click', () => {
  const email = teamsEmail.value.trim();
  if (!email || !email.includes('@')) {
    teamsEmail.focus();
    showToast('自分の会社メールアドレスを入力してください');
    return;
  }
  localStorage.setItem('reformHubTeamsEmail', email);
  markShared('自分のTeams');
  const url = `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(email)}&message=${encodeURIComponent(shareMessage(false))}`;
  window.open(url, '_blank', 'noopener');
});

aiBtn.addEventListener('click', () => aiDialog.showModal());
savePromptBtn.addEventListener('click', () => {
  projectNote.value = [projectNote.value.trim(), aiPrompt.value.trim()].filter(Boolean).join('\n');
  markDirty();
  aiDialog.close();
  showToast('AI指示文を現場メモへ保存しました');
});

function resetProject(confirmFirst = true) {
  if (confirmFirst && baseImageData && !confirm('新しい案件を始めますか？未保存の変更は消えます。')) return;
  projectName.value = '';
  visitDate.value = todayValue();
if (todayLabel) todayLabel.textContent = new Date().toLocaleDateString('ja-JP', { year:'numeric', month:'long', day:'numeric', weekday:'short' });
staffName.value = localStorage.getItem('reformHubLastStaff') || '';
  visitTitle.value = '';
  staffName.value = localStorage.getItem('reformHubLastStaff') || '';
  projectNote.value = '';
  if (workArea) workArea.value = '';
  aiPrompt.value = '';
  imageInput.value = '';
  baseImageData = null;
  activeProjectId = null;
  history = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  canvas.width = 1200;
  canvas.height = 800;
  emptyState.classList.remove('hidden');
  setEnabled(false);
  markDirty();
  updateCurrentSiteBanner();
  renderProjects();
}
newProjectBtn.addEventListener('click', () => resetProject(true));

deleteAllBtn.addEventListener('click', async () => {
  const projects = await getProjects();
  if (!projects.length) return;
  if (confirm('保存した物件ファイルをすべて削除しますか？')) {
    await clearProjects();
    resetProject(false);
    await renderProjects();
    showToast('全物件ファイルを削除しました');
  }
});

const installHelpDialog = document.getElementById('installHelpDialog');
const installHelpText = document.getElementById('installHelpText');
const homeInstallBtn = document.getElementById('homeInstallBtn');

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
});

async function openInstallGuide() {
  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
    showToast('すでにホーム画面から使えます');
    return;
  }
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    return;
  }
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (installHelpText) installHelpText.innerHTML = isIOS
    ? '<p><b>1</b> Safari下部または上部の共有ボタン「□↑」を押す</p><p><b>2</b> 「ホーム画面に追加」を選ぶ</p><p><b>3</b> 右上の「追加」を押す</p>'
    : '<p><b>1</b> ブラウザのメニュー「︙」を押す</p><p><b>2</b> 「アプリをインストール」または「ホーム画面に追加」を選ぶ</p><p><b>3</b> 「追加」を押す</p>';
  installHelpDialog?.showModal();
}
installBtn?.addEventListener('click', openInstallGuide);
homeInstallBtn?.addEventListener('click', openInstallGuide);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}


quickMemoBtn?.addEventListener('click', () => {
  document.querySelector('.details-card')?.setAttribute('open', '');
  visitDate.value = todayValue();
  if (!visitTitle.value) visitTitle.value = '現場打ち合わせメモ';
  document.querySelector('.details-card')?.scrollIntoView({ behavior:'smooth', block:'start' });
  setTimeout(() => projectNote.focus(), 450);
  showToast('写真なしでメモを保存できます');
});

projectSearch?.addEventListener('input', () => {
  const query = projectSearch.value.trim().toLocaleLowerCase('ja-JP');
  let visible = 0;
  document.querySelectorAll('.property-folder').forEach((folder) => {
    const match = !query || (folder.dataset.search || '').includes(query);
    folder.hidden = !match;
    if (match) visible += 1;
  });
  const old = projectList.querySelector('.no-search-result');
  if (old) old.remove();
  if (query && visible === 0) projectList.insertAdjacentHTML('beforeend', '<p class="no-search-result">該当する物件がありません</p>');
});

restoreDraft();
updateCurrentSiteBanner();

renderProjects();
setEnabled(false);

// v1.3 simple navigation
const showProjectsBtn = document.getElementById('showProjectsBtn');
const helpBtn = document.getElementById('helpBtn');
const helpDialog = document.getElementById('helpDialog');
const customerModeBtn = document.getElementById('customerModeBtn');
showProjectsBtn?.addEventListener('click', () => document.getElementById('projectsSection')?.scrollIntoView({behavior:'smooth'}));
helpBtn?.addEventListener('click', () => helpDialog?.showModal());
customerModeBtn?.addEventListener('click', () => {
  document.body.classList.toggle('customer-mode');
  customerModeBtn.textContent = document.body.classList.contains('customer-mode') ? '編集画面に戻る' : '👤 お客様に見せる';
});
imageInput?.addEventListener('change', () => setTimeout(() => document.getElementById('workspaceSection')?.scrollIntoView({behavior:'smooth'}), 350));


// v1.4 音声入力
(() => {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const voiceButtons = [...document.querySelectorAll('.voice-btn')];
  const voiceStatus = document.getElementById('voiceStatus');
  const stopVoiceBtn = document.getElementById('stopVoiceBtn');
  let recognition = null;
  let currentField = null;

  const appendText = (field, text) => {
    const clean = String(text || '').trim();
    if (!clean) return;
    const separator = field.tagName === 'TEXTAREA' && field.value.trim() ? '。' : (field.value.trim() ? ' ' : '');
    field.value = `${field.value}${separator}${clean}`.slice(0, Number(field.maxLength) > 0 ? Number(field.maxLength) : undefined);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.focus();
  };

  const stop = () => {
    try { recognition?.stop(); } catch (_) {}
    voiceStatus?.classList.add('hidden');
    voiceButtons.forEach((button) => { button.disabled = false; button.textContent = '🎤 話して入力'; });
  };

  voiceButtons.forEach((button) => {
    button.addEventListener('click', () => {
      currentField = document.getElementById(button.dataset.target);
      currentField?.focus();

      if (!Recognition) {
        showToast('キーボード左下の🎤を押して話してください');
        button.textContent = '⬇️ 下のマイクを押す';
        setTimeout(() => { button.textContent = '🎤 話して入力'; }, 3000);
        return;
      }

      recognition = new Recognition();
      recognition.lang = 'ja-JP';
      recognition.interimResults = true;
      recognition.continuous = false;
      let finalText = '';

      voiceButtons.forEach((item) => item.disabled = true);
      button.disabled = false;
      button.textContent = '■ 音声入力を停止';
      voiceStatus?.classList.remove('hidden');

      recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const text = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalText += text; else interim += text;
        }
        if (interim) voiceStatus?.querySelector('strong') && (voiceStatus.querySelector('strong').textContent = interim);
      };
      recognition.onerror = () => {
        showToast('音声入力を開始できません。キーボードの🎤をお試しください');
        stop();
      };
      recognition.onend = () => {
        appendText(currentField, finalText);
        if (finalText) showToast('音声を文字にしました');
        stop();
      };

      try { recognition.start(); } catch (_) { stop(); }
    });
  });

  stopVoiceBtn?.addEventListener('click', stop);
})();


// v2.0 ホーム画面と固定ナビ
const homeDate = document.getElementById('homeDate');
const homeNewProjectBtn = document.getElementById('homeNewProjectBtn');
const bottomImageInput = document.getElementById('bottomImageInput');
const navHomeBtn = document.getElementById('navHomeBtn');
const navProjectsBtn = document.getElementById('navProjectsBtn');
const navShareBtn = document.getElementById('navShareBtn');
if (homeDate) homeDate.textContent = new Date().toLocaleDateString('ja-JP', {year:'numeric', month:'long', day:'numeric', weekday:'long'});
homeNewProjectBtn?.addEventListener('click', () => {
  resetProject(Boolean(baseImageData || projectName.value.trim() || projectNote.value.trim()));
  document.querySelector('.details-card')?.setAttribute('open','');
  document.querySelector('.details-card')?.scrollIntoView({behavior:'smooth', block:'start'});
  setTimeout(() => projectName.focus(), 420);
});
bottomImageInput?.addEventListener('change', () => {
  const file = bottomImageInput.files?.[0];
  if (file) loadImageFile(file).then(() => document.getElementById('workspaceSection')?.scrollIntoView({behavior:'smooth'}));
  bottomImageInput.value = '';
});
navHomeBtn?.addEventListener('click', () => document.getElementById('homeDashboard')?.scrollIntoView({behavior:'smooth', block:'start'}));
navProjectsBtn?.addEventListener('click', () => document.getElementById('projectsSection')?.scrollIntoView({behavior:'smooth', block:'start'}));
navShareBtn?.addEventListener('click', () => shareDialog?.showModal());
