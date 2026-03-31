const tabs = Array.from(document.querySelectorAll('.tab-btn'));
const panels = Array.from(document.querySelectorAll('.auth-panel'));
const switchTabButtons = Array.from(document.querySelectorAll('[data-switch-tab]'));
const passwordToggles = Array.from(document.querySelectorAll('[data-toggle-password]'));
const feedbackItems = Array.from(document.querySelectorAll('.feedback'));
const guestModeLinks = Array.from(document.querySelectorAll('[data-guest-mode]'));

const queryParams = new URLSearchParams(window.location.search);
const redirectParam = queryParams.get('redirect');
const safeRedirectPath =
  redirectParam && !/^https?:/i.test(redirectParam) && !redirectParam.startsWith('//')
    ? redirectParam
    : 'index.html';
const postLoginRedirect = safeRedirectPath.startsWith('./')
  ? safeRedirectPath
  : `./${safeRedirectPath.replace(/^\/+/, '')}`;

const api = window.TechVibeApi || null;
const sessionApi = window.TechVibeSession || null;

function setFeedback(type, message, success) {
  const target = feedbackItems.find((item) => item.dataset.feedback === type);
  if (!target) return;
  target.textContent = message;
  target.classList.toggle('success', Boolean(success));
}

function activateTab(tabName, syncUrl) {
  const current = tabName === 'register' ? 'register' : 'login';

  tabs.forEach((tab) => {
    const active = tab.dataset.tab === current;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });

  panels.forEach((panel) => {
    const active = panel.dataset.panel === current;
    panel.classList.toggle('active', active);
    panel.hidden = !active;
  });

  if (syncUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', current);
    if (!redirectParam) {
      url.searchParams.delete('redirect');
    }
    window.history.replaceState({}, '', url);
  }

  if (current === 'login' && loginCaptchaId && !loginCaptchaId.value) {
    void refreshLoginCaptcha(false);
  }
}

function applyAuth(authData) {
  if (sessionApi && typeof sessionApi.applyAuthResponse === 'function') {
    sessionApi.applyAuthResponse(authData);
    return;
  }
  if (authData && authData.token) {
    window.localStorage.setItem('techvibe_token', authData.token);
    window.localStorage.setItem('techvibe_auth', '1');
  }
}

function ensureApi() {
  if (!api) {
    throw new Error('API 客户端未初始化，请检查 site-api.js 的引入顺序。');
  }
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => activateTab(tab.dataset.tab, true));
});

switchTabButtons.forEach((button) => {
  button.addEventListener('click', () => activateTab(button.dataset.switchTab, true));
});

passwordToggles.forEach((button) => {
  button.addEventListener('click', () => {
    const targetId = button.dataset.togglePassword;
    const input = document.getElementById(targetId);
    if (!input) return;

    const nextType = input.type === 'password' ? 'text' : 'password';
    input.type = nextType;
    button.setAttribute('aria-label', nextType === 'password' ? '显示密码' : '隐藏密码');
  });
});

guestModeLinks.forEach((link) => {
  link.addEventListener('click', async (event) => {
    event.preventDefault();
    if (sessionApi && typeof sessionApi.setGuestMode === 'function') {
      sessionApi.setGuestMode(true);
    } else {
      window.localStorage.setItem('techvibe_guest_mode', '1');
      window.localStorage.setItem('techvibe_auth', '0');
      window.localStorage.removeItem('techvibe_token');
    }
    window.location.href = './index.html';
  });
});

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginAccount = document.getElementById('login-account');
const loginPassword = document.getElementById('login-password');
const loginCaptchaInput = document.getElementById('login-captcha');
const loginCaptchaId = document.getElementById('login-captcha-id');
const loginCaptchaImage = document.getElementById('login-captcha-image');
const loginCaptchaRefreshButton = document.getElementById('login-captcha-refresh');
const registerName = document.getElementById('register-name');
const registerEmail = document.getElementById('register-email');
const registerEmailCode = document.getElementById('register-email-code');
const sendRegisterEmailCodeButton = document.getElementById('send-register-email-code');
const registerPassword = document.getElementById('register-password');
const registerConfirm = document.getElementById('register-confirm');

const REGISTER_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGISTER_EMAIL_CODE_COOLDOWN_SECONDS = 60;
let registerEmailCodeCountdown = 0;
let registerEmailCodeTimer = null;

async function refreshLoginCaptcha(showError) {
  if (!loginCaptchaId || !loginCaptchaImage) return;

  try {
    ensureApi();
    const data = await api.get('/auth/captcha');
    if (!data || !data.captchaId || !data.captchaImage) {
      throw new Error('验证码加载失败，请稍后重试。');
    }

    loginCaptchaId.value = data.captchaId;
    loginCaptchaImage.src = data.captchaImage;
    if (loginCaptchaInput) {
      loginCaptchaInput.value = '';
      loginCaptchaInput.setCustomValidity('');
    }
  } catch (error) {
    if (showError) {
      setFeedback('login', error && error.message ? error.message : '验证码加载失败，请稍后重试。', false);
    }
  }
}

function renderRegisterEmailCodeButton() {
  if (!sendRegisterEmailCodeButton) return;
  if (registerEmailCodeCountdown > 0) {
    sendRegisterEmailCodeButton.disabled = true;
    sendRegisterEmailCodeButton.textContent = `${registerEmailCodeCountdown}s`;
    return;
  }
  sendRegisterEmailCodeButton.disabled = false;
  sendRegisterEmailCodeButton.textContent = '发送验证码';
}

function startRegisterEmailCodeCountdown() {
  registerEmailCodeCountdown = REGISTER_EMAIL_CODE_COOLDOWN_SECONDS;
  renderRegisterEmailCodeButton();
  if (registerEmailCodeTimer) {
    window.clearInterval(registerEmailCodeTimer);
  }
  registerEmailCodeTimer = window.setInterval(() => {
    registerEmailCodeCountdown -= 1;
    if (registerEmailCodeCountdown <= 0) {
      registerEmailCodeCountdown = 0;
      window.clearInterval(registerEmailCodeTimer);
      registerEmailCodeTimer = null;
    }
    renderRegisterEmailCodeButton();
  }, 1000);
}

if (loginCaptchaRefreshButton) {
  loginCaptchaRefreshButton.addEventListener('click', () => {
    void refreshLoginCaptcha(true);
  });
}

if (loginCaptchaInput) {
  loginCaptchaInput.addEventListener('input', () => {
    const sanitized = loginCaptchaInput.value.replace(/[^a-z0-9]/gi, '');
    loginCaptchaInput.value = sanitized.toUpperCase();
    loginCaptchaInput.setCustomValidity('');
  });
}

if (loginForm) {
  loginForm.addEventListener('input', () => setFeedback('login', '', false));

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!loginForm.checkValidity()) {
      loginForm.reportValidity();
      setFeedback('login', '请补全登录信息后再提交。', false);
      return;
    }

    if (!loginCaptchaId || !loginCaptchaId.value) {
      await refreshLoginCaptcha(false);
      setFeedback('login', '验证码已刷新，请输入后再登录。', false);
      return;
    }

    try {
      ensureApi();
      const authData = await api.post('/auth/login', {
        account: loginAccount ? loginAccount.value.trim() : '',
        password: loginPassword ? loginPassword.value : '',
        captchaId: loginCaptchaId ? loginCaptchaId.value.trim() : '',
        captchaCode: loginCaptchaInput ? loginCaptchaInput.value.trim() : '',
      });

      applyAuth(authData);
      setFeedback('login', '登录成功，正在跳转...', true);
      window.setTimeout(() => {
        window.location.href = postLoginRedirect;
      }, 420);
    } catch (error) {
      setFeedback('login', error && error.message ? error.message : '登录失败，请稍后重试。', false);
      await refreshLoginCaptcha(false);
    }
  });

  void refreshLoginCaptcha(true);
}

if (registerConfirm) {
  registerConfirm.addEventListener('input', () => registerConfirm.setCustomValidity(''));
}

if (registerEmailCode) {
  registerEmailCode.addEventListener('input', () => {
    registerEmailCode.value = registerEmailCode.value.replace(/\D/g, '').slice(0, 6);
    registerEmailCode.setCustomValidity('');
  });
}

if (sendRegisterEmailCodeButton) {
  renderRegisterEmailCodeButton();
  sendRegisterEmailCodeButton.addEventListener('click', async () => {
    if (registerEmailCodeCountdown > 0) {
      return;
    }

    const email = registerEmail ? registerEmail.value.trim() : '';
    if (!REGISTER_EMAIL_PATTERN.test(email)) {
      if (registerEmail) {
        registerEmail.reportValidity();
      }
      setFeedback('register', '请先输入有效邮箱后再发送验证码。', false);
      return;
    }

    try {
      ensureApi();
      await api.post('/auth/register/email-code', { email });
      setFeedback('register', '邮箱验证码已发送，请注意查收。', true);
      startRegisterEmailCodeCountdown();
    } catch (error) {
      setFeedback(
        'register',
        error && error.message ? error.message : '发送邮箱验证码失败，请稍后重试。',
        false
      );
    }
  });
}

if (registerForm) {
  registerForm.addEventListener('input', () => setFeedback('register', '', false));

  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!registerForm.checkValidity()) {
      registerForm.reportValidity();
      setFeedback('register', '请填写完整注册信息。', false);
      return;
    }

    if (registerPassword && registerConfirm && registerPassword.value !== registerConfirm.value) {
      registerConfirm.setCustomValidity('两次输入的密码不一致');
      registerConfirm.reportValidity();
      setFeedback('register', '两次输入密码不一致，请重新确认。', false);
      return;
    }

    try {
      ensureApi();
      const authData = await api.post('/auth/register', {
        username: registerName ? registerName.value.trim() : '',
        email: registerEmail ? registerEmail.value.trim() : '',
        password: registerPassword ? registerPassword.value : '',
        emailCode: registerEmailCode ? registerEmailCode.value.trim() : '',
      });

      applyAuth(authData);
      setFeedback('register', '注册成功，已自动登录，正在跳转...', true);
      window.setTimeout(() => {
        window.location.href = postLoginRedirect;
      }, 480);
    } catch (error) {
      setFeedback('register', error && error.message ? error.message : '注册失败，请稍后重试。', false);
    }
  });
}

const queryTab = queryParams.get('tab');
activateTab(queryTab, false);
