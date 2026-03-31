(function () {
  const api = window.TechVibeApi || null;
  const session = window.TechVibeSession || null;

  const ADMIN_USERNAME = 'admin';
  const ESSAY_CATEGORY = '\u968f\u7b14';
  const SOURCE_ESSAY = 'essay';
  const SOURCE_ARTICLE = 'article';
  const PREVIEW_MAX_LENGTH = 120;
  const ESSAY_CATEGORY_ALIASES = new Set([
    '\u968f\u7b14',
    '\u95f2\u7b14',
    '\u968f\u60f3',
    'essay',
    'essays',
    'note',
    'notes',
  ]);

  const essaysList = document.getElementById('essays-list');
  const loadingState = document.getElementById('loading-state');
  let emptyState = document.getElementById('empty-state');
  const toastContainer = document.getElementById('toast-container');
  const deleteDialog = document.getElementById('delete-confirm-dialog');
  const dialogCancel = document.getElementById('dialog-cancel');
  const dialogConfirm = document.getElementById('dialog-confirm');

  const TEXT = {
    emptyTitle: '\u6682\u65e0\u968f\u7b14',
    emptyDesc: '\u70b9\u51fb\u5f00\u59cb\u521b\u4f5c\uff0c\u5c31\u53ef\u4ee5\u65b0\u5efa\u7b2c\u4e00\u7bc7\u968f\u7b14\u3002',
    emptyAction: '\u5f00\u59cb\u521b\u4f5c',
    untitled: '\u672a\u547d\u540d\u968f\u7b14',
    publishTime: '\u53d1\u5e03\u65f6\u95f4',
    loadingFailed: '\u52a0\u8f7d\u968f\u7b14\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002',
    deleting: '\u5220\u9664\u4e2d...',
    deleteSuccess: '\u968f\u7b14\u5df2\u5220\u9664\u3002',
    deleteFailed: '\u5220\u9664\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002',
    deleteLabel: '\u5220\u9664',
    editLabel: '\u7f16\u8f91',
    previewFallback: '\u6682\u65e0\u5185\u5bb9\u6458\u8981',
    locationUnknown: '\u672a\u8bbe\u7f6e\u5b9a\u4f4d',
    accessDenied: '\u4ec5\u7ba1\u7406\u5458\u53ef\u8bbf\u95ee\u6b64\u9875\u9762\u3002',
  };

  let pendingDeleteTarget = null;

  function normalizeText(value) {
    return String(value == null ? '' : value).trim();
  }

  function normalizeSourceType(value) {
    return value === SOURCE_ARTICLE ? SOURCE_ARTICLE : SOURCE_ESSAY;
  }

  function escapeHtml(str) {
    const value = String(str == null ? '' : str);
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function stripHtmlTags(text) {
    return normalizeText(text).replace(/<[^>]*>/g, ' ');
  }

  function createPreviewText(rawValue) {
    const plain = stripHtmlTags(rawValue).replace(/\s+/g, ' ');
    if (!plain) {
      return TEXT.previewFallback;
    }
    if (plain.length <= PREVIEW_MAX_LENGTH) {
      return plain;
    }
    return `${plain.slice(0, PREVIEW_MAX_LENGTH)}...`;
  }

  function extractList(result) {
    if (Array.isArray(result)) {
      return result;
    }
    if (!result || typeof result !== 'object') {
      return [];
    }

    const directCandidates = ['list', 'records', 'items', 'rows', 'content', 'data'];
    for (const key of directCandidates) {
      if (Array.isArray(result[key])) {
        return result[key];
      }
    }

    const nestedCandidates = ['data', 'result', 'page'];
    for (const key of nestedCandidates) {
      const nested = result[key];
      if (!nested || typeof nested !== 'object') {
        continue;
      }
      for (const subKey of directCandidates) {
        if (Array.isArray(nested[subKey])) {
          return nested[subKey];
        }
      }
    }

    return [];
  }

  function ensureEmptyStateNode() {
    if (emptyState) {
      return emptyState;
    }
    if (!essaysList) {
      return null;
    }
    const node = document.createElement('div');
    node.id = 'empty-state';
    node.className = 'empty-state';
    node.hidden = true;
    essaysList.insertAdjacentElement('afterend', node);
    emptyState = node;
    return emptyState;
  }

  function normalizeCategory(value) {
    return normalizeText(value).toLowerCase().replace(/\s+/g, '');
  }

  function isEssayCategory(value) {
    if (!value) {
      return false;
    }
    return ESSAY_CATEGORY_ALIASES.has(normalizeCategory(value));
  }

  function resolvePublishTime(essay) {
    if (!essay || typeof essay !== 'object') {
      return '';
    }
    return essay.publishedAt || essay.updatedAt || essay.createdAt || '';
  }

  function buildEssayPreview(item) {
    return createPreviewText((item && item.excerpt) || (item && item.summary) || (item && item.content));
  }

  function buildArticlePreview(item) {
    return createPreviewText((item && item.summary) || (item && item.content));
  }

  function normalizeEssayList(result) {
    const list = extractList(result);
    return list
      .map((item) => {
        const id = Number(item && item.id);
        if (!Number.isFinite(id) || id <= 0) {
          return null;
        }
        return {
          id,
          title: normalizeText(item && item.title),
          preview: buildEssayPreview(item),
          coverImage: normalizeText(item && item.coverImage),
          location: normalizeText(item && item.location),
          publishedAt:
            (item && item.publishedAt) || (item && item.updatedAt) || (item && item.createdAt) || '',
          sourceType: SOURCE_ESSAY,
          hidden: Boolean(item && item.hidden),
        };
      })
      .filter(Boolean);
  }

  function normalizeArticleEssayList(result) {
    const list = extractList(result);
    return list
      .map((item) => {
        const id = Number(item && item.id);
        if (!Number.isFinite(id) || id <= 0) {
          return null;
        }
        const category = normalizeText(item && item.category);
        if (!isEssayCategory(category)) {
          return null;
        }
        return {
          id,
          title: normalizeText(item && item.title),
          preview: buildArticlePreview(item),
          coverImage: normalizeText(item && item.coverImage),
          location: normalizeText(item && item.location),
          publishedAt: (item && item.createdAt) || (item && item.updatedAt) || '',
          sourceType: SOURCE_ARTICLE,
        };
      })
      .filter(Boolean);
  }

  async function fetchMyEssaysFromEssayApi() {
    const result = await api.get('/essays/mine', { auth: true });
    return normalizeEssayList(result);
  }

  async function fetchMyEssaysFromArticleApi() {
    const params = new URLSearchParams();
    params.set('authorName', ADMIN_USERNAME);
    params.set('category', ESSAY_CATEGORY);
    params.set('status', 'all');
    const result = await api.get(`/articles?${params.toString()}`, { auth: true });
    return normalizeArticleEssayList(result);
  }

  function formatDateTime(dateStr) {
    if (!dateStr) {
      return '--';
    }
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      return '--';
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  }

  function showToast(message, type) {
    if (!toastContainer) {
      return;
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'error' : 'success'}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function isAdmin(profile) {
    const name = normalizeText(profile && profile.name).toLowerCase();
    return name === ADMIN_USERNAME;
  }

  function isAuthed() {
    return Boolean(session && typeof session.isAuthed === 'function' && session.isAuthed());
  }

  function getProfile() {
    return session && typeof session.getProfile === 'function' ? session.getProfile() : null;
  }

  function isAuthError(error) {
    const status = Number(error && error.status);
    if (status === 401 || status === 403) {
      return true;
    }
    const message = normalizeText(error && error.message).toLowerCase();
    return (
      message.includes('authorization token is required') ||
      message.includes('token is invalid') ||
      message.includes('expired')
    );
  }

  function renderEmptyState() {
    const node = ensureEmptyStateNode();
    if (!node) {
      return;
    }
    node.innerHTML = `
      <div class="empty-state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M14 4h6v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          <path d="m20 4-9.5 9.5a2 2 0 0 1-1 .54l-3.18.72.72-3.18a2 2 0 0 1 .54-1L17 1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M12 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <h3>${TEXT.emptyTitle}</h3>
      <p>${TEXT.emptyDesc}</p>
      <a class="empty-state-action" href="./essay-edit.html">${TEXT.emptyAction}</a>
    `;
  }

  function showLoading() {
    const node = emptyState;
    if (loadingState) {
      loadingState.hidden = false;
    }
    if (node) {
      node.hidden = true;
    }
    if (essaysList) {
      essaysList.innerHTML = '';
      if (loadingState) {
        essaysList.appendChild(loadingState);
      }
    }
  }

  function hideLoading() {
    if (loadingState) {
      loadingState.hidden = true;
    }
  }

  function showEmpty() {
    hideLoading();
    renderEmptyState();
    const node = ensureEmptyStateNode();
    if (node) {
      node.hidden = false;
    }
    if (essaysList) {
      essaysList.innerHTML = '';
    }
  }

  function sortEssaysByPublishTime(list) {
    return [...list].sort((a, b) => {
      const aTime = new Date(resolvePublishTime(a) || 0).getTime();
      const bTime = new Date(resolvePublishTime(b) || 0).getTime();
      return bTime - aTime;
    });
  }

  function renderActions(safeId, sourceType, editHref) {
    return `
      <div class="my-essay-actions">
        <a class="action-btn edit" href="${editHref}">
          <svg viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          ${TEXT.editLabel}
        </a>
        <button type="button" class="action-btn delete" data-delete-id="${safeId}" data-delete-type="${sourceType}">
          <svg viewBox="0 0 24 24" fill="none"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          ${TEXT.deleteLabel}
        </button>
      </div>
    `;
  }

  function renderEssays(list) {
    hideLoading();
    if (!essaysList) {
      return;
    }

    if (!Array.isArray(list) || list.length === 0) {
      showEmpty();
      return;
    }

    const node = emptyState;
    if (node) {
      node.hidden = true;
    }

    const ordered = sortEssaysByPublishTime(list);
    essaysList.innerHTML = ordered
      .map((essay) => {
        const id = Number(essay && essay.id);
        const safeId = Number.isFinite(id) && id > 0 ? id : '';
        const title = normalizeText(essay && essay.title) || TEXT.untitled;
        const preview = normalizeText(essay && essay.preview) || TEXT.previewFallback;
        const coverImage = normalizeText(essay && essay.coverImage);
        const location = normalizeText(essay && essay.location) || TEXT.locationUnknown;
        const publishedAt = formatDateTime(resolvePublishTime(essay));
        const sourceType = normalizeSourceType(essay && essay.sourceType);
        const isHidden = Boolean(essay && essay.hidden);
        const detailHref = sourceType === SOURCE_ARTICLE ? `./article-detail.html?id=${safeId}` : `./essay-detail.html?id=${safeId}`;
        const editHref = sourceType === SOURCE_ARTICLE ? `./article-edit.html?id=${safeId}` : `./essay-edit.html?id=${safeId}`;
        const actions = renderActions(safeId, sourceType, editHref);
        const hiddenBadge = isHidden ? '<span class="hidden-badge">已隐藏</span>' : '';
        const coverMarkup = coverImage
          ? `
                <div class="my-essay-cover-wrap">
                  <img class="my-essay-cover" src="${escapeHtml(coverImage)}" alt="${escapeHtml(title)} cover" />
                  <span class="my-essay-location">${escapeHtml(location)}</span>
                  ${hiddenBadge}
                </div>
            `
          : `<p class="my-essay-location-inline">${escapeHtml(location)}</p>${hiddenBadge}`;

        return `
          <article
            class="my-essay-card${isHidden ? ' is-hidden' : ''}"
            data-essay-id="${safeId}"
            data-essay-source="${sourceType}"
            data-article-link="${detailHref}"
            role="link"
            tabindex="0"
            aria-label="${escapeHtml(title)}"
          >
            <div class="essay-flip-inner">
              <div class="essay-face essay-face-front">
                ${coverMarkup}
                <h3 class="my-essay-title">${escapeHtml(title)}</h3>
                <p class="my-essay-time">${TEXT.publishTime}\uff1a${escapeHtml(publishedAt)}</p>
              </div>
              <div class="essay-face essay-face-back">
                <h4 class="my-essay-back-title">${escapeHtml(title)}</h4>
                <p class="my-essay-back-location">定位：${escapeHtml(location)}</p>
                <p class="my-essay-preview">${escapeHtml(preview)}</p>
                ${actions}
              </div>
            </div>
          </article>
        `;
      })
      .join('');
  }

  async function loadEssays() {
    if (!api) {
      showEmpty();
      return;
    }

    showLoading();
    let primaryError = null;
    try {
      const directEssays = await fetchMyEssaysFromEssayApi();
      if (directEssays.length > 0) {
        renderEssays(directEssays);
        return;
      }
    } catch (error) {
      primaryError = error;
      console.warn('Failed to load from /essays/mine, trying article fallback:', error);
    }

    try {
      const fallbackEssays = await fetchMyEssaysFromArticleApi();
      renderEssays(fallbackEssays);
    } catch (error) {
      console.error('Failed to load essays:', error);
      if (isAuthError(error) || isAuthError(primaryError)) {
        window.location.href = './auth.html?tab=login';
        return;
      }
      showToast(TEXT.loadingFailed, 'error');
      showEmpty();
    }
  }

  function openDeleteDialog(essayId, sourceType) {
    if (!deleteDialog) {
      return;
    }
    pendingDeleteTarget = {
      id: essayId,
      sourceType: normalizeSourceType(sourceType),
    };
    deleteDialog.hidden = false;
  }

  function closeDeleteDialog() {
    if (!deleteDialog) {
      return;
    }
    pendingDeleteTarget = null;
    deleteDialog.hidden = true;
  }

  async function deleteEssay() {
    if (!pendingDeleteTarget || !pendingDeleteTarget.id || !api) {
      closeDeleteDialog();
      return;
    }
    if (!dialogConfirm) {
      return;
    }

    dialogConfirm.disabled = true;
    dialogConfirm.textContent = TEXT.deleting;
    try {
      if (pendingDeleteTarget.sourceType === SOURCE_ARTICLE) {
        await api.post(
          '/articles/batch/delete',
          { ids: [pendingDeleteTarget.id] },
          { auth: true }
        );
      } else {
        await api.request(`/essays/${pendingDeleteTarget.id}`, { method: 'DELETE', auth: true });
      }
      showToast(TEXT.deleteSuccess, 'success');
      closeDeleteDialog();
      await loadEssays();
    } catch (error) {
      console.error('Failed to delete essay:', error);
      showToast(TEXT.deleteFailed, 'error');
    } finally {
      dialogConfirm.disabled = false;
      dialogConfirm.textContent = TEXT.deleteLabel;
    }
  }

  function handleDeleteClick(event) {
    const target = event.target.closest('.action-btn.delete');
    if (!target) {
      return;
    }
    const essayId = Number(target.dataset.deleteId);
    if (!Number.isFinite(essayId) || essayId <= 0) {
      return;
    }
    const sourceType = normalizeSourceType(target.dataset.deleteType);
    openDeleteDialog(essayId, sourceType);
  }

  function handleCardNavigate(event) {
    const card = event.target.closest('.my-essay-card');
    if (!card) {
      return;
    }
    if (event.target.closest('a, button, input, textarea, select, label, summary')) {
      return;
    }
    const href = normalizeText(card.dataset.articleLink);
    if (!href) {
      return;
    }
    window.location.href = href;
  }

  function handleCardKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    const card = event.target.closest('.my-essay-card');
    if (!card) {
      return;
    }
    if (event.target.closest('a, button, input, textarea, select, label, summary')) {
      return;
    }
    const href = normalizeText(card.dataset.articleLink);
    if (!href) {
      return;
    }
    event.preventDefault();
    window.location.href = href;
  }

  function handleDialogOverlayClick(event) {
    if (event.target.classList.contains('dialog-overlay')) {
      closeDeleteDialog();
    }
  }

  async function checkAccess() {
    if (!isAuthed()) {
      window.location.href = './auth.html?tab=login';
      return false;
    }

    if (session && typeof session.refreshProfileFromServer === 'function') {
      try {
        await session.refreshProfileFromServer();
      } catch {
        // Keep cached profile when network is unstable.
      }
    }

    if (!isAuthed()) {
      window.location.href = './auth.html?tab=login';
      return false;
    }

    const profile = getProfile();
    if (!isAdmin(profile)) {
      showToast(TEXT.accessDenied, 'error');
      window.location.href = './index.html';
      return false;
    }
    return true;
  }

  async function init() {
    if (!essaysList) {
      return;
    }

    const canAccess = await checkAccess();
    if (!canAccess) {
      return;
    }

    essaysList.addEventListener('click', handleDeleteClick);
    essaysList.addEventListener('click', handleCardNavigate);
    essaysList.addEventListener('keydown', handleCardKeydown);

    if (dialogCancel) {
      dialogCancel.addEventListener('click', closeDeleteDialog);
    }
    if (dialogConfirm) {
      dialogConfirm.addEventListener('click', deleteEssay);
    }
    if (deleteDialog) {
      deleteDialog.addEventListener('click', handleDialogOverlayClick);
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && deleteDialog && !deleteDialog.hidden) {
        closeDeleteDialog();
      }
    });

    loadEssays();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
