(function () {
  const api = window.TechVibeApi || null;
  const sessionApi = window.TechVibeSession || null;

  const categoryMenu = document.getElementById('category-menu');
  const articleGrid = document.getElementById('article-grid');
  const pagination = document.getElementById('pagination');
  const categoryTitle = document.getElementById('category-title');
  const categoryCount = document.getElementById('category-count');
  const categorySearchInput = document.getElementById('category-search');
  const articleSearchInput = document.getElementById('article-search');
  const sortSelect = document.getElementById('article-sort');
  const statusSelect = document.getElementById('article-status');
  const createCategoryButton = document.getElementById('create-category-btn');
  const batchToggleButton = document.getElementById('batch-toggle-btn');
  const batchDeleteButton = document.getElementById('batch-delete-btn');
  const batchMoveButton = document.getElementById('batch-move-btn');
  const batchStatus = document.getElementById('batch-status');
  const toastRoot = document.getElementById('theme-toast');
  const dialogRoot = document.getElementById('theme-dialog');
  const dialogTitle = document.getElementById('theme-dialog-title');
  const dialogMessage = document.getElementById('theme-dialog-message');
  const dialogInputWrap = document.getElementById('theme-dialog-input-wrap');
  const dialogInput = document.getElementById('theme-dialog-input');
  const dialogError = document.getElementById('theme-dialog-error');
  const dialogCancel = document.getElementById('theme-dialog-cancel');
  const dialogConfirm = document.getElementById('theme-dialog-confirm');

  if (
    !api ||
    !categoryMenu ||
    !articleGrid ||
    !pagination ||
    !categoryTitle ||
    !categoryCount ||
    !categorySearchInput ||
    !articleSearchInput ||
    !sortSelect ||
    !statusSelect
  ) {
    return;
  }

  const ADMIN_USERNAME = 'admin';
  const ALL_CATEGORY_NAME = '全部文章';
  const DEFAULT_CATEGORY_NAME = '未分类';
  const DEFAULT_COVER =
    'https://images.unsplash.com/photo-1518773553398-650c184e0bb3?auto=format&fit=crop&w=900&q=80';
  const PAGE_SIZE = 6;

  let categoryList = [];
  let articleList = [];
  let selectedCategory = ALL_CATEGORY_NAME;
  let currentPage = 1;
  let latestCategoryRequestId = 0;
  let latestArticleRequestId = 0;
  let toastTimer = 0;
  const cachedProfile = sessionApi && typeof sessionApi.getProfile === 'function' ? sessionApi.getProfile() : null;
  let adminDisplayName =
    cachedProfile && normalizeLowerText(cachedProfile.name) === ADMIN_USERNAME
      ? normalizeText(cachedProfile.nickname || cachedProfile.name)
      : '';

  function normalizeText(value) {
    return String(value || '').trim();
  }

  function normalizeLowerText(value) {
    return normalizeText(value).toLowerCase();
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function normalizeCategoryName(value) {
    const category = normalizeText(value);
    return category || '未分类';
  }

  function getAuthorDisplayName(authorName) {
    const username = normalizeText(authorName);
    if (!username) {
      return '匿名作者';
    }
    if (normalizeLowerText(username) === ADMIN_USERNAME && adminDisplayName) {
      return adminDisplayName;
    }
    return username;
  }

  function normalizeCategories(list) {
    if (!Array.isArray(list)) {
      return [];
    }
    return list
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        id: Number(item.id) || null,
        name: normalizeCategoryName(item.name),
        articleCount: Number(item.articleCount || 0),
      }));
  }

  function normalizeArticles(list) {
    if (!Array.isArray(list)) {
      return [];
    }
    return list.filter((item) => item && typeof item === 'object');
  }

  function formatDate(value) {
    if (!value) {
      return '--';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function getTagClass(category) {
    const text = normalizeLowerText(category);
    if (text.includes('web') || text.includes('front')) {
      return 'tag-blue';
    }
    if (text.includes('java') || text.includes('server') || text.includes('back')) {
      return 'tag-green';
    }
    if (text.includes('ai')) {
      return 'tag-purple';
    }
    if (text.includes('python') || text.includes('data')) {
      return 'tag-orange';
    }
    if (text.includes('devops') || text.includes('docker')) {
      return 'tag-red';
    }
    return 'tag-blue';
  }

  function isAuthed() {
    return Boolean(sessionApi && typeof sessionApi.isAuthed === 'function' && sessionApi.isAuthed());
  }

  function isAdmin() {
    if (!sessionApi || typeof sessionApi.getProfile !== 'function') {
      return false;
    }
    const profile = sessionApi.getProfile();
    return normalizeLowerText(profile && profile.name) === ADMIN_USERNAME;
  }

  function isDefaultCategoryName(name) {
    return normalizeLowerText(name) === normalizeLowerText(DEFAULT_CATEGORY_NAME);
  }

  function canDeleteCategory(category) {
    const id = Number(category && category.id);
    if (!isAdmin() || !Number.isFinite(id) || id <= 0) {
      return false;
    }
    return !isDefaultCategoryName(category && category.name);
  }

  function requestOptions() {
    return isAuthed() ? { auth: true } : undefined;
  }

  function openThemedInputDialog(options) {
    const opts = options || {};
    const fallbackText = normalizeText(opts.message) || normalizeText(opts.title) || 'Please enter content.';
    const hasDialog =
      dialogRoot && dialogTitle && dialogMessage && dialogInputWrap && dialogInput && dialogError && dialogCancel && dialogConfirm;

    if (!hasDialog) {
      const raw = window.prompt(fallbackText);
      return Promise.resolve(raw == null ? null : normalizeText(raw));
    }

    return new Promise((resolve) => {
      let settled = false;
      const validate = typeof opts.validate === 'function' ? opts.validate : null;

      const showError = (message) => {
        const text = normalizeText(message);
        dialogError.textContent = text;
        dialogError.hidden = !text;
      };

      const cleanup = () => {
        dialogCancel.removeEventListener('click', handleCancel);
        dialogConfirm.removeEventListener('click', handleConfirm);
        dialogRoot.removeEventListener('click', handleRootClick);
        dialogInput.removeEventListener('keydown', handleKeyDown);
      };

      const closeWith = (value) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        dialogRoot.hidden = true;
        resolve(value);
      };

      const handleCancel = () => closeWith(null);

      const handleRootClick = (event) => {
        const target = event.target;
        if (target instanceof Element && target.closest('[data-role="dialog-close"]')) {
          closeWith(null);
        }
      };

      const handleConfirm = () => {
        const value = normalizeText(dialogInput.value);
        const message = validate ? normalizeText(validate(value)) : '';
        if (message) {
          showError(message);
          dialogInput.focus();
          return;
        }
        closeWith(value);
      };

      const handleKeyDown = (event) => {
        if (event.isComposing) {
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          closeWith(null);
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          handleConfirm();
        }
      };

      dialogTitle.textContent = normalizeText(opts.title) || 'Prompt';
      dialogMessage.textContent = normalizeText(opts.message) || '';
      dialogInputWrap.hidden = false;
      dialogInput.value = normalizeText(opts.defaultValue);
      dialogInput.placeholder = normalizeText(opts.placeholder);
      dialogCancel.textContent = normalizeText(opts.cancelText) || 'Cancel';
      dialogConfirm.textContent = normalizeText(opts.confirmText) || 'Confirm';
      dialogConfirm.classList.remove('theme-dialog-confirm-danger');
      showError('');

      dialogCancel.addEventListener('click', handleCancel);
      dialogConfirm.addEventListener('click', handleConfirm);
      dialogRoot.addEventListener('click', handleRootClick);
      dialogInput.addEventListener('keydown', handleKeyDown);
      dialogRoot.hidden = false;

      window.requestAnimationFrame(() => {
        dialogInput.focus();
        dialogInput.select();
      });
    });
  }

  function showToast(message, type) {
    const text = normalizeText(message);
    if (!toastRoot) {
      if (text) {
        // eslint-disable-next-line no-alert
        window.alert(text);
      }
      return;
    }

    toastRoot.textContent = text || 'Done';
    toastRoot.hidden = false;
    toastRoot.classList.remove('success', 'error');
    if (type === 'success' || type === 'error') {
      toastRoot.classList.add(type);
    }

    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toastRoot.hidden = true;
    }, 2200);
  }

  function syncRoleUi() {
    const admin = isAdmin();

    if (createCategoryButton) {
      createCategoryButton.classList.toggle('is-hidden', !admin);
    }

    if (batchToggleButton) {
      batchToggleButton.classList.add('is-hidden');
    }
    if (batchDeleteButton) {
      batchDeleteButton.classList.add('is-hidden');
    }
    if (batchMoveButton) {
      batchMoveButton.classList.add('is-hidden');
    }
    if (batchStatus) {
      batchStatus.hidden = true;
    }

    if (!admin && statusSelect) {
      statusSelect.value = 'published';
    }
  }

  function buildPath(path, params) {
    const searchParams = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      const normalized = normalizeText(value);
      if (!normalized) {
        return;
      }
      searchParams.set(key, normalized);
    });
    const query = searchParams.toString();
    return query ? `${path}?${query}` : path;
  }

  function buildCategorySummariesFromArticles(list, keyword) {
    const keywordLower = normalizeLowerText(keyword);
    const map = new Map();

    normalizeArticles(list).forEach((article) => {
      const categoryName = normalizeCategoryName(article.category);
      if (keywordLower && !normalizeLowerText(categoryName).includes(keywordLower)) {
        return;
      }
      map.set(categoryName, (map.get(categoryName) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([name, articleCount]) => ({ id: null, name, articleCount }))
      .sort((a, b) => b.articleCount - a.articleCount || a.name.localeCompare(b.name));
  }

  function renderCategoryMenu() {
    syncRoleUi();

    const totalCount = categoryList.reduce((sum, item) => sum + Number(item.articleCount || 0), 0);
    const menuItems = [{ id: 'all', name: ALL_CATEGORY_NAME, articleCount: totalCount }, ...categoryList];
    const addButton = isAdmin() ? '<button class="add-category" type="button">+ 新建分类</button>' : '';

    categoryMenu.innerHTML =
      menuItems
        .map((item) => {
          const active = item.name === selectedCategory ? 'active' : '';
          const deleteButton = canDeleteCategory(item)
            ? `<button
                class="category-delete"
                type="button"
                data-category-id="${Number(item.id)}"
                data-category-name="${escapeHtml(item.name)}"
                aria-label="删除分类 ${escapeHtml(item.name)}"
              >−</button>`
            : '';
          return `
            <div class="category-row">
              <button class="category-item ${active}" type="button" data-category="${escapeHtml(item.name)}">
                <strong>${escapeHtml(item.name)}</strong>
                <small>${Number(item.articleCount || 0)} 篇文章</small>
              </button>
              ${deleteButton}
            </div>
          `;
        })
        .join('') + addButton;
  }

  function renderLoadingState(message) {
    articleGrid.innerHTML = `
      <article class="article-card">
        <div class="card-body">
          <h3>${escapeHtml(message)}</h3>
        </div>
      </article>
    `;
    pagination.innerHTML = '';
  }

  function renderPagination(totalPages) {
    if (totalPages <= 1) {
      pagination.innerHTML = '';
      return;
    }

    const buttons = [];
    buttons.push(
      `<button type="button" data-page="${Math.max(1, currentPage - 1)}" ${
        currentPage === 1 ? 'disabled' : ''
      }>&lt;</button>`
    );

    const maxPages = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxPages - 1);
    start = Math.max(1, end - maxPages + 1);

    for (let page = start; page <= end; page += 1) {
      buttons.push(`<button type="button" data-page="${page}" class="${page === currentPage ? 'active' : ''}">${page}</button>`);
    }

    buttons.push(
      `<button type="button" data-page="${Math.min(totalPages, currentPage + 1)}" ${
        currentPage === totalPages ? 'disabled' : ''
      }>&gt;</button>`
    );

    pagination.innerHTML = buttons.join('');
  }

  function renderArticleGrid() {
    const total = articleList.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > totalPages) {
      currentPage = totalPages;
    }

    categoryTitle.textContent = selectedCategory;
    categoryCount.textContent = `共 ${total} 篇文章`;

    if (!articleList.length) {
      articleGrid.innerHTML = `
        <article class="article-card">
          <div class="card-body">
            <h3>暂无文章</h3>
            <p>当前筛选条件下没有找到匹配内容。</p>
          </div>
        </article>
      `;
      renderPagination(totalPages);
      return;
    }

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = articleList.slice(start, start + PAGE_SIZE);

    articleGrid.innerHTML = pageItems
      .map((article, index) => {
        const id = Number(article && article.id) > 0 ? Number(article.id) : start + index + 1;
        const title = normalizeText(article.title) || '未命名文章';
        const summary = normalizeText(article.summary) || '暂无摘要';
        const authorName = getAuthorDisplayName(article.authorName);
        const category = normalizeCategoryName(article.category);
        const cover = normalizeText(article.coverImage) || DEFAULT_COVER;
        const dateText = formatDate(article.createdAt);
        const tagClass = getTagClass(category);
        const status = normalizeLowerText(article.status);
        const isDraft = status === 'draft';
        const statusBadge = isDraft ? '<span class="status-badge draft">草稿</span>' : '';
        const articleLink = isDraft ? `./article-edit.html?id=${id}` : `./article-detail.html?id=${id}`;

        return `
          <article class="article-card ${isDraft ? 'is-draft' : ''}" data-article-link="${articleLink}" data-article-id="${id}">
            ${statusBadge}
            <span class="tag ${tagClass}">${escapeHtml(category)}</span>
            <img src="${escapeHtml(cover)}" alt="${escapeHtml(title)} 封面图片" />
            <div class="card-body">
              <h3>${escapeHtml(title)}</h3>
              <p>${escapeHtml(summary)}</p>
              <div class="card-meta">
                <span>${escapeHtml(authorName)}</span>
                <time datetime="${escapeHtml(dateText)}">${escapeHtml(dateText)}</time>
              </div>
            </div>
          </article>
        `;
      })
      .join('');

    if (window.TechVibeArticleNav && typeof window.TechVibeArticleNav.refresh === 'function') {
      window.TechVibeArticleNav.refresh(articleGrid);
    }

    renderPagination(totalPages);
  }

  async function loadCategories() {
    const requestId = ++latestCategoryRequestId;
    const keyword = normalizeText(categorySearchInput.value);
    let nextList = [];

    try {
      const path = buildPath('/categories', { keyword });
      const data = await api.get(path, requestOptions());
      nextList = normalizeCategories(data);
    } catch {
      // Fallback to article aggregation when category API/table is unavailable.
      const fallbackPath = buildPath('/articles', {
        sort: 'latest',
        status: isAdmin() ? normalizeText(statusSelect.value) || 'all' : 'published',
      });
      const fallbackArticles = await api.get(fallbackPath, requestOptions());
      nextList = buildCategorySummariesFromArticles(fallbackArticles, keyword);
    }

    if (requestId !== latestCategoryRequestId) {
      return;
    }

    categoryList = nextList;
    const searching = Boolean(keyword);
    if (!searching && selectedCategory !== ALL_CATEGORY_NAME && !categoryList.some((item) => item.name === selectedCategory)) {
      selectedCategory = ALL_CATEGORY_NAME;
    }

    renderCategoryMenu();
  }

  async function loadArticles() {
    const requestId = ++latestArticleRequestId;
    renderLoadingState('文章加载中...');

    const keyword = normalizeText(articleSearchInput.value);
    const sort = normalizeText(sortSelect.value) || 'latest';
    const status = isAdmin() ? normalizeText(statusSelect.value) || 'all' : 'published';
    const category = selectedCategory === ALL_CATEGORY_NAME ? '' : selectedCategory;

    const path = buildPath('/articles', { category, keyword, sort, status });
    const data = await api.get(path, requestOptions());

    if (requestId !== latestArticleRequestId) {
      return;
    }

    articleList = normalizeArticles(data);
    renderArticleGrid();
  }

  async function loadAdminDisplayName() {
    try {
      const profile = await api.get(`/authors/${ADMIN_USERNAME}`, requestOptions());
      const nickname = normalizeText(profile && (profile.nickname || profile.name || ''));
      if (!nickname) {
        return;
      }
      const changed = adminDisplayName !== nickname;
      adminDisplayName = nickname;
      if (changed && articleList.length) {
        renderArticleGrid();
      }
    } catch {
      // Keep username display when admin profile is unavailable.
    }
  }

  async function refreshAllData() {
    try {
      await loadCategories();
    } catch (error) {
      renderCategoryMenu();
    }

    try {
      await loadArticles();
    } catch (error) {
      const message = error && error.message ? error.message : '文章加载失败，请稍后重试。';
      renderLoadingState(message);
      categoryCount.textContent = '共 0 篇文章';
    }
  }

  function ensureAdminAction() {
    if (!isAuthed()) {
      showToast('请先登录 admin 账号。', 'error');
      return false;
    }
    if (!isAdmin()) {
      showToast('仅 admin 可以执行该操作。', 'error');
      return false;
    }
    return true;
  }

  async function createCategory() {
    if (!ensureAdminAction()) {
      return;
    }

    const raw = await openThemedInputDialog({
      title: '新建分类',
      message: '请输入分类名称。',
      placeholder: '例如：前端工程',
      confirmText: '创建',
      cancelText: '取消',
      validate(value) {
        if (!value) {
          return '分类名称不能为空。';
        }
        if (value.length > 64) {
          return '分类名称长度不能超过 64 个字符。';
        }
        return '';
      },
    });
    if (raw == null) {
      return;
    }

    const categoryName = normalizeText(raw);
    if (!categoryName) {
      showToast('分类名称不能为空。', 'error');
      return;
    }

    try {
      const created = await api.post('/categories', { name: categoryName }, { auth: true });
      const createdCategoryName = normalizeCategoryName((created && created.name) || categoryName);
      const createdCategory = {
        id: Number(created && created.id) || null,
        name: createdCategoryName,
        articleCount: Number(created && created.articleCount) || 0,
      };

      selectedCategory = createdCategoryName;
      currentPage = 1;
      categorySearchInput.value = '';

      if (!categoryList.some((item) => normalizeLowerText(item.name) === normalizeLowerText(createdCategoryName))) {
        categoryList = [createdCategory, ...categoryList];
      }
      renderCategoryMenu();

      try {
        await loadCategories();
        if (!categoryList.some((item) => normalizeLowerText(item.name) === normalizeLowerText(createdCategoryName))) {
          categoryList = [createdCategory, ...categoryList];
          renderCategoryMenu();
        }
      } catch {
        // Keep local category state if category reload fails.
      }

      await loadArticles();
      showToast(`分类"${createdCategoryName}"已创建。`, 'success');
    } catch (error) {
      showToast(error && error.message ? error.message : '创建分类失败。', 'error');
    }
  }

  async function deleteCategory(categoryId, categoryName) {
    if (!ensureAdminAction()) {
      return;
    }

    const id = Number(categoryId);
    const normalizedName = normalizeCategoryName(categoryName);
    if (!Number.isFinite(id) || id <= 0) {
      showToast('无法删除此分类。', 'error');
      return;
    }
    if (isDefaultCategoryName(normalizedName)) {
      showToast('默认分类不能删除。', 'error');
      return;
    }

    const confirmed = window.confirm(
      `确定删除分类"${normalizedName}"吗？该分类下的文章将移动到"${DEFAULT_CATEGORY_NAME}"。`
    );
    if (!confirmed) {
      return;
    }

    try {
      const result = await api.request(`/categories/${id}`, { method: 'DELETE', auth: true });
      const movedArticleCount = Number(result && result.movedArticleCount) || 0;
      const targetCategoryName = normalizeCategoryName((result && result.targetCategoryName) || DEFAULT_CATEGORY_NAME);

      if (selectedCategory === normalizedName) {
        selectedCategory = ALL_CATEGORY_NAME;
        currentPage = 1;
      }

      categoryList = categoryList.filter((item) => Number(item.id) !== id);
      renderCategoryMenu();

      await refreshAllData();
      showToast(`已删除"${normalizedName}"。${movedArticleCount} 篇文章已移动到"${targetCategoryName}"。`, 'success');
    } catch (error) {
      showToast(error && error.message ? error.message : '删除分类失败。', 'error');
    }
  }

  function debounce(fn, wait) {
    let timer = 0;
    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fn(...args), wait);
    };
  }

  function bindEvents() {
    categoryMenu.addEventListener('click', async (event) => {
      const deleteButton = event.target.closest('.category-delete');
      if (deleteButton) {
        event.preventDefault();
        event.stopPropagation();
        const categoryId = Number(deleteButton.dataset.categoryId || 0);
        const categoryName = normalizeText(deleteButton.dataset.categoryName);
        await deleteCategory(categoryId, categoryName);
        return;
      }

      const categoryButton = event.target.closest('.category-item');
      if (categoryButton) {
        const categoryName = normalizeText(categoryButton.dataset.category);
        if (!categoryName || categoryName === selectedCategory) {
          return;
        }
        selectedCategory = categoryName;
        currentPage = 1;
        renderCategoryMenu();
        await loadArticles();
        return;
      }

      const addCategoryButton = event.target.closest('.add-category');
      if (addCategoryButton) {
        await createCategory();
      }
    });

    if (createCategoryButton) {
      createCategoryButton.addEventListener('click', createCategory);
    }

    categorySearchInput.addEventListener(
      'input',
      debounce(async () => {
        await loadCategories();
      }, 250)
    );

    articleSearchInput.addEventListener(
      'input',
      debounce(async () => {
        currentPage = 1;
        await loadArticles();
      }, 250)
    );

    sortSelect.addEventListener('change', async () => {
      currentPage = 1;
      await loadArticles();
    });

    statusSelect.addEventListener('change', async () => {
      currentPage = 1;
      await loadArticles();
    });

    pagination.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-page]');
      if (!button || button.disabled) {
        return;
      }
      const page = Number(button.dataset.page || 1);
      if (!Number.isFinite(page) || page < 1 || page === currentPage) {
        return;
      }
      currentPage = page;
      renderArticleGrid();
    });
  }

  (async () => {
    if (sessionApi && typeof sessionApi.refreshProfileFromServer === 'function') {
      try {
        await sessionApi.refreshProfileFromServer();
      } catch {
        // Ignore profile refresh failures.
      }
    }

    syncRoleUi();
    bindEvents();
    await Promise.all([refreshAllData(), loadAdminDisplayName()]);
  })();
})();
