const articleTitleNode = document.getElementById('essay-title');
const articleDateNode = document.getElementById('essay-date');
const articleAuthorAvatarNode = document.getElementById('essay-author-avatar');
const articleAuthorNameNode = document.getElementById('essay-author-name');
const articleMetaLine = document.querySelector('.article-header .meta-line');
const contentNode = document.getElementById('essay-content');
const breadcrumbTitleNode = document.getElementById('breadcrumb-title');
const sidebarAuthorAvatarNode = document.getElementById('sidebar-author-avatar');
const sidebarAuthorNameNode = document.getElementById('sidebar-author-name');
const sidebarAuthorBioNode = document.getElementById('sidebar-author-bio');
const sidebarAuthorBtn = document.getElementById('sidebar-author-btn');
const sidebarArticleCountNode = document.getElementById('sidebar-article-count');
const sidebarTotalViewsNode = document.getElementById('sidebar-total-views');

const sessionApi = window.TechVibeSession || null;
const api = window.TechVibeApi || null;
const ADMIN_USERNAME = 'admin';
const DEFAULT_AUTHOR_AVATAR =
  'https://images.unsplash.com/photo-1528892952291-009c663ce843?auto=format&fit=crop&w=200&q=80';

const queryParams = new URLSearchParams(window.location.search);
const parsedId = Number(queryParams.get('id'));
const essayId = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : 0;
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

function resolveAuthorDisplayNameByUsername(authorName) {
  const username = normalizeText(authorName);
  if (!username) {
    return '';
  }
  if (normalizeLowerText(username) === ADMIN_USERNAME && adminDisplayName) {
    return adminDisplayName;
  }
  return username;
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

function formatCompactCount(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) {
    return '0';
  }
  if (number >= 1000) {
    return `${(number / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(Math.round(number));
}

function getAuthorDisplayName(profile, fallbackName) {
  const nickname = normalizeText(profile && profile.nickname);
  const username = normalizeText(profile && profile.name);
  const fallback = resolveAuthorDisplayNameByUsername(fallbackName);
  if (normalizeLowerText(username) === ADMIN_USERNAME && !nickname && adminDisplayName) {
    return adminDisplayName;
  }
  return nickname || username || fallback || 'Author';
}

function renderAuthorProfile(profile, fallbackName) {
  const displayName = getAuthorDisplayName(profile, fallbackName);
  const bio = normalizeText(profile && profile.bio);
  const avatar = normalizeText(profile && profile.avatarUrl) || DEFAULT_AUTHOR_AVATAR;
  const authorUsername = normalizeText(profile && profile.name) || normalizeText(fallbackName);

  if (articleAuthorAvatarNode) {
    articleAuthorAvatarNode.src = avatar;
    articleAuthorAvatarNode.alt = `${displayName} avatar`;
  }
  if (articleAuthorNameNode) {
    articleAuthorNameNode.textContent = displayName;
  }

  if (sidebarAuthorAvatarNode) {
    sidebarAuthorAvatarNode.src = avatar;
    sidebarAuthorAvatarNode.alt = `${displayName} avatar`;
  }
  if (sidebarAuthorNameNode) {
    sidebarAuthorNameNode.textContent = displayName;
  }
  if (sidebarAuthorBioNode) {
    sidebarAuthorBioNode.textContent = bio || '这个作者很懒，还没有留下简介。';
  }
  if (sidebarAuthorBtn && authorUsername) {
    sidebarAuthorBtn.onclick = () => {
      window.location.href = `./about-author.html?username=${encodeURIComponent(authorUsername)}`;
    };
  }

  if (sidebarArticleCountNode || sidebarTotalViewsNode) {
    const articles = Array.isArray(profile && profile.articles) ? profile.articles : [];
    const totalViews = articles.reduce((sum, item) => sum + Number((item && item.views) || 0), 0);
    if (sidebarArticleCountNode) {
      sidebarArticleCountNode.textContent = String(articles.length);
    }
    if (sidebarTotalViewsNode) {
      sidebarTotalViewsNode.textContent = formatCompactCount(totalViews);
    }
  }
}

function renderContent(content) {
  if (!contentNode) {
    return;
  }
  const html = normalizeText(content);
  contentNode.innerHTML = html || '<p>暂无正文内容。</p>';
}

function setLocationMeta(location) {
  if (!articleMetaLine) {
    return;
  }
  let locationNode = articleMetaLine.querySelector('.meta-item.meta-location');
  if (!locationNode) {
    locationNode = document.createElement('span');
    locationNode.className = 'meta-item meta-location';
    articleMetaLine.appendChild(locationNode);
  }
  const text = normalizeText(location);
  locationNode.textContent = text ? `定位：${text}` : '定位：未设置';
}

function renderEssay(essay) {
  if (!essay || typeof essay !== 'object') {
    return;
  }

  const title = normalizeText(essay.title) || '未命名随笔';
  const content = normalizeText(essay.content);
  const location = normalizeText(essay.location);
  const authorName = normalizeText(essay.authorName);
  const dateText = formatDate(essay.updatedAt || essay.createdAt);

  if (articleTitleNode) {
    articleTitleNode.textContent = title;
  }
  if (breadcrumbTitleNode) {
    breadcrumbTitleNode.textContent = title;
  }
  document.title = `笔落客 - ${title}`;

  if (articleDateNode) {
    articleDateNode.textContent = dateText;
  }

  renderAuthorProfile(null, authorName);
  setLocationMeta(location);

  renderContent(content);
}

async function loadAuthorProfile(authorName) {
  if (!api) {
    return null;
  }
  const username = normalizeText(authorName);
  if (!username) {
    return null;
  }
  const profile = await api.get(`/authors/${encodeURIComponent(username)}`);
  if (normalizeLowerText(username) === ADMIN_USERNAME) {
    const nickname = normalizeText(profile && (profile.nickname || profile.name || ''));
    if (nickname) {
      adminDisplayName = nickname;
    }
  }
  return profile;
}

async function loadEssay() {
  if (!api) {
    return;
  }
  if (!essayId) {
    throw new Error('随笔ID无效。');
  }

  const essay = await api.get(`/essays/${essayId}`);
  renderEssay(essay);

  const authorName = normalizeText(essay && essay.authorName);
  if (!authorName) {
    return;
  }
  try {
    const authorProfile = await loadAuthorProfile(authorName);
    renderAuthorProfile(authorProfile, authorName);
  } catch {
    // keep fallback author info rendered from essay payload
  }

  loadMoreEssays();
}

async function loadMoreEssays() {
  const container = document.getElementById('more-essays-container');
  if (!container || !api) {
    return;
  }

  try {
    const otherEssay = await api.get(`/essays/next?currentId=${essayId}`);
    if (!otherEssay || !otherEssay.id) {
      container.innerHTML = `
        <a href="./index.html#latest-essays" class="related-item">
          <span>暂无其他随笔，返回首页查看更多</span>
        </a>
      `;
      return;
    }

    const publishedAt = otherEssay.publishedAt || otherEssay.updatedAt || otherEssay.createdAt;
    const dateText = formatDate(publishedAt);
    const coverImage = otherEssay.coverImage || '';
    const title = normalizeText(otherEssay.title) || '其他随笔';

    container.innerHTML = `
      <a href="./essay-detail.html?id=${otherEssay.id}" class="related-item">
        ${coverImage ? `<img src="${coverImage}" alt="${title}" />` : ''}
        <span>
          ${title}
          <small>${dateText}</small>
        </span>
      </a>
    `;
  } catch (error) {
    console.error('Failed to load more essays:', error);
    container.innerHTML = `
      <a href="./index.html#latest-essays" class="related-item">
        <span>暂无其他随笔</span>
      </a>
    `;
  }
}

function initImageZoom() {
  const modal = document.createElement('div');
  modal.className = 'image-zoom-modal';
  modal.innerHTML = `
    <div class="image-zoom-backdrop"></div>
    <div class="image-zoom-content">
      <img src="" alt="放大图片" />
    </div>
    <button class="image-zoom-close" type="button" aria-label="关闭">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  `;
  document.body.appendChild(modal);

  const modalImg = modal.querySelector('img');
  const backdrop = modal.querySelector('.image-zoom-backdrop');
  const closeBtn = modal.querySelector('.image-zoom-close');

  function openModal(img) {
    modalImg.src = img.src;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  modal.addEventListener('click', (event) => {
    if (event.target === backdrop || event.target === closeBtn || event.target.closest('.image-zoom-close')) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });

  document.addEventListener('dblclick', (event) => {
    const img = event.target.closest('.article-content img');
    if (img) {
      openModal(img);
    }
  });
}

function initBackButton() {
  const backBtn = document.getElementById('back-btn');
  if (!backBtn) {
    return;
  }

  backBtn.addEventListener('click', () => {
    if (window.history.length > 1 && document.referrer) {
      try {
        const referrerUrl = new URL(document.referrer);
        const currentUrl = new URL(window.location.href);
        if (referrerUrl.origin === currentUrl.origin) {
          window.history.back();
          return;
        }
      } catch {
        // ignore URL parsing errors
      }
    }
    window.location.href = './index.html';
  });
}

initImageZoom();
initBackButton();

loadEssay().catch((error) => {
  window.alert(error && error.message ? error.message : '随笔加载失败。');
});
