(function () {
  const api = window.TechVibeApi || null;
  const sessionApi = window.TechVibeSession || null;
  const articleColumn = document.querySelector('.article-column');
  const teamPanel = document.querySelector('.team-panel');

  if (!api || !articleColumn) {
    return;
  }

  const ADMIN_USERNAME = 'admin';
  const DEFAULT_COVER =
    'https://images.unsplash.com/photo-1518773553398-650c184e0bb3?auto=format&fit=crop&w=900&q=80';
  const DEFAULT_AVATAR =
    'https://images.unsplash.com/photo-1528892952291-009c663ce843?auto=format&fit=crop&w=120&q=80';
  const PAGE_SIZE = 3;

  const heading = articleColumn.querySelector('h2');
  const loadWrap = articleColumn.querySelector('.load-wrap');
  const loadButton = loadWrap ? loadWrap.querySelector('.load-more') : null;
  const recentList = document.querySelector('.recent-list');
  const essayList = document.getElementById('latest-essay-list');

  let allArticles = [];
  let allEssays = [];
  let visibleCount = 0;
  const cachedProfile = sessionApi && typeof sessionApi.getProfile === 'function' ? sessionApi.getProfile() : null;
  let adminDisplayName =
    cachedProfile && String(cachedProfile.name || '').trim().toLowerCase() === ADMIN_USERNAME
      ? String(cachedProfile.nickname || cachedProfile.name || '').trim()
      : '';

  function normalizeText(value) {
    return String(value || '').trim();
  }

  function normalizeLowerText(value) {
    return normalizeText(value).toLowerCase();
  }

  function getAuthorDisplayName(authorName) {
    const raw = normalizeText(authorName);
    if (!raw) {
      return 'Anonymous';
    }
    if (normalizeLowerText(raw) === ADMIN_USERNAME && adminDisplayName) {
      return adminDisplayName;
    }
    return raw;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
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

  function formatCount(value) {
    const count = Number(value || 0);
    if (!Number.isFinite(count) || count <= 0) {
      return '0';
    }
    if (count >= 10000) {
      return `${(count / 10000).toFixed(count >= 100000 ? 0 : 1)}w`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return String(Math.floor(count));
  }

  function truncateText(value, maxLength) {
    const text = normalizeText(value);
    if (!text) {
      return '';
    }
    if (text.length <= maxLength) {
      return text;
    }
    return `${text.slice(0, maxLength).trim()}...`;
  }

  function normalizeArticles(list) {
    if (!Array.isArray(list)) {
      return [];
    }
    return list.filter((item) => item && typeof item === 'object');
  }

  function normalizeEssays(list) {
    if (!Array.isArray(list)) {
      return [];
    }
    return list.filter((item) => item && typeof item === 'object');
  }

  function getArticleId(article, index) {
    const id = Number(article && article.id);
    if (Number.isFinite(id) && id > 0) {
      return id;
    }
    return index + 1;
  }

  function getTagClass(category) {
    const text = String(category || '').toLowerCase();
    if (text.includes('python') || text.includes('data')) {
      return 'tag-python';
    }
    if (text.includes('devops') || text.includes('backend') || text.includes('docker') || text.includes('ops')) {
      return 'tag-devops';
    }
    return 'tag-web';
  }

  function ensureCardsContainer() {
    let container = articleColumn.querySelector('.article-list-dynamic');
    if (container) {
      return container;
    }
    container = document.createElement('div');
    container.className = 'article-list-dynamic';
    if (heading) {
      heading.insertAdjacentElement('afterend', container);
    } else {
      articleColumn.prepend(container);
    }
    return container;
  }

  function clearStaticCards() {
    Array.from(articleColumn.children).forEach((node) => {
      if (node.classList && node.classList.contains('article-card')) {
        node.remove();
      }
    });
  }

  function renderState(message) {
    const container = ensureCardsContainer();
    container.innerHTML = `
      <article class="article-card">
        <div class="article-content">
          <p class="summary">${escapeHtml(message)}</p>
        </div>
      </article>
    `;
    if (loadWrap) {
      loadWrap.style.display = 'none';
    }
  }

  function buildCard(article, index) {
    const id = getArticleId(article, index);
    const title = article.title || 'Untitled';
    const summary = article.summary || 'No summary yet.';
    const authorName = article.authorName || 'Anonymous';
    const authorDisplayName = getAuthorDisplayName(authorName);
    const authorAvatar = article.authorAvatarUrl || DEFAULT_AVATAR;
    const category = article.category || 'General';
    const tagClass = getTagClass(category);
    const coverImage = article.coverImage || DEFAULT_COVER;
    const dateText = formatDate(article.createdAt);
    const viewsText = formatCount(article.views);
    const likesText = formatCount(article.likes);

    return `
      <article class="article-card reveal" style="--delay: ${0.05 + index * 0.07}s" data-article-link="./article-detail.html?from=home" data-article-id="${id}">
        <img class="article-cover" src="${escapeHtml(coverImage)}" alt="${escapeHtml(title)} cover" />
        <div class="article-content">
          <p class="tag ${tagClass}">${escapeHtml(category)}</p>
          <h3>${escapeHtml(title)}</h3>
          <p class="summary">${escapeHtml(summary)}</p>
          <div class="meta-row">
            <span class="author">
              <img src="${escapeHtml(authorAvatar)}" alt="${escapeHtml(authorDisplayName)} avatar" />
              ${escapeHtml(authorDisplayName)}
            </span>
            <div class="stats">
              <span>
                <svg viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.8" />
                  <path d="M8 3v4M16 3v4M3 10h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                </svg>
                ${escapeHtml(dateText)}
              </span>
              <span>
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" stroke="currentColor" stroke-width="1.8" />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8" />
                </svg>
                ${escapeHtml(viewsText)}
              </span>
              <span>
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 20s-7-4.2-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.8-7 10-7 10Z" stroke="currentColor" stroke-width="1.8" />
                </svg>
                ${escapeHtml(likesText)}
              </span>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function buildEssayCard(essay, index) {
    const id = getArticleId(essay, index);
    const title = truncateText(essay.title || '无标题随笔', 70);
    const excerpt = truncateText(essay.excerpt || '暂无摘要。', 120);
    const coverImage = normalizeText(essay.coverImage) || DEFAULT_COVER;
    const location = normalizeText(essay.location) || '未设置定位';
    const authorName = essay.authorNickname || essay.authorName || adminDisplayName || 'Admin';
    const dateText = formatDate(essay.publishedAt || essay.createdAt);
    return `
      <article class="essay-card" data-essay-id="${id}" data-article-link="./essay-detail.html?id=${id}&from=home">
        <img class="essay-cover" src="${escapeHtml(coverImage)}" alt="${escapeHtml(title)} cover" />
        <div class="essay-card-body">
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(excerpt)}</p>
          <div class="essay-meta">
            <span>${escapeHtml(authorName)}</span>
            <span>${escapeHtml(dateText)}</span>
            <span class="essay-location">${escapeHtml(location)}</span>
          </div>
        </div>
      </article>
    `;
  }

  function renderEssays() {
    if (!essayList) {
      return;
    }
    if (!allEssays.length) {
      essayList.innerHTML = '<div class="essay-empty">当前暂未发布随笔</div>';
      return;
    }

    essayList.innerHTML = allEssays.slice(0, 5).map((essay, index) => buildEssayCard(essay, index)).join('');
  }

  function renderRecentList() {
    if (!recentList) {
      return;
    }
    const recent = allArticles.slice(0, 4);
    if (!recent.length) {
      recentList.innerHTML = '<p class="summary">No recent articles.</p>';
      return;
    }

    recentList.innerHTML = recent
      .map((article, index) => {
        const id = getArticleId(article, index);
        const title = article.title || 'Untitled';
        const coverImage = article.coverImage || DEFAULT_COVER;
        const dateText = formatDate(article.createdAt);
        return `
          <a href="./article-detail.html?id=${id}&from=home" class="recent-item">
            <img src="${escapeHtml(coverImage)}" alt="${escapeHtml(title)} cover" />
            <span>
              ${escapeHtml(title)}
              <small>${escapeHtml(dateText)}</small>
            </span>
          </a>
        `;
      })
      .join('');
  }

  function renderArticles() {
    const container = ensureCardsContainer();
    if (!allArticles.length) {
      renderState('当前暂无最新文章');
      return;
    }

    const visibleList = allArticles.slice(0, visibleCount);
    container.innerHTML = visibleList.map((article, index) => buildCard(article, index)).join('');

    if (window.TechVibeArticleNav && typeof window.TechVibeArticleNav.refresh === 'function') {
      window.TechVibeArticleNav.refresh(container);
    }

    if (loadWrap) {
      loadWrap.style.display = visibleCount < allArticles.length ? '' : 'none';
    }
  }

  async function loadArticles() {
    renderState('加载中...');
    try {
      const data = await api.get('/articles');
      allArticles = normalizeArticles(data).sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      });
      visibleCount = Math.min(PAGE_SIZE, allArticles.length);
      renderArticles();
      renderRecentList();
    } catch (error) {
      const message = error && error.message ? error.message : '加载文章失败';
      renderState(message);
    }
  }

  async function loadEssays() {
    if (!essayList) {
      return;
    }
    try {
      const data = await api.get('/essays/latest?limit=5');
      allEssays = normalizeEssays(data);
      renderEssays();
    } catch (error) {
      const message = error && error.message ? error.message : '加载随笔失败';
      essayList.innerHTML = `
        <article class="essay-card">
          <img class="essay-cover" src="${escapeHtml(DEFAULT_COVER)}" alt="加载失败 cover" />
          <div class="essay-card-body">
            <h3>加载失败</h3>
            <p>${escapeHtml(message)}</p>
            <div class="essay-meta">
              <span>${escapeHtml(adminDisplayName || 'Admin')}</span>
              <span>--</span>
              <span class="essay-location">未设置定位</span>
            </div>
          </div>
        </article>
      `;
    }
  }

  clearStaticCards();

  async function loadAdminProfile() {
    if (!teamPanel) return;

    try {
      const profile = await api.get(`/authors/${ADMIN_USERNAME}`);
      const avatar = profile.avatarUrl || DEFAULT_AVATAR;
      const nickname = normalizeText(profile.nickname || profile.name || ADMIN_USERNAME);
      adminDisplayName = nickname;
      const bio = profile.bio || '分享前沿技术，探索编程世界';

      const teamAvatar = teamPanel.querySelector('.team-avatar');
      const teamName = teamPanel.querySelector('h3');
      const teamBio = teamPanel.querySelector('p');

      if (teamAvatar) {
        teamAvatar.src = avatar;
        teamAvatar.alt = `${nickname} 头像`;
      }
      if (teamName) {
        teamName.textContent = nickname;
      }
      if (teamBio) {
        teamBio.textContent = bio;
      }

      renderArticles();
      renderEssays();
    } catch (error) {
      console.error('Failed to load admin profile:', error);
    }
  }

  if (loadButton) {
    loadButton.addEventListener('click', () => {
      visibleCount = Math.min(visibleCount + PAGE_SIZE, allArticles.length);
      renderArticles();
    });
  }

  loadArticles();
  loadEssays();
  loadAdminProfile();
})();
