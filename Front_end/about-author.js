(function () {
  const api = window.TechVibeApi || null;
  if (!api) {
    return;
  }

  const ADMIN_USERNAME = 'admin';
  const DEFAULT_AVATAR =
    'https://images.unsplash.com/photo-1528892952291-009c663ce843?auto=format&fit=crop&w=260&q=80';
  const DEFAULT_COVER =
    'https://images.unsplash.com/photo-1518773553398-650c184e0bb3?auto=format&fit=crop&w=320&q=80';

  const articleList = document.getElementById('author-article-list');
  const authorAvatar = document.getElementById('author-avatar');
  const authorName = document.getElementById('author-name');
  const authorBio = document.getElementById('author-bio');
  const socialRow = document.getElementById('author-social-row');
  const githubLink = document.getElementById('author-github-link');
  const twitterLink = document.getElementById('author-twitter-link');
  const websiteLink = document.getElementById('author-website-link');

  if (!articleList) {
    return;
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
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function renderSidebarStatus(message) {
    articleList.innerHTML = `<p class="sidebar-status">${escapeHtml(message)}</p>`;
  }

  function normalizeUrl(raw) {
    const value = String(raw || '').trim();
    if (!value) {
      return '';
    }
    if (/^https?:\/\//i.test(value)) {
      return value;
    }
    return `https://${value}`;
  }

  function applySocialLink(node, url) {
    if (!node) {
      return false;
    }
    const normalized = normalizeUrl(url);
    if (!normalized) {
      node.hidden = true;
      node.removeAttribute('href');
      return false;
    }
    node.hidden = false;
    node.href = normalized;
    node.title = normalized;
    return true;
  }

  function renderArticles(list) {
    if (!Array.isArray(list) || list.length === 0) {
      renderSidebarStatus('作者暂未发布文章。');
      return;
    }

    articleList.innerHTML = list
      .map((article) => {
        const id = Number(article && article.id);
        const href = Number.isFinite(id) && id > 0 ? `./article-detail.html?id=${id}` : './article-detail.html';
        const title = article && article.title ? article.title : 'Untitled';
        const cover = article && article.coverImage ? article.coverImage : DEFAULT_COVER;
        const createdAt = formatDate(article && article.createdAt);
        return `
          <a class="mini-article" href="${href}">
            <img src="${escapeHtml(cover)}" alt="${escapeHtml(title)}" />
            <span>
              <strong>${escapeHtml(title)}</strong>
              <small>${escapeHtml(createdAt)}</small>
            </span>
          </a>
        `;
      })
      .join('');
  }

  function renderAuthorInfo(profile) {
    const safeProfile = profile && typeof profile === 'object' ? profile : {};
    const name = safeProfile.nickname || safeProfile.name || 'Admin';
    const bio = safeProfile.bio || safeProfile.nickname || '本站由 admin 维护与更新。';
    const avatar = safeProfile.avatarUrl || DEFAULT_AVATAR;

    if (authorAvatar) {
      authorAvatar.src = avatar;
      authorAvatar.alt = `${name} 头像`;
    }
    if (authorName) {
      authorName.textContent = name;
    }
    if (authorBio) {
      authorBio.textContent = bio;
    }

    const hasGithub = applySocialLink(githubLink, safeProfile.github);
    const hasTwitter = applySocialLink(twitterLink, safeProfile.twitter);
    const hasWebsite = applySocialLink(websiteLink, safeProfile.website);
    if (socialRow) {
      socialRow.hidden = !(hasGithub || hasTwitter || hasWebsite);
    }
  }

  function resolveTargetUsername() {
    const queryName = new URLSearchParams(window.location.search).get('username');
    if (queryName && queryName.trim()) {
      return queryName.trim();
    }

    return ADMIN_USERNAME;
  }

  async function requestAuthorProfile(username) {
    return api.get(`/authors/${encodeURIComponent(username)}`);
  }

  async function loadAuthorProfile() {
    renderSidebarStatus('正在加载作者文章...');
    const targetUsername = resolveTargetUsername();

    try {
      const profile = await requestAuthorProfile(targetUsername);
      renderAuthorInfo(profile);
      renderArticles(profile && profile.articles);
    } catch (error) {
      if (targetUsername !== ADMIN_USERNAME) {
        try {
          const fallbackProfile = await requestAuthorProfile(ADMIN_USERNAME);
          renderAuthorInfo(fallbackProfile);
          renderArticles(fallbackProfile && fallbackProfile.articles);
          return;
        } catch (_) {
          // Fallback also failed, keep original error handling.
        }
      }

      const message = error && error.message ? error.message : '加载作者信息失败，请稍后重试。';
      renderSidebarStatus(message);
      if (authorBio) {
        authorBio.textContent = '作者信息加载失败，请稍后重试。';
      }
    }
  }

  loadAuthorProfile();
})();
