(function () {
  const api = window.TechVibeApi || null;
  const session = window.TechVibeSession || null;

  const ADMIN_USERNAME = 'admin';
  const DEFAULT_COVER =
    'https://images.unsplash.com/photo-1518773553398-650c184e0bb3?auto=format&fit=crop&w=320&q=80';

  const articlesList = document.getElementById('articles-list');
  const loadingState = document.getElementById('loading-state');
  let emptyState = document.getElementById('empty-state');
  const toastContainer = document.getElementById('toast-container');
  const deleteDialog = document.getElementById('delete-confirm-dialog');
  const dialogCancel = document.getElementById('dialog-cancel');
  const dialogConfirm = document.getElementById('dialog-confirm');

  const TEXT = {
    emptyTitle: '\u6682\u65e0\u6587\u7ae0',
    emptyDesc: '\u70b9\u51fb\u5f00\u59cb\u521b\u4f5c\uff0c\u5c31\u53ef\u4ee5\u65b0\u5efa\u7b2c\u4e00\u7bc7\u6587\u7ae0\u3002',
    emptyAction: '\u5f00\u59cb\u521b\u4f5c',
    untitled: '\u672a\u547d\u540d\u6587\u7ae0',
    statusDraft: '\u8349\u7a3f',
    statusPublished: '\u5df2\u53d1\u5e03',
    loadingFailed: '\u52a0\u8f7d\u6587\u7ae0\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002',
    deleting: '\u5220\u9664\u4e2d...',
    deleteSuccess: '\u6587\u7ae0\u5df2\u5220\u9664\u3002',
    deleteFailed: '\u5220\u9664\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002',
    deleteLabel: '\u5220\u9664',
    editLabel: '\u7f16\u8f91',
    accessDenied: '\u4ec5\u7ba1\u7406\u5458\u53ef\u8bbf\u95ee\u6b64\u9875\u9762\u3002',
  };

  let currentStatus = 'all';
  let pendingDeleteId = null;

  function normalizeText(value) {
    return String(value == null ? '' : value).trim();
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
    if (!articlesList) {
      return null;
    }
    const node = document.createElement('div');
    node.id = 'empty-state';
    node.className = 'empty-state';
    node.hidden = true;
    articlesList.insertAdjacentElement('afterend', node);
    emptyState = node;
    return emptyState;
  }

  function formatDate(dateStr) {
    if (!dateStr) {
      return '';
    }
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
      <a class="empty-state-action" href="./article-edit.html">${TEXT.emptyAction}</a>
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
    if (articlesList) {
      articlesList.innerHTML = '';
      if (loadingState) {
        articlesList.appendChild(loadingState);
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
    if (articlesList) {
      articlesList.innerHTML = '';
    }
  }

  function renderArticles(list) {
    hideLoading();

    if (!articlesList) {
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

    articlesList.innerHTML = list
      .map((article) => {
        const id = Number(article && article.id);
        const title = normalizeText(article && article.title) || TEXT.untitled;
        const summary = normalizeText(article && article.summary);
        const cover = normalizeText(article && article.coverImage) || DEFAULT_COVER;
        const status = normalizeText(article && article.status).toLowerCase();
        const category = normalizeText(article && article.category);
        const views = Number(article && article.views) || 0;
        const createdAt = formatDate(article && article.createdAt);

        const isDraft = status === 'draft';
        const statusClass = isDraft ? 'draft' : 'published';
        const statusText = isDraft ? TEXT.statusDraft : TEXT.statusPublished;
        const editHref = Number.isFinite(id) && id > 0 ? `./article-edit.html?id=${id}` : './article-edit.html';
        const detailHref = Number.isFinite(id) && id > 0 ? `./article-detail.html?id=${id}` : '#';

        return `
          <article class="my-article-card" data-article-id="${Number.isFinite(id) ? id : ''}">
            <a class="my-article-card-link" href="${detailHref}" aria-label="查看文章：${escapeHtml(title)}"></a>
            <img class="my-article-cover" src="${escapeHtml(cover)}" alt="${escapeHtml(title)}" />
            <div class="my-article-content">
              <div class="my-article-status ${statusClass}">
                ${
                  isDraft
                    ? '<svg viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
                    : '<svg viewBox="0 0 24 24" fill="none"><path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
                }
                ${statusText}
              </div>
              <h3 class="my-article-title">${escapeHtml(title)}</h3>
              ${summary ? `<p class="my-article-summary">${escapeHtml(summary)}</p>` : ''}
              <div class="my-article-meta">
                ${category ? `<span>${escapeHtml(category)}</span>` : ''}
                <span>
                  <svg viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/></svg>
                  ${views}
                </span>
                ${createdAt ? `<span>${createdAt}</span>` : ''}
              </div>
            </div>
            <div class="my-article-actions">
              <a class="action-btn detail" href="${detailHref}">
                <svg viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/></svg>
                查看
              </a>
              <a class="action-btn edit" href="${editHref}">
                <svg viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                ${TEXT.editLabel}
              </a>
              <button type="button" class="action-btn delete" data-delete-id="${Number.isFinite(id) ? id : ''}">
                <svg viewBox="0 0 24 24" fill="none"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                ${TEXT.deleteLabel}
              </button>
            </div>
          </article>
        `;
      })
      .join('');
  }

  async function loadArticles() {
    if (!api) {
      showEmpty();
      return;
    }

    showLoading();
    try {
      const params = new URLSearchParams();
      params.set('authorName', ADMIN_USERNAME);
      params.set('status', currentStatus === 'all' ? 'all' : currentStatus);

      const result = await api.get(`/articles?${params.toString()}`, { auth: true });
      const list = extractList(result);
      renderArticles(list);
    } catch (error) {
      console.error('Failed to load articles:', error);
      if (isAuthError(error)) {
        window.location.href = './auth.html?tab=login';
        return;
      }
      showToast(TEXT.loadingFailed, 'error');
      showEmpty();
    }
  }

  function openDeleteDialog(articleId) {
    if (!deleteDialog) {
      return;
    }
    pendingDeleteId = articleId;
    deleteDialog.hidden = false;
  }

  function closeDeleteDialog() {
    if (!deleteDialog) {
      return;
    }
    pendingDeleteId = null;
    deleteDialog.hidden = true;
  }

  async function deleteArticle() {
    if (!pendingDeleteId || !api) {
      closeDeleteDialog();
      return;
    }
    if (!dialogConfirm) {
      return;
    }

    dialogConfirm.disabled = true;
    dialogConfirm.textContent = TEXT.deleting;
    try {
      await api.post('/articles/batch/delete', { ids: [pendingDeleteId] }, { auth: true });
      showToast(TEXT.deleteSuccess, 'success');
      closeDeleteDialog();
      await loadArticles();
    } catch (error) {
      console.error('Failed to delete article:', error);
      showToast(TEXT.deleteFailed, 'error');
    } finally {
      dialogConfirm.disabled = false;
      dialogConfirm.textContent = TEXT.deleteLabel;
    }
  }

  function handleFilterClick(event) {
    const target = event.target.closest('.filter-tab');
    if (!target) {
      return;
    }

    const status = normalizeText(target.dataset.status).toLowerCase();
    if (!status || status === currentStatus) {
      return;
    }
    if (status !== 'all' && status !== 'published' && status !== 'draft') {
      return;
    }

    document.querySelectorAll('.filter-tab').forEach((tab) => tab.classList.remove('active'));
    target.classList.add('active');
    currentStatus = status;
    loadArticles();
  }

  function handleDeleteClick(event) {
    const target = event.target.closest('.action-btn.delete');
    if (!target) {
      return;
    }
    const articleId = Number(target.dataset.deleteId);
    if (!Number.isFinite(articleId) || articleId <= 0) {
      return;
    }
    openDeleteDialog(articleId);
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
    if (!articlesList) {
      return;
    }

    if (!(await checkAccess())) {
      return;
    }

    document.querySelectorAll('.filter-tab').forEach((tab) => {
      tab.addEventListener('click', handleFilterClick);
    });

    articlesList.addEventListener('click', handleDeleteClick);

    if (dialogCancel) {
      dialogCancel.addEventListener('click', closeDeleteDialog);
    }
    if (dialogConfirm) {
      dialogConfirm.addEventListener('click', deleteArticle);
    }
    if (deleteDialog) {
      deleteDialog.addEventListener('click', handleDialogOverlayClick);
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && deleteDialog && !deleteDialog.hidden) {
        closeDeleteDialog();
      }
    });

    loadArticles();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
