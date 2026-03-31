(function () {
  const AUTH_KEY = 'techvibe_auth';
  const PROFILE_KEY = 'techvibe_profile';
  const GUEST_MODE_KEY = 'techvibe_guest_mode';
  const TOKEN_KEY = 'techvibe_token';
  const THEME_KEY = 'techvibe_theme';
  const SESSION_CHANGED_EVENT = 'techvibe:session-change';
  const ADMIN_USERNAME = 'admin';
  const THEME_LIGHT = 'light';
  const THEME_DARK = 'dark';

  const DEFAULT_PROFILE = {
    id: null,
    name: 'Demo User',
    email: 'demo.user@example.com',
    avatarUrl: 'https://images.unsplash.com/photo-1528892952291-009c663ce843?auto=format&fit=crop&w=160&q=80',
    nickname: '',
    mobile: '',
    bio: '',
    github: '',
    twitter: '',
    website: '',
    lastAvatarObjectKey: '',
  };

  const api = window.TechVibeApi || null;

  function safeRead(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function safeWrite(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore failures in restricted contexts.
    }
  }

  function safeRemove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore failures in restricted contexts.
    }
  }

  function normalizeTheme(value) {
    return String(value || '').trim().toLowerCase() === THEME_DARK ? THEME_DARK : THEME_LIGHT;
  }

  function getSystemTheme() {
    try {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return THEME_DARK;
      }
    } catch {
      // Ignore browser incompatibility.
    }
    return THEME_LIGHT;
  }

  function getTheme() {
    const stored = safeRead(THEME_KEY);
    if (stored) {
      return normalizeTheme(stored);
    }
    return normalizeTheme(getSystemTheme());
  }

  function updateThemeToggleButtons(theme) {
    const currentTheme = normalizeTheme(theme);
    const isDark = currentTheme === THEME_DARK;
    const label = isDark ? '切换到日间模式' : '切换到夜间模式';
    document.querySelectorAll('.theme-toggle-btn').forEach((button) => {
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.setAttribute('aria-pressed', isDark ? 'true' : 'false');
      button.classList.toggle('is-dark', isDark);
    });
  }

  function setTheme(theme) {
    const normalized = normalizeTheme(theme);
    safeWrite(THEME_KEY, normalized);
    document.documentElement.setAttribute('data-theme', normalized);
    updateThemeToggleButtons(normalized);
    return normalized;
  }

  function toggleTheme() {
    const nextTheme = getTheme() === THEME_DARK ? THEME_LIGHT : THEME_DARK;
    return setTheme(nextTheme);
  }

  function fromBackendUser(user) {
    if (!user || typeof user !== 'object') {
      return { ...DEFAULT_PROFILE };
    }
    return {
      ...DEFAULT_PROFILE,
      id: user.id || null,
      name: user.name || user.username || DEFAULT_PROFILE.name,
      email: user.email || DEFAULT_PROFILE.email,
      avatarUrl: user.avatarUrl || DEFAULT_PROFILE.avatarUrl,
      lastAvatarObjectKey: user.lastAvatarObjectKey || '',
      nickname: user.nickname || '',
      mobile: user.mobile || '',
      bio: user.bio || '',
      github: user.github || '',
      twitter: user.twitter || '',
      website: user.website || '',
    };
  }

  function parseProfile() {
    try {
      const raw = safeRead(PROFILE_KEY);
      if (!raw) return { ...DEFAULT_PROFILE };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_PROFILE };
      return {
        ...DEFAULT_PROFILE,
        ...parsed,
      };
    } catch {
      return { ...DEFAULT_PROFILE };
    }
  }

  function storeProfile(profile) {
    safeWrite(PROFILE_KEY, JSON.stringify(profile));
  }

  function getToken() {
    return safeRead(TOKEN_KEY) || '';
  }

  function isAuthed() {
    const token = getToken();
    return Boolean(token) && safeRead(AUTH_KEY) !== '0';
  }

  function setToken(token) {
    const value = String(token || '').trim();
    if (!value) {
      clearAuth();
      return '';
    }
    safeWrite(TOKEN_KEY, value);
    safeWrite(AUTH_KEY, '1');
    safeWrite(GUEST_MODE_KEY, '0');
    init();
    return value;
  }

  function clearAuth() {
    safeWrite(AUTH_KEY, '0');
    safeWrite(GUEST_MODE_KEY, '0');
    safeRemove(TOKEN_KEY);
    storeProfile({ ...DEFAULT_PROFILE });
    init();
    window.location.href = './index.html';
  }

  function setGuestMode(value) {
    safeWrite(GUEST_MODE_KEY, value ? '1' : '0');
    if (value) {
      safeWrite(AUTH_KEY, '0');
      safeRemove(TOKEN_KEY);
    }
    init();
    return value;
  }

  function getProfile() {
    const profile = parseProfile();
    if (!safeRead(PROFILE_KEY)) {
      storeProfile(profile);
    }
    return profile;
  }

  function buildProfileAvatarLink(profile) {
    const link = document.createElement('a');
    link.className = 'header-avatar-link';
    link.href = './profile.html';
    link.setAttribute('aria-label', 'Profile');

    const avatar = document.createElement('img');
    avatar.src = profile.avatarUrl;
    avatar.alt = `${profile.name} avatar`;
    link.appendChild(avatar);
    return link;
  }

  function buildAdminPublishLink() {
    const link = document.createElement('a');
    link.className = 'header-publish-link';
    link.href = './article-edit.html';
    link.textContent = '发布文章';
    link.setAttribute('aria-label', '发布文章');
    return link;
  }

  function buildAdminEssayLink() {
    const link = document.createElement('a');
    link.className = 'header-essay-link';
    link.href = './essay-edit.html';
    link.textContent = '发布随笔';
    link.setAttribute('aria-label', '发布随笔');
    return link;
  }

  function buildLogoutButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'header-logout-btn';
    button.textContent = '\u9000\u51fa\u767b\u5f55';
    button.setAttribute('aria-label', '\u9000\u51fa\u767b\u5f55');
    return button;
  }

  function buildThemeToggleButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-toggle-btn';
    button.setAttribute('aria-label', '切换到夜间模式');
    button.setAttribute('title', '切换到夜间模式');
    button.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M21 14.5A9 9 0 1 1 9.5 3 7 7 0 1 0 21 14.5Z"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    `;
    return button;
  }

  function ensureThemeToggleButtons() {
    let panel = document.querySelector('.floating-tools-widget');
    if (!panel) {
      panel = document.createElement('section');
      panel.className = 'floating-tools-widget';
      panel.setAttribute('aria-label', '夜间模式工具');
      document.body.appendChild(panel);
    }

    let themeRow = panel.querySelector('.floating-theme-row');
    if (!themeRow) {
      themeRow = document.createElement('div');
      themeRow.className = 'floating-theme-row';
      themeRow.innerHTML = `<span class="floating-theme-label">夜间模式</span>`;
      panel.appendChild(themeRow);
    }

    let button = themeRow.querySelector('.theme-toggle-btn');
    if (!button) {
      button = buildThemeToggleButton();
      button.classList.add('theme-toggle-panel-btn');
      themeRow.appendChild(button);
    }

    document
      .querySelectorAll('.auth-actions .theme-toggle-btn, .header-actions .theme-toggle-btn')
      .forEach((node) => node.remove());

    updateThemeToggleButtons(getTheme());
  }

  function isAdminProfile(profile) {
    const name = String((profile && profile.name) || '').trim().toLowerCase();
    return name === ADMIN_USERNAME;
  }

  function syncNavAdminLinks() {
    const authed = isAuthed();
    const profile = getProfile();
    const isAdmin = isAdminProfile(profile);

    document.querySelectorAll('.nav-admin-link, .nav-admin-essay-link').forEach((link) => {
      if (authed && isAdmin) {
        link.hidden = false;
      } else {
        link.hidden = true;
      }
    });
  }

  function syncAuthActions() {
    const authed = isAuthed();
    const profile = getProfile();

    document.querySelectorAll('.auth-actions').forEach((container) => {
      if (!container.dataset.defaultHtml) {
        container.dataset.defaultHtml = container.innerHTML;
      }

      if (authed) {
        container.classList.add('logged-in');
        const children = [];
        const hasAdminPublish = container.dataset.enableAdminPublish === 'true' && isAdminProfile(profile);
        if (hasAdminPublish) {
          children.push(buildAdminEssayLink());
          children.push(buildAdminPublishLink());
        }
        children.push(buildProfileAvatarLink(profile));
        children.push(buildLogoutButton());
        container.replaceChildren(...children);
      } else {
        container.classList.remove('logged-in');
        if (container.dataset.defaultHtml) {
          container.innerHTML = container.dataset.defaultHtml;
        }
      }
    });

    syncNavAdminLinks();
  }

  function syncAvatarImages() {
    const profile = getProfile();
    document.querySelectorAll('.header-avatar img, .header-avatar-link img, .user-avatar, .edit-avatar').forEach((img) => {
      img.src = profile.avatarUrl;
      img.alt = `${profile.name} avatar`;
    });

    document.querySelectorAll('[data-profile-name]').forEach((node) => {
      node.textContent = profile.name;
    });
  }

  function emitSessionChanged() {
    window.dispatchEvent(
      new CustomEvent(SESSION_CHANGED_EVENT, {
        detail: {
          authed: isAuthed(),
          token: getToken(),
          profile: getProfile(),
        },
      })
    );
  }

  function init() {
    syncAuthActions();
    syncNavAdminLinks();
    ensureThemeToggleButtons();
    syncAvatarImages();
    emitSessionChanged();
  }

  let logoutPending = false;

  function handleThemeToggleClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('.theme-toggle-btn');
    if (!button) return;
    event.preventDefault();
    toggleTheme();
  }

  async function handleLogoutClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('.header-logout-btn') || target.closest('#sidebar-logout-btn');
    if (!button || logoutPending) return;
    event.preventDefault();
    logoutPending = true;
    button.disabled = true;
    try {
      if (api && isAuthed()) {
        await api.post('/auth/logout', null, { auth: true });
      }
    } catch {
      // Ignore network/API failures and always clear local auth state.
    } finally {
      clearAuth();
      logoutPending = false;
    }
  }

  async function refreshProfileFromServer() {
    if (!api || !isAuthed()) return null;
    try {
      const user = await api.get('/auth/me', { auth: true });
      const mapped = fromBackendUser(user);
      storeProfile(mapped);
      safeWrite(AUTH_KEY, '1');
      init();
      return mapped;
    } catch (error) {
      const status = Number(error && error.status);
      const message = String((error && error.message) || '').toLowerCase();
      const shouldClearAuth =
        status === 401 ||
        status === 403 ||
        message.includes('authorization token is required') ||
        message.includes('token is invalid') ||
        message.includes('expired');

      if (shouldClearAuth) {
        clearAuth();
        return null;
      }

      // Network/API transient failure: keep cached session and profile.
      init();
      return null;
    }
  }

  function applyAuthResponse(authData) {
    if (!authData || typeof authData !== 'object') {
      return null;
    }
    const token = authData.token || '';
    const mapped = fromBackendUser(authData.user || {});
    if (token) {
      safeWrite(TOKEN_KEY, token);
      safeWrite(AUTH_KEY, '1');
      safeWrite(GUEST_MODE_KEY, '0');
    }
    storeProfile(mapped);
    init();
    return mapped;
  }

  setTheme(getTheme());

  window.TechVibeSession = {
    keys: {
      auth: AUTH_KEY,
      profile: PROFILE_KEY,
      guestMode: GUEST_MODE_KEY,
      token: TOKEN_KEY,
      theme: THEME_KEY,
    },
    events: {
      changed: SESSION_CHANGED_EVENT,
    },
    isAuthed,
    getToken,
    getTheme,
    setTheme,
    toggleTheme,
    setToken,
    clearAuth,
    setGuestMode,
    getProfile,
    setProfile(profile) {
      const merged = {
        ...getProfile(),
        ...profile,
      };
      storeProfile(merged);
      init();
      return merged;
    },
    applyAuthResponse,
    refreshProfileFromServer,
    refresh: init,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init();
      refreshProfileFromServer();
    });
  } else {
    init();
    refreshProfileFromServer();
  }
  document.addEventListener('click', handleThemeToggleClick);
  document.addEventListener('click', handleLogoutClick);
})();
