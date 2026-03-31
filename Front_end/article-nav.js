(function () {
  function isInteractiveTarget(target) {
    return Boolean(target && target.closest('a, button, input, textarea, select, label, summary'));
  }

  function resolveHref(element) {
    let href = element.dataset.articleLink;
    if (!href) {
      return '';
    }

    if (/article-detail\.html(?:$|\?)/.test(href) && !/[?&]id=/.test(href)) {
      const articleId = String(element.dataset.articleId || '1').trim() || '1';
      const separator = href.includes('?') ? '&' : '?';
      href = `${href}${separator}id=${encodeURIComponent(articleId)}`;
    }

    return href;
  }

  function navigateToArticle(element) {
    const href = resolveHref(element);
    if (!href) {
      return;
    }
    window.location.href = href;
  }

  function toArray(nodeList) {
    return Array.prototype.slice.call(nodeList || []);
  }

  function collectArticleElements(root) {
    if (!root) {
      return [];
    }

    const elements = [];

    if (root instanceof Element && root.matches('[data-article-link]')) {
      elements.push(root);
    }

    if (root.querySelectorAll) {
      elements.push(...toArray(root.querySelectorAll('[data-article-link]')));
    }

    return elements;
  }

  function decorateArticleLinks(root) {
    collectArticleElements(root || document).forEach((article) => {
      if (!article.hasAttribute('tabindex')) {
        article.tabIndex = 0;
      }
      article.setAttribute('role', 'link');
    });
  }

  function findArticleElement(target) {
    if (!target || typeof target.closest !== 'function') {
      return null;
    }
    return target.closest('[data-article-link]');
  }

  document.addEventListener('click', (event) => {
    const article = findArticleElement(event.target);
    if (!article || isInteractiveTarget(event.target)) {
      return;
    }
    navigateToArticle(article);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    const article = findArticleElement(event.target);
    if (!article) {
      return;
    }

    if (isInteractiveTarget(event.target) && event.target !== article) {
      return;
    }

    event.preventDefault();
    navigateToArticle(article);
  });

  function init() {
    decorateArticleLinks(document);

    if (!document.body || typeof MutationObserver === 'undefined') {
      return;
    }

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            decorateArticleLinks(node);
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.TechVibeArticleNav = {
    refresh(root) {
      decorateArticleLinks(root || document);
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
