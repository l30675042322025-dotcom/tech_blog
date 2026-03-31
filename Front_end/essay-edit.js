const titleInput = document.getElementById('essay-title-input');
const locationInput = document.getElementById('essay-location-input');
const coverInput = document.getElementById('essay-cover-input');
const coverPreview = document.getElementById('essay-cover-preview');
const coverText = document.getElementById('essay-cover-text');
const editor = document.getElementById('essay-editor');
const modeText = document.getElementById('essay-mode-text');
const backButton = document.getElementById('essay-back-btn');
const saveButton = document.getElementById('essay-save-btn');
const locateButton = document.getElementById('essay-locate-btn');
const imageInput = document.getElementById('essay-image-input');
const toast = document.getElementById('essay-toast');
const hiddenToggle = document.getElementById('essay-hidden-toggle');

const api = window.TechVibeApi || null;
const sessionApi = window.TechVibeSession || null;
const ADMIN_USERNAME = 'admin';

const queryParams = new URLSearchParams(window.location.search);
const parsedEssayId = Number(queryParams.get('id'));
const essayId = Number.isFinite(parsedEssayId) && parsedEssayId > 0 ? parsedEssayId : null;
const isEditMode = essayId !== null;

let selectedEditorImage = null;
let imageResizeHandle = null;
let imageResizeFrame = null;
let activeImageResizeState = null;
let toastTimer = 0;
let currentCoverImage = '';

const IMAGE_RESIZE_MIN_WIDTH = 80;
const IMAGE_RESIZE_FRAME_PADDING = 4;
const IMAGE_RESIZE_HANDLE_SIZE = 14;
const GEOLOCATION_TIMEOUT_MS = 20000;

function showToast(message, type) {
  if (!toast) {
    return;
  }
  toast.textContent = String(message || '操作完成');
  toast.hidden = false;
  toast.classList.remove('success', 'error');
  if (type === 'success' || type === 'error') {
    toast.classList.add(type);
  }
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2200);
}

function normalizeText(value) {
  return String(value || '').trim();
}

function isAuthed() {
  return Boolean(sessionApi && typeof sessionApi.isAuthed === 'function' && sessionApi.isAuthed());
}

function getProfile() {
  if (!sessionApi || typeof sessionApi.getProfile !== 'function') {
    return null;
  }
  return sessionApi.getProfile();
}

function isAdmin(profile) {
  const name = String((profile && profile.name) || '').trim().toLowerCase();
  return name === ADMIN_USERNAME;
}

function redirectToLogin() {
  const currentPage = window.location.pathname.split('/').pop() || 'essay-edit.html';
  const redirectPath = isEditMode ? `${currentPage}?id=${essayId}` : currentPage;
  const redirect = encodeURIComponent(redirectPath);
  window.location.href = `./auth.html?tab=login&redirect=${redirect}`;
}

function syncModeUI() {
  const modeLabel = isEditMode ? '编辑随笔' : '发布随笔';
  if (modeText) {
    modeText.textContent = modeLabel;
  }
  document.title = `笔落客 - ${modeLabel}`;
  if (saveButton) {
    saveButton.textContent = isEditMode ? '保存随笔' : '发布随笔';
  }
}

function getEditorTextContent() {
  if (!editor) {
    return '';
  }
  return normalizeText(editor.textContent || '');
}

function getEditorHtmlContent() {
  if (!editor) {
    return '';
  }
  return String(editor.innerHTML || '').trim();
}

function moveCursorAfterNode(node) {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function insertImageAtCursor(imageUrl) {
  if (!editor) {
    return;
  }
  const url = normalizeText(imageUrl);
  if (!url) {
    return;
  }

  editor.focus();
  const selection = window.getSelection();
  const image = document.createElement('img');
  image.src = url;
  image.alt = '随笔图片';

  if (!selection || selection.rangeCount === 0) {
    editor.appendChild(image);
    moveCursorAfterNode(image);
    return;
  }

  const range = selection.getRangeAt(0);
  const inEditor = editor.contains(range.commonAncestorContainer);
  if (!inEditor) {
    editor.appendChild(image);
    moveCursorAfterNode(image);
    return;
  }

  range.deleteContents();
  range.insertNode(image);
  moveCursorAfterNode(image);
}

async function uploadEssayImage(file) {
  if (!api) {
    throw new Error('接口客户端不可用。');
  }
  if (!file) {
    throw new Error('缺少图片文件。');
  }
  if (!isAuthed()) {
    redirectToLogin();
    throw new Error('请先登录。');
  }
  if (!isAdmin(getProfile())) {
    throw new Error('仅管理员可上传随笔图片。');
  }

  const type = String(file.type || '').toLowerCase();
  if (!type.startsWith('image/')) {
    throw new Error('仅支持图片文件。');
  }

  const formData = new FormData();
  formData.append('file', file);
  const response = await api.postForm('/essays/image', formData, { auth: true });
  const imageUrl = normalizeText(response && response.imageUrl);
  if (!imageUrl) {
    throw new Error('图片上传成功，但未返回地址。');
  }
  return imageUrl;
}

async function handleImageFiles(files) {
  const list = Array.from(files || []).filter(Boolean);
  if (!list.length) {
    return;
  }

  for (const file of list) {
    try {
      showToast(`正在上传图片：${file.name}`, 'success');
      const imageUrl = await uploadEssayImage(file);
      insertImageAtCursor(imageUrl);
      showToast('图片已插入内容。', 'success');
    } catch (error) {
      showToast(error && error.message ? error.message : '图片上传失败。', 'error');
    }
  }
}

async function uploadCoverFile(file) {
  if (!api) {
    throw new Error('接口客户端不可用。');
  }
  if (!file) {
    throw new Error('缺少封面文件。');
  }
  if (!isAuthed()) {
    showToast('请先登录。', 'error');
    redirectToLogin();
    throw new Error('authorization required');
  }
  if (!isAdmin(getProfile())) {
    throw new Error('仅管理员可上传封面图。');
  }
  if (!String(file.type || '').toLowerCase().startsWith('image/')) {
    throw new Error('封面文件必须是图片格式。');
  }

  const formData = new FormData();
  formData.append('file', file);
  const response = await api.postForm('/essays/image', formData, { auth: true });
  const coverImage = String((response && response.imageUrl) || '').trim();
  if (!coverImage) {
    throw new Error('封面上传成功，但未返回图片地址。');
  }

  return {
    coverImage,
    objectKey: String((response && response.objectKey) || '').trim(),
    fileName: String((response && response.fileName) || '').trim(),
  };
}

function setCoverUploadLabel(text, title) {
  if (!coverText) {
    return;
  }
  coverText.textContent = String(text || '上传封面图');
  coverText.title = String(title || '');
}

function renderCoverPreview(url) {
  if (!coverPreview) {
    return;
  }

  const normalizedUrl = String(url || '').trim();
  const uploader = coverPreview.closest('.essay-cover-uploader');

  if (!normalizedUrl) {
    coverPreview.hidden = true;
    coverPreview.removeAttribute('src');
    if (uploader) {
      uploader.classList.remove('has-preview');
    }
    return;
  }

  coverPreview.hidden = false;
  coverPreview.src = normalizedUrl;
  if (uploader) {
    uploader.classList.add('has-preview');
  }
}

async function saveEssay() {
  if (!api) {
    throw new Error('接口客户端不可用。');
  }
  if (!isAuthed()) {
    redirectToLogin();
    throw new Error('请先登录。');
  }
  if (!isAdmin(getProfile())) {
    throw new Error('仅管理员可发布随笔。');
  }

  const title = normalizeText(titleInput ? titleInput.value : '');
  const location = normalizeText(locationInput ? locationInput.value : '');
  const coverImage = normalizeText(currentCoverImage);
  const content = getEditorHtmlContent();
  const plainText = getEditorTextContent();
  const hasImage = Boolean(editor && editor.querySelector('img'));

  if (!title) {
    throw new Error('请先填写随笔标题。');
  }
  if (!plainText && !hasImage) {
    throw new Error('请先填写随笔内容。');
  }

  if (location.length > 120) {
    throw new Error('location length must be <= 120');
  }

  const hidden = hiddenToggle ? hiddenToggle.checked : false;
  const payload = { title, location, coverImage, content, hidden };
  if (isEditMode && essayId != null) {
    return api.put(`/essays/${essayId}`, payload, { auth: true });
  }
  return api.post('/essays', payload, { auth: true });
}

function setLocateButtonLoading(loading) {
  if (!locateButton) {
    return;
  }

  if (!locateButton.dataset.defaultText) {
    locateButton.dataset.defaultText = locateButton.textContent || '获取当前位置';
  }

  locateButton.disabled = Boolean(loading);
  locateButton.textContent = loading ? '定位中...' : locateButton.dataset.defaultText;
}

function isLocalhost(hostname) {
  const host = normalizeText(hostname).toLowerCase().replace(/\.$/, '');
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '[::1]'
  );
}

function buildInsecureContextMessage() {
  const protocol = normalizeText(window.location.protocol);
  const host = normalizeText(window.location.host);
  const origin = protocol && host ? `${protocol}//${host}` : window.location.href;
  return `当前站点 ${origin} 不是 HTTPS 或 localhost，浏览器已禁止定位。请改用 HTTPS 访问。`;
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('current browser does not support geolocation'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: GEOLOCATION_TIMEOUT_MS,
      maximumAge: 60 * 1000,
    });
  });
}

function mapGeolocationError(error) {
  if (!error || typeof error !== 'object') {
    return '获取位置失败';
  }

  const code = Number(error.code || 0);
  if (code === 1) {
    return '定位权限被拒绝，请在浏览器设置中允许定位权限';
  }
  if (code === 2) {
    return '无法获取位置信息，请检查设备定位服务是否开启';
  }
  if (code === 3) {
    return '获取定位超时，请检查网络连接或稍后重试';
  }

  return normalizeText(error.message) || '获取位置失败';
}

async function fetchResolvedLocation(latitude, longitude) {
  if (!api) {
    throw new Error('api client is unavailable');
  }

  const params = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
  });
  const response = await api.get(`/essays/location/reverse?${params.toString()}`, { auth: true });
  return normalizeText(response && response.location);
}

async function locateCurrentPosition() {
  try {
    if (!isAuthed()) {
      showToast('请先登录。', 'error');
      redirectToLogin();
      return;
    }
    if (!isAdmin(getProfile())) {
      throw new Error('仅管理员可获取发布定位。');
    }
    if (!window.isSecureContext && !isLocalhost(window.location.hostname)) {
      throw new Error(buildInsecureContextMessage());
    }

    setLocateButtonLoading(true);
    showToast('正在获取定位...', 'success');

    const position = await getCurrentPosition();
    const latitude = Number(position && position.coords && position.coords.latitude);
    const longitude = Number(position && position.coords && position.coords.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error('invalid geolocation coordinates');
    }

    const location = await fetchResolvedLocation(latitude, longitude);
    if (!location) {
      throw new Error('location resolve failed');
    }
    if (locationInput) {
      locationInput.value = location;
    }
    showToast(`定位成功：${location}`, 'success');
  } catch (error) {
    const maybeGeoCode = Number(error && error.code);
    const isGeoError = Number.isFinite(maybeGeoCode) && maybeGeoCode >= 1 && maybeGeoCode <= 3;
    const message = isGeoError ? mapGeolocationError(error) : (error && error.message ? error.message : 'location failed');
    showToast(message, 'error');
  } finally {
    setLocateButtonLoading(false);
  }
}

async function ensurePageAccess() {
  if (!isAuthed()) {
    showToast('请先登录。', 'error');
    redirectToLogin();
    return false;
  }

  if (sessionApi && typeof sessionApi.refreshProfileFromServer === 'function') {
    await sessionApi.refreshProfileFromServer();
  }

  if (!isAuthed()) {
    showToast('登录状态已失效，请重新登录。', 'error');
    redirectToLogin();
    return false;
  }

  if (!isAdmin(getProfile())) {
    showToast('仅管理员可编辑或发布随笔。', 'error');
    window.location.href = './index.html';
    return false;
  }

  return true;
}

async function loadEssay() {
  if (!api || !isEditMode || essayId == null) {
    return;
  }
  const essay = await api.get(`/essays/${essayId}`, { auth: true });
  if (titleInput) {
    titleInput.value = normalizeText(essay && essay.title);
  }
  if (locationInput) {
    locationInput.value = normalizeText(essay && essay.location);
  }
  const coverImage = normalizeText(essay && essay.coverImage);
  currentCoverImage = coverImage;
  renderCoverPreview(coverImage);
  if (coverImage) {
    setCoverUploadLabel('已上传封面图', coverImage);
  }
  if (editor) {
    const content = String((essay && essay.content) || '').trim();
    editor.innerHTML = content || '<p><br /></p>';
  }
  if (hiddenToggle && essay && essay.hidden) {
    hiddenToggle.checked = true;
  }
}

function createImageResizeControls() {
  if (imageResizeHandle && imageResizeFrame) {
    return;
  }

  imageResizeFrame = document.createElement('div');
  imageResizeFrame.className = 'editor-image-resize-frame';
  imageResizeFrame.hidden = true;

  imageResizeHandle = document.createElement('button');
  imageResizeHandle.type = 'button';
  imageResizeHandle.className = 'editor-image-resize-handle';
  imageResizeHandle.setAttribute('aria-label', '调整图片大小');
  imageResizeHandle.hidden = true;
  imageResizeHandle.addEventListener('mousedown', startImageResizeDrag);

  document.body.appendChild(imageResizeFrame);
  document.body.appendChild(imageResizeHandle);
}

function getEditorImageFromTarget(target) {
  if (!target || !editor) return null;
  if (!(target instanceof HTMLElement)) return null;
  const imageElement = target.closest('img');
  if (!imageElement || imageElement.tagName !== 'IMG') return null;
  return editor.contains(imageElement) ? imageElement : null;
}

function hideImageResizeControls() {
  if (imageResizeFrame) {
    imageResizeFrame.hidden = true;
  }
  if (imageResizeHandle) {
    imageResizeHandle.hidden = true;
  }
}

function positionImageResizeControls() {
  if (!selectedEditorImage || !editor || !imageResizeHandle || !imageResizeFrame) {
    hideImageResizeControls();
    return;
  }
  if (!selectedEditorImage.isConnected || !editor.contains(selectedEditorImage)) {
    selectedEditorImage = null;
    hideImageResizeControls();
    return;
  }

  const imageRect = selectedEditorImage.getBoundingClientRect();
  if (imageRect.width <= 0 || imageRect.height <= 0) {
    hideImageResizeControls();
    return;
  }

  const frameLeft = imageRect.left - IMAGE_RESIZE_FRAME_PADDING;
  const frameTop = imageRect.top - IMAGE_RESIZE_FRAME_PADDING;
  const frameWidth = imageRect.width + IMAGE_RESIZE_FRAME_PADDING * 2;
  const frameHeight = imageRect.height + IMAGE_RESIZE_FRAME_PADDING * 2;

  imageResizeFrame.style.left = `${Math.round(frameLeft)}px`;
  imageResizeFrame.style.top = `${Math.round(frameTop)}px`;
  imageResizeFrame.style.width = `${Math.round(frameWidth)}px`;
  imageResizeFrame.style.height = `${Math.round(frameHeight)}px`;
  imageResizeFrame.hidden = false;

  const handleLeft = imageRect.right - IMAGE_RESIZE_HANDLE_SIZE / 2;
  const handleTop = imageRect.bottom - IMAGE_RESIZE_HANDLE_SIZE / 2;
  imageResizeHandle.style.left = `${Math.round(handleLeft)}px`;
  imageResizeHandle.style.top = `${Math.round(handleTop)}px`;
  imageResizeHandle.hidden = false;
}

function selectEditorImage(imageElement) {
  selectedEditorImage = imageElement || null;
  if (!selectedEditorImage) {
    hideImageResizeControls();
    return;
  }
  selectedEditorImage.draggable = false;
  positionImageResizeControls();
}

function clearEditorImageSelection() {
  selectedEditorImage = null;
  hideImageResizeControls();
}

function startImageResizeDrag(event) {
  if (!selectedEditorImage || !editor || event.button !== 0) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();

  const imageRect = selectedEditorImage.getBoundingClientRect();
  const canvasRect = editor.getBoundingClientRect();
  const aspectRatio = imageRect.height > 0 ? imageRect.width / imageRect.height : 0;
  const maxWidth = Math.max(IMAGE_RESIZE_MIN_WIDTH, canvasRect.width - 18);

  activeImageResizeState = {
    startX: event.clientX,
    startWidth: imageRect.width,
    startHeight: imageRect.height,
    aspectRatio,
    maxWidth,
  };

  document.body.classList.add('is-image-resizing');
  document.addEventListener('mousemove', onImageResizeDrag);
  document.addEventListener('mouseup', endImageResizeDrag);
}

function onImageResizeDrag(event) {
  if (!activeImageResizeState || !selectedEditorImage) {
    return;
  }

  const deltaX = event.clientX - activeImageResizeState.startX;
  const nextWidth = Math.min(
    activeImageResizeState.maxWidth,
    Math.max(IMAGE_RESIZE_MIN_WIDTH, activeImageResizeState.startWidth + deltaX)
  );
  const nextHeight = activeImageResizeState.aspectRatio > 0
    ? nextWidth / activeImageResizeState.aspectRatio
    : activeImageResizeState.startHeight;

  const width = Math.round(nextWidth);
  const height = Math.round(nextHeight);

  selectedEditorImage.style.width = `${width}px`;
  selectedEditorImage.style.height = `${height}px`;
  selectedEditorImage.setAttribute('width', String(width));
  selectedEditorImage.setAttribute('height', String(height));

  positionImageResizeControls();
}

function endImageResizeDrag() {
  if (!activeImageResizeState) {
    return;
  }
  activeImageResizeState = null;
  document.body.classList.remove('is-image-resizing');
  document.removeEventListener('mousemove', onImageResizeDrag);
  document.removeEventListener('mouseup', endImageResizeDrag);
}

function bindImageResizeEvents() {
  if (!editor || editor.dataset.imageResizeBound === '1') return;
  editor.dataset.imageResizeBound = '1';
  createImageResizeControls();

  editor.addEventListener('click', (event) => {
    const targetImage = getEditorImageFromTarget(event.target);
    if (!targetImage) {
      clearEditorImageSelection();
      return;
    }
    event.preventDefault();
    selectEditorImage(targetImage);
  });

  editor.addEventListener('input', () => {
    if (!selectedEditorImage || !editor.contains(selectedEditorImage)) {
      clearEditorImageSelection();
      return;
    }
    positionImageResizeControls();
  });

  document.addEventListener('mousedown', (event) => {
    if (!editor) return;
    const targetImage = getEditorImageFromTarget(event.target);
    if (targetImage) return;
    if (imageResizeHandle && imageResizeHandle.contains(event.target)) return;
    if (editor.contains(event.target)) {
      clearEditorImageSelection();
      return;
    }
    clearEditorImageSelection();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      clearEditorImageSelection();
    }
  });

  window.addEventListener('resize', positionImageResizeControls);
  window.addEventListener('scroll', positionImageResizeControls, true);
}

if (imageInput) {
  imageInput.addEventListener('change', async () => {
    const files = Array.from(imageInput.files || []);
    await handleImageFiles(files);
    imageInput.value = '';
  });
}

if (coverInput) {
  coverInput.addEventListener('change', async () => {
    const file = coverInput.files && coverInput.files[0];
    if (!file) {
      return;
    }
    try {
      showToast('正在上传封面图...', 'success');
      const result = await uploadCoverFile(file);
      currentCoverImage = result.coverImage;
      renderCoverPreview(result.coverImage);
      setCoverUploadLabel('已上传封面图', result.coverImage);
      showToast('封面图上传成功。', 'success');
    } catch (error) {
      showToast(error && error.message ? error.message : '封面图上传失败。', 'error');
    } finally {
      coverInput.value = '';
    }
  });
}

if (editor) {
  editor.addEventListener('paste', async (event) => {
    const clipboard = event.clipboardData;
    if (!clipboard) {
      return;
    }

    const imageFiles = [];
    for (const item of Array.from(clipboard.items || [])) {
      if (String(item.type || '').toLowerCase().startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          imageFiles.push(file);
        }
      }
    }

    if (!imageFiles.length) {
      return;
    }

    event.preventDefault();
    await handleImageFiles(imageFiles);
  });
}

if (locateButton) {
  locateButton.addEventListener('click', async () => {
    await locateCurrentPosition();
  });
}

if (saveButton) {
  saveButton.addEventListener('click', async () => {
    try {
      const result = await saveEssay();
      const resultId = Number(result && result.id);
      showToast('随笔保存成功。', 'success');

      if (!isEditMode && Number.isFinite(resultId) && resultId > 0) {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('id', String(resultId));
        window.setTimeout(() => {
          window.location.href = newUrl.toString();
        }, 400);
      }
    } catch (error) {
      showToast(error && error.message ? error.message : '随笔保存失败。', 'error');
    }
  });
}

if (backButton) {
  backButton.addEventListener('click', () => {
    window.location.href = './index.html';
  });
}

syncModeUI();
bindImageResizeEvents();

(async () => {
  const canAccess = await ensurePageAccess();
  if (!canAccess) {
    return;
  }

  if (isEditMode) {
    try {
      await loadEssay();
    } catch (error) {
      showToast(error && error.message ? error.message : '随笔加载失败。', 'error');
    }
  }
})();
