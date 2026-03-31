(function () {
  const API_BASE_KEY = 'techvibe_api_base';
  const DEFAULT_BASE = '/api';
  const TOKEN_KEY = 'techvibe_token';

  function safeRead(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function normalizeBase(base) {
    const value = String(base || '').trim();
    if (!value) return DEFAULT_BASE;
    return value.endsWith('/') ? value.slice(0, -1) : value;
  }

  function getBaseUrl() {
    return normalizeBase(safeRead(API_BASE_KEY) || DEFAULT_BASE);
  }

  function getToken() {
    return safeRead(TOKEN_KEY) || '';
  }

  async function request(path, options) {
    const opts = options || {};
    const method = opts.method || 'GET';
    const headers = { ...(opts.headers || {}) };

    if (!(opts.body instanceof FormData)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    if (opts.auth) {
      const token = getToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    let response;
    try {
      response = await fetch(getBaseUrl() + path, {
        method,
        headers,
        body: opts.body,
      });
    } catch (error) {
      const networkError = new Error('network request failed');
      networkError.code = 'NETWORK_ERROR';
      networkError.cause = error;
      throw networkError;
    }

    let payload = null;
    let jsonParseError = null;
    try {
      payload = await response.json();
    } catch (error) {
      jsonParseError = error;
      payload = null;
    }

    if (!response.ok) {
      const message = payload && payload.message ? payload.message : `request failed: ${response.status}`;
      const requestError = new Error(message);
      requestError.status = response.status;
      throw requestError;
    }

    if (jsonParseError && payload === null) {
      console.warn('[TechVibeApi] 响应解析为 JSON 失败，尝试获取文本:', getBaseUrl() + path);
      try {
        const text = await response.text();
        console.warn('[TechVibeApi] 响应内容 (前500字符):', text.substring(0, 500));
      } catch {
        // Ignore
      }
    }

    if (payload && typeof payload.success === 'boolean') {
      if (!payload.success) {
        throw new Error(payload.message || 'request failed');
      }
      return payload.data;
    }

    return payload;
  }

  window.TechVibeApi = {
    keys: {
      apiBase: API_BASE_KEY,
      token: TOKEN_KEY,
    },
    getBaseUrl,
    getToken,
    setBaseUrl(baseUrl) {
      try {
        window.localStorage.setItem(API_BASE_KEY, normalizeBase(baseUrl));
      } catch {
        // Ignore write errors.
      }
    },
    request,
    get(path, opts) {
      return request(path, { ...(opts || {}), method: 'GET' });
    },
    post(path, body, opts) {
      return request(path, {
        ...(opts || {}),
        method: 'POST',
        body: body == null ? null : JSON.stringify(body),
      });
    },
    put(path, body, opts) {
      return request(path, {
        ...(opts || {}),
        method: 'PUT',
        body: body == null ? null : JSON.stringify(body),
      });
    },
    postForm(path, formData, opts) {
      return request(path, {
        ...(opts || {}),
        method: 'POST',
        body: formData,
      });
    },
  };
})();
