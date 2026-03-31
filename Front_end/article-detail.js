let tocLinks = [];
let sections = [];

const commentEditor = document.querySelector('.comment-editor');
const commentTextarea = commentEditor ? commentEditor.querySelector('textarea') : null;
const commentList = document.querySelector('.comment-list');
const commentsTitle = document.querySelector('.comments-block h2');
const articleTitleNode = document.querySelector('.article-header h1');
const articleMetaItems = Array.from(document.querySelectorAll('.article-header .meta-item'));
const leadNode = document.querySelector('.lead');
const leadAiBadge = document.getElementById('lead-ai-badge');
const tagStrip = document.querySelector('.tag-strip');
const articleContentNode = document.getElementById('article-content');
const tocListNode = document.getElementById('toc-list');
const breadcrumbCategoryLink = document.getElementById('breadcrumb-category-link');
const breadcrumbHomeCategorySep = document.getElementById('breadcrumb-home-category-sep');
const breadcrumbCategoryTitleSep = document.getElementById('breadcrumb-category-title-sep');
const breadcrumbTitleNode = document.getElementById('breadcrumb-title');
const sidebarAuthorPanel = document.querySelector('.sidebar-author');
const relatedPanel = document.querySelector('.related-panel');
const mainLikeButton = document.querySelector('.post-actions .article-like-action');
const mainFavoriteButton = document.querySelector('.post-actions .article-favorite-action');

const sessionApi = window.TechVibeSession || null;
const api = window.TechVibeApi || null;
const ADMIN_USERNAME = 'admin';

const DEFAULT_AUTHOR_AVATAR =
  'https://images.unsplash.com/photo-1528892952291-009c663ce843?auto=format&fit=crop&w=200&q=80';

const queryParams = new URLSearchParams(window.location.search);
const parsedId = Number(queryParams.get('id'));
const articleId = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : 1;
const articleSource = String(queryParams.get('from') || '').trim().toLowerCase();
const cachedProfile = sessionApi && typeof sessionApi.getProfile === 'function' ? sessionApi.getProfile() : null;
let adminDisplayName =
  cachedProfile && String(cachedProfile.name || '').trim().toLowerCase() === ADMIN_USERNAME
    ? String(cachedProfile.nickname || cachedProfile.name || '').trim()
    : '';
let likeRequestPending = false;
let favoriteRequestPending = false;
const fromHomeReferrer = (() => {
  if (document.referrer == null || document.referrer === '') {
    return false;
  }
  try {
    const referrerUrl = new URL(document.referrer);
    return /(?:^|\/)index\.html$/i.test(referrerUrl.pathname);
  } catch {
    return false;
  }
})();
const hideCategoryBreadcrumb = articleSource === 'home' || (articleSource === '' && fromHomeReferrer);

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

function isAuthed() {
  return Boolean(sessionApi && typeof sessionApi.isAuthed === 'function' && sessionApi.isAuthed());
}

function redirectToLogin(actionLabel) {
  const action = actionLabel || '执行操作';
  window.alert(`请先登录后再${action}。`);
  const currentPage = window.location.pathname.split('/').pop() || 'article-detail.html';
  const redirect = encodeURIComponent(`${currentPage}?id=${articleId}`);
  window.location.href = `./auth.html?tab=login&redirect=${redirect}`;
}

function setActiveLink(id) {
  tocLinks.forEach((link) => {
    const active = link.getAttribute('href') === `#${id}`;
    link.classList.toggle('active', active);
  });
}

function getCurrentSectionId() {
  const offset = 120;
  let currentId = sections[0] ? sections[0].id : '';
  sections.forEach((section) => {
    if (window.scrollY + offset >= section.offsetTop) {
      currentId = section.id;
    }
  });
  return currentId;
}

function updateTocByScroll() {
  if (!sections.length) {
    return;
  }
  const sectionId = getCurrentSectionId();
  if (sectionId) {
    setActiveLink(sectionId);
  }
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

function setAuthorMetaText(name) {
  if (!articleMetaItems.length) {
    return;
  }
  const authorNode = articleMetaItems[0];
  let textNode = Array.from(authorNode.childNodes).find(
    (node) => node.nodeType === Node.TEXT_NODE && normalizeText(node.nodeValue)
  );
  if (!textNode) {
    textNode = document.createTextNode('');
    authorNode.appendChild(textNode);
  }
  textNode.nodeValue = ` ${name}`;
}

function renderAuthorProfile(profile, fallbackName) {
  const displayName = getAuthorDisplayName(profile, fallbackName);
  const bio = normalizeText(profile && profile.bio);
  const avatar = normalizeText(profile && profile.avatarUrl) || DEFAULT_AUTHOR_AVATAR;
  const authorUsername = normalizeText(profile && profile.name) || normalizeText(fallbackName);

  if (articleMetaItems.length) {
    const authorImg = articleMetaItems[0].querySelector('img');
    if (authorImg) {
      authorImg.src = avatar;
      authorImg.alt = `${displayName} avatar`;
    }
    setAuthorMetaText(displayName);
  }

  if (sidebarAuthorPanel) {
    const sidebarImg = sidebarAuthorPanel.querySelector('img');
    const sidebarName = sidebarAuthorPanel.querySelector('h3');
    const sidebarBio = sidebarAuthorPanel.querySelector('p');
    const sidebarButton = sidebarAuthorPanel.querySelector('button');

    if (sidebarImg) {
      sidebarImg.src = avatar;
      sidebarImg.alt = `${displayName} avatar`;
    }
    if (sidebarName) {
      sidebarName.textContent = displayName;
    }
    if (sidebarBio) {
      sidebarBio.textContent = bio || '这个作者很懒，还没有留下简介。';
    }
    if (sidebarButton && authorUsername) {
      sidebarButton.onclick = () => {
        window.location.href = `./about-author.html?username=${encodeURIComponent(authorUsername)}`;
      };
    }

    const stats = Array.from(sidebarAuthorPanel.querySelectorAll('.author-stats strong'));
    if (stats.length) {
      const articles = Array.isArray(profile && profile.articles) ? profile.articles : [];
      const totalViews = articles.reduce((sum, item) => sum + Number((item && item.views) || 0), 0);
      if (stats[0]) {
        stats[0].textContent = String(articles.length);
      }
      if (stats[2]) {
        stats[2].textContent = formatCompactCount(totalViews);
      }
    }
  }
}

function renderBreadcrumb(category, articleTitle) {
  if (breadcrumbTitleNode) {
    breadcrumbTitleNode.textContent = articleTitle;
  }

  if (!breadcrumbCategoryLink) {
    return;
  }

  breadcrumbCategoryLink.textContent = category;
  breadcrumbCategoryLink.href = `./category.html?category=${encodeURIComponent(category)}`;

  if (hideCategoryBreadcrumb) {
    breadcrumbCategoryLink.hidden = true;
    if (breadcrumbHomeCategorySep) {
      breadcrumbHomeCategorySep.hidden = true;
    }
    if (breadcrumbCategoryTitleSep) {
      breadcrumbCategoryTitleSep.hidden = false;
    }
    return;
  }

  breadcrumbCategoryLink.hidden = false;
  if (breadcrumbHomeCategorySep) {
    breadcrumbHomeCategorySep.hidden = false;
  }
  if (breadcrumbCategoryTitleSep) {
    breadcrumbCategoryTitleSep.hidden = false;
  }
}

function renderComments(comments) {
  if (!commentList) {
    return;
  }
  const list = Array.isArray(comments) ? comments : [];

  if (commentsTitle) {
    commentsTitle.textContent = `评论 (${list.length})`;
  }

  if (!list.length) {
    commentList.innerHTML = '<article class="comment-item"><p>暂无评论，欢迎抢沙发。</p></article>';
    return;
  }

  commentList.innerHTML = list
    .map((comment) => {
      const userName = escapeHtml(comment.userName || '用户');
      const content = escapeHtml(comment.content || '');
      const createdAt = escapeHtml(formatDate(comment.createdAt));
      const avatar = escapeHtml(
        comment.userAvatarUrl ||
          'https://images.unsplash.com/photo-1528892952291-009c663ce843?auto=format&fit=crop&w=120&q=80'
      );

      return `
        <article class="comment-item">
          <header>
            <img src="${avatar}" alt="${userName}头像" />
            <div>
              <h3>${userName}</h3>
              <p>${createdAt}</p>
            </div>
          </header>
          <p>${content}</p>
          <footer>
            <button type="button" class="require-login-action" data-action="点赞" data-comment-like-id="${comment.id}">👍 ${comment.likes || 0}</button>
            <button type="button" class="require-login-action" data-action="评论">回复</button>
          </footer>
        </article>
      `;
    })
    .join('');
}

function buildTocFromContent() {
  if (!tocListNode || !articleContentNode) {
    return;
  }

  const headingNodes = Array.from(articleContentNode.querySelectorAll('h1, h2'));
  const usedIds = new Set();

  const h1Nodes = headingNodes.filter(heading => heading.tagName === 'H1');
  const hasH1 = h1Nodes.length > 0;

  const tocStructure = [];
  let currentH1Item = null;

  headingNodes.forEach((heading, index) => {
    const level = heading.tagName === 'H2' ? '2' : '1';
    let id = normalizeText(heading.id);
    if (!id) {
      id = `section-${index + 1}`;
      heading.id = id;
    }
    while (usedIds.has(id)) {
      id = `${id}-${index + 1}`;
      heading.id = id;
    }
    usedIds.add(id);
    
    const headingText = heading.textContent || '';
    if (!headingText || headingText.trim() === '') {
      return;
    }
    
    const text = normalizeText(headingText);

    if (hasH1) {
      if (level === '1') {
        currentH1Item = {
          id,
          text,
          children: []
        };
        tocStructure.push(currentH1Item);
      } else if (level === '2' && currentH1Item) {
        const nextHeading = headingNodes[index + 1];
        const nextIsSameTextH1 = nextHeading &&
          nextHeading.tagName === 'H1' &&
          normalizeText(nextHeading.textContent || '') === text;
        if (!nextIsSameTextH1) {
          currentH1Item.children.push({
            id,
            text
          });
        }
      }
    } else {
      tocStructure.push({
        id,
        text
      });
    }
  });

  const linkItems = tocStructure.map(item => {
    if (item.children && item.children.length > 0) {
      const h1Link = `<a href="#${escapeHtml(item.id)}" class="toc-level-1">${escapeHtml(item.text)}</a>`;
      const h2Links = item.children.map(h2Item => 
        `<a href="#${escapeHtml(h2Item.id)}" class="toc-level-2">${escapeHtml(h2Item.text)}</a>`
      ).join('');
      return `<div class="toc-item">${h1Link}<div class="toc-sub-items">${h2Links}</div></div>`;
    }
    return `<div class="toc-item"><a href="#${escapeHtml(item.id)}" class="toc-level-1">${escapeHtml(item.text)}</a></div>`;
  });

  linkItems.push('<a href="#comments" class="toc-level-1">评论区</a>');
  tocListNode.innerHTML = linkItems.join('');

  // 同步更新移动端目录（如果存在）
  const mobileTocList = document.querySelector('.toc-mobile #toc-list-mobile');
  if (mobileTocList) {
    mobileTocList.innerHTML = linkItems.join('');
  }

  // 收集所有目录链接（包括移动端和桌面端）
  tocLinks = Array.from(tocListNode.querySelectorAll('a'));
  if (mobileTocList) {
    const mobileLinks = Array.from(mobileTocList.querySelectorAll('a'));
    // 合并链接，但避免重复
    mobileLinks.forEach(link => {
      if (!tocLinks.some(l => l.getAttribute('href') === link.getAttribute('href'))) {
        tocLinks.push(link);
      }
    });
  }
  
  sections = tocLinks
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  updateTocByScroll();
}

function renderArticleContent(content) {
  if (!articleContentNode) {
    return;
  }
  const html = normalizeText(content);
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html || '<p>暂无正文内容。</p>';
  
  const tables = tempDiv.querySelectorAll('table');
  tables.forEach((table) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });
  
  articleContentNode.innerHTML = tempDiv.innerHTML;
  buildTocFromContent();
  // 目录构建完成后，调整移动端目录位置
  adjustTocForMobile();
}

function renderLikeButton(likes, liked) {
  if (!mainLikeButton) {
    return;
  }
  const safeLikes = Number.isFinite(Number(likes)) ? Math.max(0, Number(likes)) : 0;
  const active = Boolean(liked);
  mainLikeButton.classList.toggle('is-active', active);
  mainLikeButton.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M12 20s-7-4.2-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.8-7 10-7 10Z" stroke="currentColor" stroke-width="1.8" />
    </svg>
    ${active ? '已点赞' : '点赞'} (${safeLikes})
  `;
}

function renderFavoriteButton(favorites, favorited) {
  if (!mainFavoriteButton) {
    return;
  }
  const safeFavorites = Number.isFinite(Number(favorites)) ? Math.max(0, Number(favorites)) : 0;
  const active = Boolean(favorited);
  mainFavoriteButton.classList.toggle('is-active', active);
  mainFavoriteButton.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M6 4h12a2 2 0 0 1 2 2v14l-4-3-4 3-4-3-4 3V6a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
    </svg>
    ${active ? '已收藏' : '收藏'} (${safeFavorites})
  `;
}

function renderInteractionButtons(article) {
  if (!article || typeof article !== 'object') {
    renderLikeButton(0, false);
    renderFavoriteButton(0, false);
    return;
  }
  renderLikeButton(article.likes || 0, article.liked);
  renderFavoriteButton(article.favorites || 0, article.favorited);
}

function renderArticle(article) {
  if (!article || typeof article !== 'object') {
    console.error('[ArticleDetail] renderArticle 收到无效数据:', article);
    return;
  }

  const articleTitle = normalizeText(article.title) || '未命名文章';
  const category = normalizeText(article.category) || '未分类';

  if (articleTitleNode) {
    articleTitleNode.textContent = articleTitle;
  }
  document.title = `笔落客 - ${articleTitle}`;

  renderBreadcrumb(category, articleTitle);

  if (leadNode) {
    leadNode.textContent = normalizeText(article.summary) || '暂无摘要。';
  }
  if (leadAiBadge) {
    leadAiBadge.hidden = !Boolean(article.summaryAiGenerated);
  }

  if (articleMetaItems.length >= 5) {
    renderAuthorProfile(null, article.authorName);
    articleMetaItems[1].textContent = formatDate(article.createdAt);
    articleMetaItems[2].textContent = `${article.views || 0} 阅读`;
    articleMetaItems[3].textContent = category;
    articleMetaItems[4].textContent = (article.tags && article.tags[0]) || '无标签';
  }

  if (tagStrip) {
    tagStrip.innerHTML = '<span>标签：</span>';
    const tags = Array.isArray(article.tags) ? article.tags : [];
    tags.forEach((tag) => {
      const text = normalizeText(tag);
      if (!text) {
        return;
      }
      const a = document.createElement('a');
      a.href = '#';
      a.textContent = text;
      tagStrip.appendChild(a);
    });
  }

  renderArticleContent(article.content);

  renderInteractionButtons(article);

  renderComments(article.comments || []);
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

async function loadArticle() {
  if (!api) {
    console.error('[ArticleDetail] API 未初始化，TechVibeApi 为 null');
    window.alert('API 初始化失败，请刷新页面重试。');
    return;
  }

  try {
    const article = await api.get(`/articles/${articleId}`, { auth: true });
    
    if (!article) {
      console.error('[ArticleDetail] API 返回了空数据');
      window.alert('文章内容加载失败，请刷新页面重试。');
      return;
    }
    
    renderArticle(article);

    const authorName = normalizeText(article && article.authorName);
    if (!authorName) {
      return;
    }

    try {
      const authorProfile = await loadAuthorProfile(authorName);
      renderAuthorProfile(authorProfile, authorName);
    } catch {
      // Keep fallback author info rendered from article payload.
    }

    loadRelatedArticle();
  } catch (error) {
    console.error('[ArticleDetail] 加载文章失败:', error);
    const errorMessage = error && error.message ? error.message : '文章加载失败，请检查网络或稍后重试。';
    window.alert(errorMessage);
  }
}

async function loadRelatedArticle() {
  if (!api || !relatedPanel) {
    return;
  }

  try {
    const nextArticle = await api.get(`/articles/${articleId}/next`, { auth: false });
    if (nextArticle) {
      renderRelatedArticle(nextArticle);
    }
  } catch {
    // Keep the default related content
  }
}

function renderRelatedArticle(article) {
  if (!relatedPanel) {
    return;
  }

  if (!article) {
    const heading = relatedPanel.querySelector('h2');
    relatedPanel.innerHTML = '';
    if (heading) {
      relatedPanel.appendChild(heading);
    }
    relatedPanel.insertAdjacentHTML('beforeend', '<p class="no-related">暂无最新文章</p>');
    return;
  }

  const title = escapeHtml(article.title || '无标题');
  const coverImage = article.coverImage || '';
  const createdAt = formatDate(article.createdAt);

  const relatedContent = coverImage
    ? `
      <a href="./article-detail.html?id=${article.id}" class="related-item">
        <img src="${escapeHtml(coverImage)}" alt="${title}" />
        <span>
          ${title}
          <small>${createdAt}</small>
        </span>
      </a>
    `
    : `
      <a href="./article-detail.html?id=${article.id}" class="related-item related-item-text">
        <span>
          ${title}
          <small>${createdAt}</small>
        </span>
      </a>
    `;

  const heading = relatedPanel.querySelector('h2');
  relatedPanel.innerHTML = '';
  if (heading) {
    relatedPanel.appendChild(heading);
  }
  relatedPanel.insertAdjacentHTML('beforeend', relatedContent);
}

async function likeArticle() {
  if (!api) {
    return;
  }
  if (likeRequestPending) {
    return;
  }
  likeRequestPending = true;
  if (mainLikeButton) {
    mainLikeButton.disabled = true;
  }
  try {
    const result = await api.post(`/articles/${articleId}/like`, {}, { auth: true });
    renderLikeButton(result && Number.isFinite(Number(result.likes)) ? Number(result.likes) : 0, result && result.liked);
  } finally {
    if (mainLikeButton) {
      mainLikeButton.disabled = false;
    }
    likeRequestPending = false;
  }
}

async function favoriteArticle() {
  if (!api) {
    return;
  }
  if (favoriteRequestPending) {
    return;
  }
  favoriteRequestPending = true;
  if (mainFavoriteButton) {
    mainFavoriteButton.disabled = true;
  }
  try {
    const result = await api.post(`/articles/${articleId}/favorite`, {}, { auth: true });
    renderFavoriteButton(
      result && Number.isFinite(Number(result.favorites)) ? Number(result.favorites) : 0,
      result && result.favorited
    );
  } finally {
    if (mainFavoriteButton) {
      mainFavoriteButton.disabled = false;
    }
    favoriteRequestPending = false;
  }
}

async function submitComment(content) {
  if (!api) {
    return;
  }
  await api.post(`/articles/${articleId}/comments`, { content }, { auth: true });
  const article = await api.get(`/articles/${articleId}`, { auth: true });
  renderComments(article.comments || []);
}

// 处理目录点击事件（包括移动端和桌面端）
function setupTocClickHandler(tocListElement) {
  if (!tocListElement) {
    return;
  }
  tocListElement.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!link) {
      return;
    }
    event.preventDefault();
    const targetId = link.getAttribute('href');
    const target = targetId ? document.querySelector(targetId) : null;
    if (!target) {
      return;
    }
    const top = target.getBoundingClientRect().top + window.pageYOffset - 88;
    window.scrollTo({ top, behavior: 'smooth' });
    window.history.replaceState({}, '', targetId);
  });
}

if (tocListNode) {
  setupTocClickHandler(tocListNode);
}

window.addEventListener('scroll', updateTocByScroll, { passive: true });

document.addEventListener('click', (event) => {
  const actionButton = event.target.closest('.require-login-action');
  if (!actionButton) {
    return;
  }

  if (actionButton.type === 'submit') {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const actionLabel = actionButton.dataset.action || '操作';
  if (!isAuthed()) {
    redirectToLogin(actionLabel);
    return;
  }

  if (actionButton === mainLikeButton) {
    likeArticle().catch((error) => {
      window.alert(error && error.message ? error.message : '点赞失败，请稍后重试。');
    });
    return;
  }

  if (actionButton === mainFavoriteButton) {
    favoriteArticle().catch((error) => {
      window.alert(error && error.message ? error.message : '收藏失败，请稍后重试。');
    });
    return;
  }

  if (actionButton.dataset.commentLikeId) {
    window.alert('评论点赞功能待实现。');
    return;
  }

  window.alert(`${actionLabel}成功。`);
});

if (commentEditor) {
  commentEditor.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!isAuthed()) {
      redirectToLogin('发表评论');
      return;
    }

    const content = commentTextarea ? commentTextarea.value.trim() : '';
    if (!content) {
      window.alert('请输入评论内容后再提交。');
      return;
    }

    submitComment(content)
      .then(() => {
        if (commentTextarea) {
          commentTextarea.value = '';
        }
        window.alert('评论已发布。');
      })
      .catch((error) => {
        window.alert(error && error.message ? error.message : '评论失败，请稍后重试。');
      });
  });
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

  modal.addEventListener('click', (e) => {
    if (e.target === backdrop || e.target === closeBtn || e.target.closest('.image-zoom-close')) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });

  document.addEventListener('dblclick', (e) => {
    const img = e.target.closest('.article-content img, .article-section img, .hero-figure img');
    if (img) {
      openModal(img);
    }
  });
}

initImageZoom();

function initBackButton() {
  const backBtn = document.getElementById('back-btn');
  if (!backBtn) return;

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
        // Ignore URL parsing errors
      }
    }
    window.location.href = './index.html';
  });
}

initBackButton();

// 移动端目录位置调整
function adjustTocForMobile() {
  const tocPanel = document.querySelector('.toc-panel');
  const articleMain = document.querySelector('.article-main');
  const articleContent = document.getElementById('article-content');
  
  if (!tocPanel || !articleMain || !articleContent) {
    return;
  }

  function moveTocToTop() {
    // 检查是否为移动端（940px以下）
    if (window.innerWidth <= 940) {
      // 检查是否已经存在移动端目录
      let mobileToc = articleMain.querySelector('.toc-mobile');
      
      if (!mobileToc) {
        // 创建目录的副本并插入到文章标题和摘要之间（摘要上方）
        mobileToc = tocPanel.cloneNode(true);
        mobileToc.classList.add('toc-mobile');
        // 修改移动端目录的ID以避免冲突
        const mobileTocList = mobileToc.querySelector('#toc-list');
        if (mobileTocList) {
          mobileTocList.id = 'toc-list-mobile';
          setupTocClickHandler(mobileTocList);
        }
        // 插入到摘要（lead-wrap）之前，文章标题之后
        const leadWrap = articleMain.querySelector('.lead-wrap');
        if (leadWrap) {
          articleMain.insertBefore(mobileToc, leadWrap);
        } else {
          articleMain.insertBefore(mobileToc, articleContent);
        }
        // 隐藏侧边栏中的原始目录
        tocPanel.style.display = 'none';
      }
    } else {
      // 桌面端：移除移动端目录，显示侧边栏目录
      const mobileToc = articleMain.querySelector('.toc-mobile');
      if (mobileToc) {
        mobileToc.remove();
      }
      tocPanel.style.display = '';
    }
  }

  // 初始调整
  moveTocToTop();

  // 监听窗口大小变化
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(moveTocToTop, 150);
  });
}

// 等待DOM加载完成后调整目录位置
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // 等待文章内容加载后再调整
    setTimeout(adjustTocForMobile, 500);
  });
} else {
  setTimeout(adjustTocForMobile, 500);
}

loadArticle().catch((error) => {
  window.alert(error && error.message ? error.message : '文章加载失败。');
});
