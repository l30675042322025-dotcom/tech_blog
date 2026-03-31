const menuItems = Array.from(document.querySelectorAll('.menu-item'));
const bioInput = document.getElementById('profile-bio');
const bioCounter = document.getElementById('bio-counter');
const myArticlesMenuItem = document.querySelector('.sidebar-nav .menu-item:nth-of-type(3)');
const myArticlesPanel = document.querySelector('.article-panel');
const socialBlock = document.querySelector('.social-block');
const articleListContainer = document.querySelector('.article-panel .article-list');
const moreWrap = document.querySelector('.article-panel .more-wrap');

const profileForm = document.getElementById('profile-form');
const usernameInput = document.getElementById('profile-username');
const nicknameInput = document.getElementById('profile-nickname');
const emailInput = document.getElementById('profile-email');
const mobileInput = document.getElementById('profile-mobile');
const githubInput = document.getElementById('social-github');
const twitterInput = document.getElementById('social-twitter');
const siteInput = document.getElementById('social-site');

const changeAvatarButton = document.getElementById('change-avatar-btn');
const avatarUploadInput = document.getElementById('avatar-upload-input');
const avatarObjectKeyText = document.getElementById('avatar-object-key');

const sessionApi = window.TechVibeSession || null;
const api = window.TechVibeApi || null;
const ADMIN_USERNAME = 'admin';

let syncingForm = false;
let adminUser = false;
let articlesPage = 0;
let articlesPageSize = 5;
let allArticles = [];

function updateCounter() {
  if (!bioInput || !bioCounter) return;
  bioCounter.textContent = `${bioInput.value.length}/500字`;
}

function updateAvatarViews(url, name) {
  document.querySelectorAll('.header-avatar img, .user-avatar, .edit-avatar').forEach((img) => {
    img.src = url;
    img.alt = `${name}头像`;
  });
}

function isAdminProfile(profile) {
  const name = String((profile && profile.name) || '').trim().toLowerCase();
  return name === ADMIN_USERNAME;
}

function toggleNodeVisible(node, visible) {
  if (!node) return;
  node.hidden = !visible;
}

function applyRoleView(profile) {
  adminUser = isAdminProfile(profile);
  const emailFieldGroup = emailInput ? emailInput.closest('.field-group') : null;
  const mobileFieldGroup = mobileInput ? mobileInput.closest('.field-group') : null;

  const adminOnlyItems = document.querySelectorAll('.menu-admin-only');
  const userOnlyItems = document.querySelectorAll('.menu-user-only');

  if (adminUser) {
    adminOnlyItems.forEach(item => item.hidden = true);
    userOnlyItems.forEach(item => item.hidden = true);
  } else {
    adminOnlyItems.forEach(item => item.hidden = true);
    userOnlyItems.forEach(item => item.hidden = false);
  }
  toggleNodeVisible(myArticlesPanel, false);
  toggleNodeVisible(emailFieldGroup, false);
  toggleNodeVisible(mobileFieldGroup, false);
  toggleNodeVisible(socialBlock, false);
}

function normalizeProfile(raw) {
  const profile = raw || {};
  return {
    id: profile.id || null,
    name: profile.name || '',
    email: profile.email || '',
    avatarUrl: profile.avatarUrl || '',
    lastAvatarObjectKey: profile.lastAvatarObjectKey || '',
    nickname: profile.nickname || '',
    mobile: profile.mobile || '',
    bio: profile.bio || '',
    github: profile.github || '',
    twitter: profile.twitter || '',
    website: profile.website || '',
  };
}

function getLocalProfile() {
  return sessionApi && typeof sessionApi.getProfile === 'function'
    ? normalizeProfile(sessionApi.getProfile())
    : normalizeProfile({});
}

function applySessionProfile(profile) {
  if (sessionApi && typeof sessionApi.setProfile === 'function') {
    sessionApi.setProfile(profile);
  }
}

function fillForm(profile) {
  syncingForm = true;
  const next = normalizeProfile(profile);

  if (usernameInput) usernameInput.value = next.name;
  if (nicknameInput) nicknameInput.value = next.nickname;
  if (emailInput) emailInput.value = next.email;
  if (mobileInput) mobileInput.value = next.mobile;
  if (bioInput) bioInput.value = next.bio;
  if (githubInput) githubInput.value = next.github;
  if (twitterInput) twitterInput.value = next.twitter;
  if (siteInput) siteInput.value = next.website;

  if (avatarObjectKeyText) {
    avatarObjectKeyText.textContent = next.lastAvatarObjectKey
      ? `阿里云对象：${next.lastAvatarObjectKey}`
      : '';
  }

  if (next.avatarUrl) {
    updateAvatarViews(next.avatarUrl, next.name || '用户');
  }

  applyRoleView(next);
  updateCounter();
  syncingForm = false;
}

function collectFormProfilePatch() {
  const basicPatch = {
    name: usernameInput ? usernameInput.value.trim() : '',
    nickname: nicknameInput ? nicknameInput.value.trim() : '',
    bio: bioInput ? bioInput.value.trim() : '',
  };

  if (!adminUser) {
    return basicPatch;
  }

  return {
    ...basicPatch,
    email: emailInput ? emailInput.value.trim() : '',
    mobile: mobileInput ? mobileInput.value.trim() : '',
    github: githubInput ? githubInput.value.trim() : '',
    twitter: twitterInput ? twitterInput.value.trim() : '',
    website: siteInput ? siteInput.value.trim() : '',
  };
}

async function loadProfileFromServer() {
  if (!api) return;
  const profile = await api.get('/profile', { auth: true });
  applySessionProfile(profile);
  fillForm(profile);
  loadMyArticles();
}

async function persistFormProfile() {
  if (syncingForm || !api) return;
  const patch = collectFormProfilePatch();
  const profile = await api.put('/profile', patch, { auth: true });
  applySessionProfile(profile);
  fillForm(profile);
}

async function onAvatarFileChange() {
  const file = avatarUploadInput && avatarUploadInput.files ? avatarUploadInput.files[0] : null;
  if (!file || !api) return;

  if (!file.type.startsWith('image/')) {
    window.alert('仅支持图片格式头像。');
    avatarUploadInput.value = '';
    return;
  }

  const formData = new FormData();
  formData.append('file', file);
  const result = await api.postForm('/profile/avatar', formData, { auth: true });

  const current = getLocalProfile();
  const next = {
    ...current,
    avatarUrl: result.avatarUrl || current.avatarUrl,
    lastAvatarObjectKey: result.objectKey || '',
  };

  applySessionProfile(next);
  fillForm(next);
  avatarUploadInput.value = '';
}

function redirectToLogin() {
  const currentPage = window.location.pathname.split('/').pop() || 'profile.html';
  window.location.href = `./auth.html?tab=login&redirect=${encodeURIComponent(currentPage)}`;
}

menuItems.forEach((item) => {
  item.addEventListener('click', () => {
    menuItems.forEach((node) => node.classList.remove('active'));
    item.classList.add('active');
  });
});

if (bioInput) {
  bioInput.addEventListener('input', updateCounter);
}
updateCounter();

const formFields = [usernameInput, nicknameInput, emailInput, mobileInput, bioInput, githubInput, twitterInput, siteInput];
formFields.forEach((field) => {
  if (!field) return;
  field.addEventListener('change', () => {
    persistFormProfile().catch((error) => {
      window.alert(error && error.message ? error.message : '资料保存失败，请稍后重试。');
    });
  });
});

if (profileForm) {
  profileForm.addEventListener('submit', (event) => {
    event.preventDefault();
    persistFormProfile().catch((error) => {
      window.alert(error && error.message ? error.message : '资料保存失败，请稍后重试。');
    });
  });
}

if (changeAvatarButton && avatarUploadInput) {
  changeAvatarButton.addEventListener('click', () => avatarUploadInput.click());
  avatarUploadInput.addEventListener('change', () => {
    onAvatarFileChange().catch((error) => {
      window.alert(error && error.message ? error.message : '头像上传失败，请稍后重试。');
    });
  });
}

if (!sessionApi || !sessionApi.isAuthed || !sessionApi.isAuthed()) {
  redirectToLogin();
} else {
  fillForm(getLocalProfile());
  loadProfileFromServer().catch((error) => {
    if (error && /token|authorization|401|expired/i.test(String(error.message || ''))) {
      if (sessionApi && typeof sessionApi.clearAuth === 'function') {
        sessionApi.clearAuth();
      }
      redirectToLogin();
      return;
    }
    window.alert(error && error.message ? error.message : '加载资料失败。');
  });
}

function formatDate(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function loadMyArticles() {
  if (!api || !adminUser) return;

  const profile = getLocalProfile();
  const authorName = profile.name || '';

  if (!authorName) return;

  try {
    const articles = await api.get(`/articles?authorName=${encodeURIComponent(authorName)}`, { auth: true });
    allArticles = Array.isArray(articles) ? articles : [];
    articlesPage = 0;
    renderArticles();
  } catch (error) {
    console.error('加载文章失败:', error);
  }
}

function renderArticleRow(article) {
  const id = article.id || '';
  const title = escapeHtml(article.title || '无标题');
  const summary = escapeHtml(article.summary || '');
  const category = escapeHtml(article.category || '未分类');
  const coverImage = escapeHtml(article.coverImage || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=320&q=80');
  const createdAt = formatDate(article.createdAt);
  const views = article.views || 0;
  const status = String(article.status || '').toLowerCase();
  const isDraft = status === 'draft';
  const articleLink = isDraft ? `./article-edit.html?id=${id}` : `./article-detail.html?id=${id}`;
  const statusBadge = isDraft ? '<span class="status-badge draft">草稿</span>' : '';

  const row = document.createElement('article');
  row.className = `article-row${isDraft ? ' is-draft' : ''}`;
  row.dataset.articleLink = articleLink;
  row.dataset.articleId = id;

  row.innerHTML = `
    ${statusBadge}
    <img class="article-thumb" src="${coverImage}" alt="${title}" />
    <div class="article-body">
      <h3>${title}</h3>
      <p>${createdAt} · ${category} · ${views} 阅读</p>
    </div>
    <div class="article-actions">
      <a href="./article-edit.html?id=${id}" aria-label="编辑文章">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="m4 20 4.2-.8L19 8.4 15.6 5 4.8 15.8 4 20Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
          <path d="m13.8 6.8 3.4 3.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </a>
      <button type="button" class="delete-article-btn" aria-label="删除文章" data-article-id="${id}">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M5 7h14M9 7v-2h6v2M8 10v7M12 10v7M16 10v7M7 7l.9 12a2 2 0 0 0 2 1.9h4.2a2 2 0 0 0 2-1.9L17 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  `;

  return row;
}

function renderArticles() {
  if (!articleListContainer) return;

  const start = articlesPage * articlesPageSize;
  const end = start + articlesPageSize;
  const pageArticles = allArticles.slice(0, end);

  articleListContainer.innerHTML = '';

  if (pageArticles.length === 0) {
    articleListContainer.innerHTML = '<p class="empty-tip">暂无文章</p>';
    if (moreWrap) moreWrap.hidden = true;
    return;
  }

  pageArticles.forEach((article) => {
    const row = renderArticleRow(article);
    if (row) articleListContainer.appendChild(row);
  });

  if (window.TechVibeArticleNav && typeof window.TechVibeArticleNav.refresh === 'function') {
    window.TechVibeArticleNav.refresh(articleListContainer);
  }

  bindDeleteButtons();

  if (moreWrap) {
    moreWrap.hidden = end >= allArticles.length;
  }
}

function bindDeleteButtons() {
  const deleteButtons = articleListContainer.querySelectorAll('.delete-article-btn');
  deleteButtons.forEach((btn) => {
    btn.addEventListener('click', async (event) => {
      event.stopPropagation();
      event.preventDefault();

      const articleId = btn.dataset.articleId;
      if (!articleId) return;

      const confirmed = window.confirm('确定要删除这篇文章吗？此操作不可撤销。');
      if (!confirmed) return;

      try {
        await api.post('/articles/batch/delete', { ids: [Number(articleId)] }, { auth: true });
        allArticles = allArticles.filter((a) => String(a.id) !== articleId);
        renderArticles();
        window.alert('文章已删除。');
      } catch (error) {
        window.alert(error && error.message ? error.message : '删除失败，请稍后重试。');
      }
    });
  });
}

function loadMoreArticles() {
  articlesPage += 1;
  renderArticles();
}

if (moreWrap) {
  const moreBtn = moreWrap.querySelector('button');
  if (moreBtn) {
    moreBtn.addEventListener('click', loadMoreArticles);
  }
}
