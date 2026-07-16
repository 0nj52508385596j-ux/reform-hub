'use strict';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const imageInput = $('imageInput');
const emptyState = $('emptyState');
const projectName = $('projectName');
const staffName = $('staffName');
const projectNote = $('projectNote');
const penColor = $('penColor');
const penWidth = $('penWidth');
const penWidthValue = $('penWidthValue');
const drawToggleBtn = $('drawToggleBtn');
const undoBtn = $('undoBtn');
const clearDrawingBtn = $('clearDrawingBtn');
const saveProjectBtn = $('saveProjectBtn');
const downloadBtn = $('downloadBtn');
const shareBtn = $('shareBtn');
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

let baseImageData = null;
let activeProjectId = null;
let isDrawing = false;
let drawingEnabled = true;
let history = [];
let deferredPrompt = null;
let toastTimer = null;

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
  [drawToggleBtn, clearDrawingBtn, saveProjectBtn, downloadBtn, shareBtn, aiBtn].forEach((button) => {
    button.disabled = !enabled;
  });
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
[projectName, staffName, projectNote, aiPrompt].forEach((field) => field.addEventListener('input', markDirty));

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

async function saveProject() {
  if (!baseImageData) return;
  saveProjectBtn.disabled = true;
  saveProjectBtn.textContent = '保存中…';
  const now = new Date().toISOString();
  const item = {
    id: activeProjectId || safeId(),
    name: projectName.value.trim() || `無題の案件 ${new Date().toLocaleDateString('ja-JP')}`,
    staff: staffName.value.trim(),
    note: projectNote.value.trim(),
    aiPrompt: aiPrompt.value.trim(),
    baseImage: baseImageData,
    image: canvasDataUrl(0.76),
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
    activeProjectId = item.id;
    markSaved();
    await renderProjects();
    showToast('案件を保存しました');
  } catch (error) {
    console.error(error);
    showToast('保存できませんでした。Safariのプライベートブラウズを解除して再度お試しください');
  } finally {
    saveProjectBtn.textContent = '💾 案件を保存';
    saveProjectBtn.disabled = !baseImageData;
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
    if (!projects.length) {
      projectList.innerHTML = '<p class="hint">まだ保存した案件はありません。写真を入れて「案件を保存」を押してください。</p>';
      return;
    }
    projectList.innerHTML = projects.map((project) => `
      <article class="project-item">
        <img src="${project.image}" alt="${escapeHtml(project.name)}" />
        <div>
          <strong>${escapeHtml(project.name)}</strong>
          <small>${escapeHtml(project.staff || '担当者未入力')}・${new Date(project.updatedAt || project.createdAt).toLocaleString('ja-JP')}</small>
          <span class="project-note-preview">${escapeHtml(project.note || 'メモなし')}</span>
        </div>
        <div class="project-item-actions">
          <button data-load="${project.id}" type="button">開く</button>
          <button data-delete="${project.id}" type="button">削除</button>
        </div>
      </article>`).join('');
  } catch (error) {
    console.error(error);
    projectList.innerHTML = '<p class="hint">保存案件を読み込めませんでした。Safariのプライベートブラウズでは通常モードで開いてください。</p>';
  }
}

projectList.addEventListener('click', async (event) => {
  const target = event.target.closest('button');
  if (!target) return;
  const loadId = target.dataset.load;
  const deleteId = target.dataset.delete;

  if (loadId) {
    const projects = await getProjects();
    const project = projects.find((item) => item.id === loadId);
    if (!project) return;
    projectName.value = project.name || '';
    staffName.value = project.staff || '';
    projectNote.value = project.note || '';
    aiPrompt.value = project.aiPrompt || '';
    baseImageData = project.baseImage || project.image;
    activeProjectId = project.id;
    await drawDataUrl(project.image);
    history = [project.image];
    emptyState.classList.add('hidden');
    setEnabled(true);
    markSaved();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('案件を開きました');
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

saveProjectBtn.addEventListener('click', saveProject);
downloadBtn.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = fileName();
  link.href = canvas.toDataURL('image/jpeg', 0.93);
  document.body.appendChild(link);
  link.click();
  link.remove();
});

shareBtn.addEventListener('click', async () => {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  if (!blob) return;
  const file = new File([blob], fileName(), { type:'image/jpeg' });
  try {
    if (navigator.canShare?.({ files:[file] })) {
      await navigator.share({
        title: projectName.value || 'Reform Hub',
        text: projectNote.value || 'Reform Hubで作成した現場提案イメージです。',
        files:[file]
      });
    } else if (navigator.share) {
      await navigator.share({ title: projectName.value || 'Reform Hub', text: projectNote.value || 'Reform Hubで作成した提案です。' });
    } else {
      showToast('この端末では共有できません。「画像を保存」をご利用ください');
    }
  } catch (error) {
    if (error?.name !== 'AbortError') showToast('共有できませんでした。画像保存をご利用ください');
  }
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
  staffName.value = '';
  projectNote.value = '';
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
}
newProjectBtn.addEventListener('click', () => resetProject(true));

deleteAllBtn.addEventListener('click', async () => {
  const projects = await getProjects();
  if (!projects.length) return;
  if (confirm('保存した案件をすべて削除しますか？')) {
    await clearProjects();
    resetProject(false);
    await renderProjects();
    showToast('全案件を削除しました');
  }
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  installBtn.classList.remove('hidden');
});
installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.classList.add('hidden');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

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
