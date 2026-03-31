const summaryInput = document.getElementById('summary-input');
const summaryCount = document.getElementById('summary-count');
const seoInput = document.getElementById('seo-input');
const seoCount = document.getElementById('seo-count');
const titleInput = document.getElementById('article-title');
const categoryInput = document.getElementById('category-input');
const editorCanvas = document.querySelector('.editor-canvas');
const modeText = document.getElementById('editor-mode-text');
const tagInput = document.getElementById('tag-input');
const tagList = document.getElementById('tag-list');
const toolbar = document.querySelector('.toolbar');
const blockStyleSelect = toolbar ? toolbar.querySelector('select') : null;
const toolbarButtons = Array.from(document.querySelectorAll('.toolbar button[data-toggle]'));
const coverInput = document.getElementById('cover-input');
const coverUploadText = document.getElementById('cover-upload-text');
const coverPreview = document.getElementById('cover-preview');
const articleImageInput = document.getElementById('article-image-input');
const articleImageText = document.getElementById('image-upload-text');
const editorDialog = document.getElementById('editor-dialog');
const editorDialogTitle = document.getElementById('editor-dialog-title');
const editorDialogMessage = document.getElementById('editor-dialog-message');
const editorDialogCancel = document.getElementById('editor-dialog-cancel');
const editorDialogConfirm = document.getElementById('editor-dialog-confirm');
const previewModal = document.getElementById('editor-preview-modal');
const previewCloseButton = document.getElementById('preview-close-btn');
const previewTitle = document.getElementById('preview-article-title');
const previewSummary = document.getElementById('preview-article-summary');
const previewMeta = document.getElementById('preview-article-meta');
const previewBody = document.getElementById('preview-article-body');
const editorToast = document.getElementById('editor-toast');
const goBackButton = document.getElementById('go-back-btn');
const saveDraftButton = document.getElementById('save-draft-btn');
const previewButton = document.getElementById('preview-btn');
const publishButton = document.querySelector('.editor-actions .primary-btn');
const publishTimeInput = document.getElementById('publish-time');

const imageSizeDialog = document.getElementById('image-size-dialog');
const imageWidthInput = document.getElementById('image-width-input');
const imageHeightInput = document.getElementById('image-height-input');
const imageRatioLock = document.getElementById('image-ratio-lock');
const imageSizePreview = document.getElementById('image-size-preview');
const imageDialogCancel = document.getElementById('image-dialog-cancel');
const imageDialogReset = document.getElementById('image-dialog-reset');
const imageDialogConfirm = document.getElementById('image-dialog-confirm');
const editorContextMenu = document.getElementById('editor-context-menu');

const api = window.TechVibeApi || null;
const sessionApi = window.TechVibeSession || null;
const ADMIN_USERNAME = 'admin';
const STATUS_DRAFT = 'draft';
const STATUS_PUBLISHED = 'published';
const ESSAY_CATEGORY = '随笔';
const SITE_NAME = '笔落客';

const queryParams = new URLSearchParams(window.location.search);
const parsedArticleId = Number(queryParams.get('id'));
const articleId = Number.isFinite(parsedArticleId) && parsedArticleId > 0 ? parsedArticleId : null;
const isEditMode = articleId !== null;
const createMode = String(queryParams.get('mode') || '').trim().toLowerCase();
const isEssayCreateMode = !isEditMode && createMode === 'essay';
let currentCoverImage = '';
let currentArticleCategory = '';
let savedEditorRange = null;
let activeDialogResolver = null;
let selectedEditorImage = null;
let imageResizeHandle = null;
let imageResizeFrame = null;
let activeImageResizeState = null;
let toastTimer = 0;
let savedContentSnapshot = null;
let contentSaved = false;
let categoriesLoaded = false;

const INLINE_COMMANDS = {
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  strike: 'strikeThrough',
  left: 'justifyLeft',
  center: 'justifyCenter',
  right: 'justifyRight',
};

const BLOCK_TAGS = ['P', 'H1', 'H2', 'BLOCKQUOTE'];
const TOP_LEVEL_BLOCK_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'TABLE', 'UL', 'OL']);
const floatingToolbar = createFloatingToolbar();
const floatingBlockStyleSelect = floatingToolbar ? floatingToolbar.querySelector('select[data-role="block-style"]') : null;
const floatingTableActions = floatingToolbar ? floatingToolbar.querySelector('[data-role="table-actions"]') : null;
const floatingToolbarButtons = floatingToolbar
  ? Array.from(floatingToolbar.querySelectorAll('button[data-toggle]'))
  : [];
const allToolbarButtons = [...toolbarButtons, ...floatingToolbarButtons];

function createFloatingToolbar() {
  const wrap = document.createElement('div');
  wrap.className = 'selection-toolbar';
  wrap.hidden = true;
  wrap.setAttribute('aria-label', '选中文本样式工具');

  wrap.innerHTML = [
    '<select data-role="block-style" aria-label="文本块样式">',
    '<option value="P">正文</option>',
    '<option value="H1">标题1</option>',
    '<option value="H2">标题2</option>',
    '</select>',
    '<span class="sep" aria-hidden="true"></span>',
    '<button type="button" data-toggle="bold" aria-label="Bold">B</button>',
    '<button type="button" data-toggle="italic" aria-label="Italic">I</button>',
    '<button type="button" data-toggle="underline" aria-label="Underline">U</button>',
    '<button type="button" data-toggle="strike" aria-label="Strike">S</button>',
    '<span class="sep" aria-hidden="true"></span>',
    '<button type="button" data-toggle="code" aria-label="代码块">{ }</button>',
    '<button type="button" data-toggle="link" aria-label="插入链接">链接</button>',
    '<span class="sep" aria-hidden="true"></span>',
    '<button type="button" data-toggle="table" aria-label="插入表格">表格</button>',
    '<span data-role="table-actions" hidden>',
    '<button type="button" data-toggle="table-add-row" aria-label="新增表格行">+行</button>',
    '<button type="button" data-toggle="table-add-col" aria-label="新增表格列">+列</button>',
    '<button type="button" data-toggle="table-del-row" aria-label="删除表格行">-行</button>',
    '<button type="button" data-toggle="table-del-col" aria-label="删除表格列">-列</button>',
    '</span>',
  ].join('');

  document.body.appendChild(wrap);
  return wrap;
}

function isRangeInEditor(range) {
  if (!editorCanvas || !range) {
    return false;
  }
  return editorCanvas.contains(range.commonAncestorContainer);
}

function saveEditorSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }
  const range = selection.getRangeAt(0);
  if (!isRangeInEditor(range)) {
    return;
  }
  savedEditorRange = range.cloneRange();
}

function restoreEditorSelection() {
  if (!savedEditorRange) {
    return false;
  }
  const selection = window.getSelection();
  if (!selection) {
    return false;
  }
  selection.removeAllRanges();
  selection.addRange(savedEditorRange);
  return true;
}

function focusEditor() {
  if (editorCanvas) {
    editorCanvas.focus();
  }
}

function safeQueryCommandState(command) {
  try {
    return Boolean(document.queryCommandState(command));
  } catch {
    return false;
  }
}

function getToolbarButton(toggle) {
  return toolbarButtons.find((button) => button.dataset.toggle === toggle) || null;
}

function normalizeHttpUrl(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) {
    return '';
  }
  if (/^(https?:\/\/|mailto:|tel:)/i.test(value)) {
    return value;
  }
  return `https://${value}`;
}

function showToast(message, type) {
  if (!editorToast) {
    return;
  }
  editorToast.textContent = String(message || '操作完成');
  editorToast.hidden = false;
  editorToast.classList.remove('success', 'error');
  if (type === 'success' || type === 'error') {
    editorToast.classList.add(type);
  }
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    editorToast.hidden = true;
  }, 2200);
}

function setCoverUploadLabel(text, title) {
  if (!coverUploadText) {
    return;
  }
  coverUploadText.textContent = String(text || '上传封面图');
  coverUploadText.title = String(title || '');
}

function renderCoverPreview(url) {
  if (!coverPreview) {
    return;
  }

  const normalizedUrl = String(url || '').trim();
  const uploader = coverPreview.closest('.cover-uploader');

  if (!normalizedUrl) {
    coverPreview.hidden = true;
    coverPreview.removeAttribute('src');
    if (uploader) {
      uploader.classList.remove('has-preview');
    }
    return;
  }

  coverPreview.hidden = false;
  coverPreview.src = normalizedUrl;
  if (uploader) {
    uploader.classList.add('has-preview');
  }
}

function hasDialogSupport() {
  return Boolean(editorDialog && editorDialogTitle && editorDialogMessage && editorDialogCancel && editorDialogConfirm);
}

function closeDialog(result) {
  if (!hasDialogSupport() || !activeDialogResolver) {
    return;
  }
  const resolver = activeDialogResolver;
  activeDialogResolver = null;
  editorDialog.hidden = true;
  resolver(Boolean(result));
}

function bindDialogEvents() {
  if (!hasDialogSupport() || editorDialog.dataset.bound === '1') {
    return;
  }
  editorDialog.dataset.bound = '1';

  editorDialog.addEventListener('click', (event) => {
    const closeTarget = event.target.closest('[data-role="dialog-close"]');
    if (!closeTarget) {
      return;
    }
    closeDialog(false);
  });

  editorDialogCancel.addEventListener('click', () => closeDialog(false));
  editorDialogConfirm.addEventListener('click', () => closeDialog(true));

  document.addEventListener('keydown', (event) => {
    if (!activeDialogResolver || editorDialog.hidden) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDialog(false);
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      closeDialog(true);
    }
  });
}

function confirmAction({ title, message, confirmText = '确认', cancelText = '取消' }) {
  if (!hasDialogSupport()) {
    return Promise.resolve(window.confirm(message || '确定要继续吗？'));
  }
  if (activeDialogResolver) {
    closeDialog(false);
  }
  editorDialogTitle.textContent = String(title || '提示');
  editorDialogMessage.textContent = String(message || '');
  editorDialogCancel.textContent = String(cancelText);
  editorDialogConfirm.textContent = String(confirmText);
  editorDialog.hidden = false;
  window.setTimeout(() => editorDialogConfirm.focus(), 0);
  return new Promise((resolve) => {
    activeDialogResolver = resolve;
  });
}

function openPreviewModal(preview) {
  if (!previewModal || !previewTitle || !previewSummary || !previewMeta || !previewBody) {
    return;
  }

  previewTitle.textContent = String(preview && preview.title ? preview.title : '未命名文章');
  previewSummary.textContent = String(preview && preview.summary ? preview.summary : '');
  previewSummary.hidden = !String(previewSummary.textContent || '').trim();

  const metaItems = [];
  const category = String(preview && preview.category ? preview.category : '').trim();
  const status = String(preview && preview.status ? preview.status : '').trim();

  if (category) {
    metaItems.push(`<span>分类：${category}</span>`);
  }
  if (status) {
    metaItems.push(`<span>状态：${status === STATUS_DRAFT ? '草稿' : '已发布'}</span>`);
  }

  previewMeta.innerHTML = metaItems.join('');
  previewBody.innerHTML = String(preview && preview.content ? preview.content : '<p><br></p>');
  previewModal.hidden = false;
}

function closePreviewModal() {
  if (previewModal) {
    previewModal.hidden = true;
  }
}

function bindPreviewEvents() {
  if (!previewModal || previewModal.dataset.bound === '1') {
    return;
  }
  previewModal.dataset.bound = '1';
  previewModal.addEventListener('click', (event) => {
    const closeTarget = event.target.closest('[data-role="preview-close"]');
    if (!closeTarget) {
      return;
    }
    closePreviewModal();
  });
  if (previewCloseButton) {
    previewCloseButton.addEventListener('click', closePreviewModal);
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && previewModal && !previewModal.hidden) {
      closePreviewModal();
    }
  });
}

function isSelectionInsideCodeBlock() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return false;
  }
  const range = selection.getRangeAt(0);
  if (!isRangeInEditor(range)) {
    return false;
  }

  let node = range.commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentNode;
  }

  while (node && node !== editorCanvas) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName;
      if (tag === 'PRE' || tag === 'CODE') {
        return true;
      }
    }
    node = node.parentNode;
  }
  return false;
}

function getClosestEditorElement(range, selector) {
  if (!range) {
    return null;
  }

  let node = range.startContainer;
  if (node && node.nodeType === Node.TEXT_NODE) {
    node = node.parentNode;
  }

  while (node && node !== editorCanvas) {
    if (node.nodeType === Node.ELEMENT_NODE && node.matches(selector)) {
      return node;
    }
    node = node.parentNode;
  }
  return null;
}

function getActiveBlockTag() {
  const range = getActiveEditorRange();
  if (!range) {
    return 'P';
  }

  const blockNode = getClosestEditorElement(range, 'h1, h2, blockquote, p');
  const tag = blockNode && blockNode.tagName ? blockNode.tagName.toUpperCase() : 'P';
  return BLOCK_TAGS.includes(tag) ? tag : 'P';
}

function getCurrentTableCell(range) {
  const activeRange = range || getActiveEditorRange();
  if (!activeRange) {
    return null;
  }
  return getClosestEditorElement(activeRange, 'td, th');
}

function isSelectionInsideTable(range) {
  return Boolean(getCurrentTableCell(range));
}

function syncBlockStyleControls() {
  const blockTag = getActiveBlockTag();
  const tagIndex = BLOCK_TAGS.indexOf(blockTag);

  if (blockStyleSelect && tagIndex >= 0 && blockStyleSelect.selectedIndex !== tagIndex) {
    blockStyleSelect.selectedIndex = tagIndex;
  }

  if (floatingBlockStyleSelect && floatingBlockStyleSelect.value !== blockTag) {
    floatingBlockStyleSelect.value = blockTag;
  }
}

function syncTableActionControls(range) {
  const inTable = isSelectionInsideTable(range);
  allToolbarButtons.forEach((button) => {
    const toggle = button.dataset.toggle || '';
    if (toggle === 'table-add-row' || toggle === 'table-add-col' || toggle === 'table-del-row' || toggle === 'table-del-col') {
      button.disabled = !inTable;
      button.classList.toggle('is-disabled', !inTable);
    }
  });

  if (floatingTableActions) {
    floatingTableActions.hidden = !inTable;
  }
}

function getActiveEditorRange() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!isRangeInEditor(range)) {
    return null;
  }
  return range;
}

function hideFloatingToolbar() {
  if (!floatingToolbar) {
    return;
  }
  floatingToolbar.hidden = true;
}

function getRangeDisplayRect(range) {
  if (!range) {
    return null;
  }

  const rects = Array.from(range.getClientRects() || []);
  const validRect = rects.find((item) => item.width > 0 || item.height > 0);
  if (validRect) {
    return validRect;
  }

  const bounding = range.getBoundingClientRect();
  if (!bounding || (bounding.width <= 0 && bounding.height <= 0)) {
    return null;
  }
  return bounding;
}

function positionFloatingToolbar(range) {
  if (!floatingToolbar || !range) {
    return;
  }

  const rect = getRangeDisplayRect(range);
  if (!rect) {
    hideFloatingToolbar();
    return;
  }

  floatingToolbar.hidden = false;
  const toolbarRect = floatingToolbar.getBoundingClientRect();

  const gap = 10;
  const minLeft = 8;
  const maxLeft = window.innerWidth - toolbarRect.width - 8;
  const preferredLeft = rect.left + rect.width / 2 - toolbarRect.width / 2;
  const left = Math.max(minLeft, Math.min(preferredLeft, maxLeft));

  const aboveTop = rect.top - toolbarRect.height - gap;
  const belowTop = rect.bottom + gap;
  const top = aboveTop < 8 ? belowTop : aboveTop;

  floatingToolbar.style.left = `${Math.round(left)}px`;
  floatingToolbar.style.top = `${Math.round(top)}px`;
}

function positionFloatingToolbarAtSelection() {
  if (!floatingToolbar) {
    return;
  }

  const range = getActiveEditorRange();
  const cell = getCurrentTableCell(range);
  if (!cell) {
    hideFloatingToolbar();
    return;
  }

  floatingToolbar.hidden = false;
  const toolbarRect = floatingToolbar.getBoundingClientRect();
  const cellRect = cell.getBoundingClientRect();

  const gap = 10;
  const minLeft = 8;
  const maxLeft = window.innerWidth - toolbarRect.width - 8;
  const preferredLeft = cellRect.left + cellRect.width / 2 - toolbarRect.width / 2;
  const left = Math.max(minLeft, Math.min(preferredLeft, maxLeft));

  const aboveTop = cellRect.top - toolbarRect.height - gap;
  const belowTop = cellRect.bottom + gap;
  const top = aboveTop < 8 ? belowTop : aboveTop;

  floatingToolbar.style.left = `${Math.round(left)}px`;
  floatingToolbar.style.top = `${Math.round(top)}px`;
}

function updateFloatingToolbar() {
  const range = getActiveEditorRange();
  const inTable = isSelectionInsideTable(range);
  const hasSelectedText = Boolean(!range?.collapsed && String(range?.toString() || '').trim());

  if (!range || (!hasSelectedText && !inTable)) {
    hideFloatingToolbar();
    syncTableActionControls(range);
    return;
  }

  syncTableActionControls(range);
  if (inTable) {
    positionFloatingToolbarAtSelection();
  } else {
    positionFloatingToolbar(range);
  }
}

function syncToolbarState() {
  if (!allToolbarButtons.length) {
    syncBlockStyleControls();
    const range = getActiveEditorRange();
    syncTableActionControls(range);
    return;
  }

  allToolbarButtons.forEach((button) => {
    const toggle = button.dataset.toggle || '';
    if (toggle === 'code') {
      button.classList.toggle('active', isSelectionInsideCodeBlock());
      return;
    }

    const command = INLINE_COMMANDS[toggle];
    if (!command) {
      return;
    }
    button.classList.toggle('active', safeQueryCommandState(command));
  });

  syncBlockStyleControls();
  const range = getActiveEditorRange();
  syncTableActionControls(range);
}

function runEditorCommand(command, value) {
  if (!editorCanvas) {
    return false;
  }

  focusEditor();
  restoreEditorSelection();
  const commandValue = value == null ? null : value;

  let succeeded = false;
  try {
    succeeded = document.execCommand(command, false, commandValue);
  } catch {
    succeeded = false;
  }

  saveEditorSelection();
  syncToolbarState();
  updateFloatingToolbar();
  return succeeded;
}

function ensureDefaultParagraphSeparator() {
  try {
    document.execCommand('defaultParagraphSeparator', false, 'p');
  } catch {
    // Ignore unsupported browsers.
  }
}

function ensureEditorRootAsParagraph() {
  if (!editorCanvas) {
    return;
  }

  const currentText = String(editorCanvas.textContent || '').trim();
  if (!currentText && editorCanvas.childNodes.length === 0) {
    editorCanvas.innerHTML = '<p><br></p>';
    return;
  }

  const nodes = Array.from(editorCanvas.childNodes);
  const hasTopLevelBlock = nodes.some((node) => {
    return node.nodeType === Node.ELEMENT_NODE && TOP_LEVEL_BLOCK_TAGS.has(node.tagName);
  });

  if (hasTopLevelBlock) {
    return;
  }

  const paragraph = document.createElement('p');
  nodes.forEach((node) => paragraph.appendChild(node));
  if (!String(paragraph.textContent || '').trim()) {
    paragraph.innerHTML = '<br>';
  }

  editorCanvas.innerHTML = '';
  editorCanvas.appendChild(paragraph);
}

function applyBlockStyleByTag(tagName) {
  const targetTag = String(tagName || '').toUpperCase();
  const blockTag = BLOCK_TAGS.includes(targetTag) ? targetTag : 'P';

  if (!editorCanvas) {
    return;
  }

  focusEditor();
  restoreEditorSelection();
  const range = getActiveEditorRange();
  if (!range) {
    runEditorCommand('formatBlock', blockTag);
    return;
  }

  const selectedText = String(range.toString() || '').trim();
  if (range.collapsed || !selectedText || blockTag === 'P' || isSelectionInsideTable(range) || isSelectionInsideCodeBlock()) {
    runEditorCommand('formatBlock', blockTag);
    return;
  }

  const block = document.createElement(blockTag.toLowerCase());
  const fragment = range.extractContents();
  block.appendChild(fragment);
  if (!String(block.textContent || '').trim()) {
    block.innerHTML = '<br>';
  }

  range.insertNode(block);

  const selection = window.getSelection();
  if (selection) {
    const nextRange = document.createRange();
    nextRange.selectNodeContents(block);
    nextRange.collapse(false);
    selection.removeAllRanges();
    selection.addRange(nextRange);
  }

  saveEditorSelection();
  syncToolbarState();
  updateFloatingToolbar();
}

function applyBlockStyleByIndex(index) {
  applyBlockStyleByTag(BLOCK_TAGS[index] || 'P');
}

function insertCodeBlock() {
  if (!editorCanvas) {
    return;
  }

  focusEditor();
  restoreEditorSelection();

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  if (!isRangeInEditor(range)) {
    return;
  }

  const pre = document.createElement('pre');
  const code = document.createElement('code');

  if (range.collapsed) {
    code.textContent = '// Enter code here';
  } else {
    const fragment = range.extractContents();
    const textContent = extractTextFromFragment(fragment);
    code.textContent = textContent || '// Enter code here';
  }

  pre.appendChild(code);
  range.insertNode(pre);

  const trailingParagraph = document.createElement('p');
  trailingParagraph.innerHTML = '<br>';
  pre.insertAdjacentElement('afterend', trailingParagraph);

  const nextRange = document.createRange();
  nextRange.selectNodeContents(code);
  nextRange.collapse(false);

  selection.removeAllRanges();
  selection.addRange(nextRange);
  saveEditorSelection();
  syncToolbarState();
  updateFloatingToolbar();
}

function extractTextFromFragment(fragment) {
  const lines = [];
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null, false);
  let currentNode = walker.currentNode;

  while (currentNode) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      const text = currentNode.textContent || '';
      if (text.trim() || text.includes('\n')) {
        lines.push(text);
      }
    } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
      const tagName = currentNode.tagName.toLowerCase();
      if (tagName === 'br') {
        lines.push('\n');
      } else if (['p', 'div', 'li', 'tr'].includes(tagName)) {
        if (lines.length > 0 && !lines[lines.length - 1].endsWith('\n')) {
          lines.push('\n');
        }
      }
    }
    currentNode = walker.nextNode();
  }

  let result = lines.join('');
  result = result.replace(/\r\n/g, '\n');
  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.replace(/^\n+/, '');
  result = result.replace(/\n+$/, '');
  
  return result;
}

function insertSimpleTable() {
  const canvasWidth = editorCanvas ? editorCanvas.clientWidth - 40 : 800;
  const columnCount = 3;
  const columnWidth = Math.floor(canvasWidth / columnCount);
  const tableWidth = columnWidth * columnCount;

  runEditorCommand(
    'insertHTML',
    [
      `<table class="editor-table" style="width: ${tableWidth}px; max-width: 100%; table-layout: fixed;">`,
      `<thead><tr><th style="width: ${columnWidth}px; min-width: 40px;">标题1</th><th style="width: ${columnWidth}px; min-width: 40px;">标题2</th><th style="width: ${columnWidth}px; min-width: 40px;">标题3</th></tr></thead>`,
      `<tbody><tr><td style="width: ${columnWidth}px; min-width: 40px;">内容</td><td style="width: ${columnWidth}px; min-width: 40px;">内容</td><td style="width: ${columnWidth}px; min-width: 40px;">内容</td></tr></tbody>`,
      '</table>',
      '<p><br></p>',
    ].join('')
  );

  setTimeout(() => {
    const tables = editorCanvas.querySelectorAll('table.editor-table');
    if (tables.length > 0) {
      const lastTable = tables[tables.length - 1];
      if (lastTable.offsetWidth > canvasWidth) {
        lastTable.style.width = `${canvasWidth}px`;
      }
      const firstCell = lastTable.querySelector('tbody td');
      if (firstCell) {
        placeCaretInElement(firstCell);
      }
    }
    syncToolbarState();
    updateFloatingToolbar();
  }, 10);
}

function placeCaretInElement(element) {
  if (!element || !editorCanvas) {
    return;
  }

  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  saveEditorSelection();
}

function addTableRow() {
  focusEditor();
  restoreEditorSelection();

  const range = getActiveEditorRange();
  const cell = getCurrentTableCell(range);
  if (!cell) {
    showToast('请将光标放在表格单元格内', 'error');
    return;
  }

  const row = cell.parentElement;
  if (!row) {
    return;
  }

  const sourceCells = Array.from(row.children).filter((item) => item.tagName === 'TH' || item.tagName === 'TD');
  if (!sourceCells.length) {
    return;
  }

  const newRow = document.createElement('tr');
  sourceCells.forEach((sourceCell) => {
    const tagName = sourceCell.tagName === 'TH' ? 'TH' : 'TD';
    const nextCell = document.createElement(tagName);
    nextCell.innerHTML = '<br>';
    const sourceWidth = sourceCell.style.width || sourceCell.offsetWidth + 'px';
    const sourceMinWidth = sourceCell.style.minWidth || '40px';
    nextCell.style.width = sourceWidth;
    nextCell.style.minWidth = sourceMinWidth;
    newRow.appendChild(nextCell);
  });

  row.insertAdjacentElement('afterend', newRow);
  const targetIndex = Math.max(0, Math.min(cell.cellIndex, newRow.cells.length - 1));
  placeCaretInElement(newRow.cells[targetIndex]);
  syncToolbarState();
  updateFloatingToolbar();
}

function addTableColumn() {
  focusEditor();
  restoreEditorSelection();

  const range = getActiveEditorRange();
  const cell = getCurrentTableCell(range);
  if (!cell) {
    showToast('请将光标放在表格单元格内', 'error');
    return;
  }

  const table = cell.closest('table');
  if (!table) {
    return;
  }

  const insertIndex = cell.cellIndex + 1;
  const rows = Array.from(table.querySelectorAll('tr'));

  const firstRow = table.querySelector('tr');
  const columnCount = firstRow ? firstRow.cells.length : 0;

  if (columnCount < 1) {
    return;
  }

  const canvasWidth = editorCanvas ? editorCanvas.clientWidth - 40 : 800;
  const newColumnWidth = Math.max(40, Math.floor(canvasWidth / (columnCount + 1)));

  rows.forEach((row) => {
    const rowSection = row.parentElement ? row.parentElement.tagName : '';
    const tagName = rowSection === 'THEAD' ? 'TH' : 'TD';
    const newCell = document.createElement(tagName);
    newCell.innerHTML = '<br>';
    newCell.style.width = `${newColumnWidth}px`;
    newCell.style.minWidth = `${newColumnWidth}px`;

    const refCell = row.cells[insertIndex] || null;
    if (refCell) {
      row.insertBefore(newCell, refCell);
    } else {
      row.appendChild(newCell);
    }
  });

  const allRows = table.querySelectorAll('tr');
  allRows.forEach((row) => {
    for (let i = 0; i < row.cells.length; i++) {
      row.cells[i].style.width = `${newColumnWidth}px`;
      row.cells[i].style.minWidth = `${newColumnWidth}px`;
    }
  });

  table.style.width = `${newColumnWidth * (columnCount + 1)}px`;
  table.style.maxWidth = '100%';
  table.style.tableLayout = 'fixed';

  const currentRow = cell.parentElement;
  const targetCell = currentRow && currentRow.cells.length ? currentRow.cells[Math.min(insertIndex, currentRow.cells.length - 1)] : null;
  placeCaretInElement(targetCell);

  setTimeout(() => {
    if (table.offsetWidth > canvasWidth) {
      table.style.width = `${canvasWidth}px`;
    }
    table.style.maxWidth = '100%';
  }, 10);

  syncToolbarState();
  updateFloatingToolbar();
}

function deleteTableRow() {
  focusEditor();
  restoreEditorSelection();

  const range = getActiveEditorRange();
  const cell = getCurrentTableCell(range);
  if (!cell) {
    showToast('请将光标放在表格单元格内', 'error');
    return;
  }

  const row = cell.parentElement;
  const table = cell.closest('table');
  if (!row || !table) {
    return;
  }

  const tbody = table.querySelector('tbody');
  const thead = table.querySelector('thead');
  const totalBodyRows = tbody ? tbody.querySelectorAll('tr').length : 0;

  if (row.parentElement === thead) {
    showToast('不能删除表头行', 'error');
    return;
  }

  if (totalBodyRows <= 1) {
    showToast('表格至少需要保留一行', 'error');
    return;
  }

  const nextRow = row.nextElementSibling || row.previousElementSibling;
  row.remove();

  if (nextRow) {
    const targetCell = nextRow.cells[cell.cellIndex] || nextRow.cells[0];
    if (targetCell) {
      placeCaretInElement(targetCell);
    }
  }

  syncToolbarState();
  updateFloatingToolbar();
}

function deleteTableColumn() {
  focusEditor();
  restoreEditorSelection();

  const range = getActiveEditorRange();
  const cell = getCurrentTableCell(range);
  if (!cell) {
    showToast('请将光标放在表格单元格内', 'error');
    return;
  }

  const table = cell.closest('table');
  if (!table) {
    return;
  }

  const firstRow = table.querySelector('tr');
  const columnCount = firstRow ? firstRow.cells.length : 0;

  if (columnCount <= 1) {
    showToast('表格至少需要保留一列', 'error');
    return;
  }

  const deleteIndex = cell.cellIndex;
  const rows = Array.from(table.querySelectorAll('tr'));
  rows.forEach((row) => {
    const targetCell = row.cells[deleteIndex];
    if (targetCell) {
      targetCell.remove();
    }
  });

  const currentRow = cell.parentElement;
  const targetCell = currentRow && currentRow.cells.length ? currentRow.cells[Math.min(deleteIndex, currentRow.cells.length - 1)] : null;
  if (targetCell) {
    placeCaretInElement(targetCell);
  }

  syncToolbarState();
  updateFloatingToolbar();
}

function handleToolbarAction(toggle) {
  const command = INLINE_COMMANDS[toggle];
  if (command) {
    runEditorCommand(command);
    return;
  }

  if (toggle === 'link') {
    const rawUrl = window.prompt('Please enter a link URL');
    const url = normalizeHttpUrl(rawUrl);
    if (!url) {
      return;
    }
    runEditorCommand('createLink', url);
    return;
  }

  if (toggle === 'image') {
    articleImageInput.click();
    return;
  }

  if (toggle === 'table') {
    insertSimpleTable();
    return;
  }

  if (toggle === 'table-add-row') {
    addTableRow();
    return;
  }

  if (toggle === 'table-add-col') {
    addTableColumn();
    return;
  }

  if (toggle === 'table-del-row') {
    deleteTableRow();
    return;
  }

  if (toggle === 'table-del-col') {
    deleteTableColumn();
    return;
  }

  if (toggle === 'code') {
    insertCodeBlock();
  }
}

function bindCounter(input, counter, suffix) {
  if (!input || !counter) return;

  const max = input.maxLength > 0 ? input.maxLength : 0;
  const render = () => {
    counter.textContent = `${input.value.length}/${max}${suffix}`;
  };

  render();
  if (input.dataset.counterBound === '1') {
    return;
  }

  input.dataset.counterBound = '1';
  input.addEventListener('input', render);
}

function normalizeTag(raw) {
  return raw.trim().replace(/\s+/g, ' ');
}

function currentTags() {
  if (!tagList) return [];
  return Array.from(tagList.querySelectorAll('.tag-chip'))
    .map((node) => {
      const textNode = node.childNodes[0];
      return textNode ? String(textNode.textContent || '').trim() : '';
    })
    .filter(Boolean);
}

function removeTag(button) {
  const chip = button.closest('.tag-chip');
  if (chip) {
    chip.remove();
  }
}

function createTagChip(tag) {
  const safeTag = String(tag || '').trim();
  const chip = document.createElement('span');
  chip.className = 'tag-chip';

  const text = document.createTextNode(safeTag);
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.setAttribute('aria-label', `remove ${safeTag}`);
  removeBtn.textContent = 'x';
  removeBtn.addEventListener('click', () => removeTag(removeBtn));

  chip.appendChild(text);
  chip.appendChild(removeBtn);
  return chip;
}

function setTagList(tags) {
  if (!tagList) return;
  tagList.innerHTML = '';
  const list = Array.isArray(tags) ? tags : [];
  list.forEach((tag) => {
    const value = String(tag || '').trim();
    if (!value) return;
    tagList.appendChild(createTagChip(value));
  });
}

function addTagFromInput() {
  if (!tagInput || !tagList) return;
  const nextTag = normalizeTag(tagInput.value);
  if (!nextTag) return;

  const tags = currentTags();
  if (tags.includes(nextTag) || tags.length >= 8) {
    tagInput.value = '';
    return;
  }

  tagList.appendChild(createTagChip(nextTag));
  tagInput.value = '';
}

function isAuthed() {
  return Boolean(sessionApi && typeof sessionApi.isAuthed === 'function' && sessionApi.isAuthed());
}

function getProfile() {
  if (!sessionApi || typeof sessionApi.getProfile !== 'function') {
    return null;
  }
  return sessionApi.getProfile();
}

function isAdmin(profile) {
  const name = String((profile && profile.name) || '').trim().toLowerCase();
  return name === ADMIN_USERNAME;
}

function redirectToLogin() {
  const currentPage = window.location.pathname.split('/').pop() || 'article-edit.html';
  const redirectPath = isEditMode
    ? `${currentPage}?id=${articleId}`
    : (isEssayCreateMode ? `${currentPage}?mode=essay` : currentPage);
  const redirect = encodeURIComponent(redirectPath);
  window.location.href = `./auth.html?tab=login&redirect=${redirect}`;
}

function navigateBackToPreviousPage() {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  window.location.href = './category.html';
}

function navigateToHomePage() {
  window.location.href = './index.html';
}

function navigateAfterDraftSave(mode) {
  if (mode === 'home') {
    navigateToHomePage();
    return;
  }
  navigateBackToPreviousPage();
}

async function loadCategories() {
  if (!api || !categoryInput) {
    return;
  }
  try {
    const categories = await api.get('/categories');
    if (!Array.isArray(categories) || !categories.length) {
      return;
    }
    const currentValue = categoryInput.value;
    categoryInput.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '请选择分类';
    categoryInput.appendChild(defaultOption);
    categories.forEach((cat) => {
      const name = String((cat && cat.name) || '').trim();
      if (!name) {
        return;
      }
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      categoryInput.appendChild(option);
    });
    if (currentValue) {
      const exists = Array.from(categoryInput.options).some((opt) => opt.value === currentValue);
      if (exists) {
        categoryInput.value = currentValue;
      }
    }
    categoriesLoaded = true;
  } catch (error) {
    console.warn('加载分类列表失败:', error);
  }
}

function ensureCategoryOption(categoryName) {
  if (!categoryInput || !categoryName) {
    return;
  }
  const name = String(categoryName).trim();
  if (!name) {
    return;
  }
  const exists = Array.from(categoryInput.options).some((opt) => opt.value === name);
  if (!exists) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    categoryInput.appendChild(option);
  }
}

function isEssayCategory(value) {
  return String(value || '').trim().toLowerCase() === ESSAY_CATEGORY;
}

function isEssayModeActive() {
  return isEssayCreateMode || isEssayCategory(currentArticleCategory);
}

function syncModeUI() {
  const essayMode = isEssayModeActive();
  const modeLabel = essayMode
    ? (isEditMode ? '编辑随笔' : '发布随笔')
    : (isEditMode ? '编辑文章' : '发布文章');
  if (modeText) {
    modeText.textContent = modeLabel;
  }
  document.title = `${SITE_NAME} - ${modeLabel}`;
  if (publishButton) {
    publishButton.textContent = essayMode ? '发布随笔' : '发布文章';
  }
}

function initPublishTimeInput() {
  if (!publishTimeInput) return;
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const minDateTime = now.toISOString().slice(0, 16);
  publishTimeInput.min = minDateTime;
}

function resetCreateDefaults() {
  if (titleInput) titleInput.value = '';
  if (summaryInput) summaryInput.value = '';
  if (seoInput) seoInput.value = '';
  if (editorCanvas) {
    editorCanvas.innerHTML = '<p><br></p>';
  }
  setCoverUploadLabel('上传封面图', '');
  renderCoverPreview('');
  setTagList([]);
  currentCoverImage = '';
  currentArticleCategory = isEssayCreateMode ? ESSAY_CATEGORY : '';
  if (categoryInput) {
    if (isEssayCreateMode) {
      ensureCategoryOption(ESSAY_CATEGORY);
    }
    categoryInput.disabled = isEssayCreateMode;
    if (isEssayCreateMode) {
      categoryInput.value = ESSAY_CATEGORY;
    }
  }
  ensureDefaultParagraphSeparator();
  ensureEditorRootAsParagraph();
  syncModeUI();
}

async function ensureEditorAccess() {
  if (!isAuthed()) {
    showToast('请先登录。', 'error');
    redirectToLogin();
    return false;
  }

  if (sessionApi && typeof sessionApi.refreshProfileFromServer === 'function') {
    await sessionApi.refreshProfileFromServer();
  }

  if (!isAuthed()) {
    showToast('登录状态已失效，请重新登录。', 'error');
    redirectToLogin();
    return false;
  }

  if (!isAdmin(getProfile())) {
    showToast('仅管理员可编辑或发布文章。', 'error');
    window.location.href = './index.html';
    return false;
  }

  return true;
}

async function loadArticle() {
  if (!api || !isEditMode || articleId == null) return;

  const article = await api.get(`/articles/${articleId}`, { auth: true });

  if (titleInput) titleInput.value = article.title || '';
  if (summaryInput) summaryInput.value = article.summary || '';
  if (seoInput) seoInput.value = article.title ? `${SITE_NAME} | ${article.title}` : '';
  if (editorCanvas && article.content != null) {
    editorCanvas.innerHTML = String(article.content);
  }
  ensureDefaultParagraphSeparator();
  ensureEditorRootAsParagraph();

  if (categoryInput) {
    categoryInput.disabled = false;
  }

  if (categoryInput && article.category) {
    ensureCategoryOption(article.category);
    categoryInput.value = article.category;
  }
  currentArticleCategory = categoryInput
    ? String(categoryInput.value || article.category || '').trim()
    : String(article.category || '').trim();
  syncModeUI();

  currentCoverImage = article.coverImage || '';
  if (article.coverImage) {
    setCoverUploadLabel('已上传封面图', article.coverImage);
    renderCoverPreview(article.coverImage);
  } else {
    setCoverUploadLabel('上传封面图', '');
    renderCoverPreview('');
  }

  setTagList(Array.isArray(article.tags) ? article.tags : []);

  if (publishTimeInput && article.publishTime) {
    const publishTime = new Date(article.publishTime);
    publishTime.setMinutes(publishTime.getMinutes() - publishTime.getTimezoneOffset());
    publishTimeInput.value = publishTime.toISOString().slice(0, 16);
    const now = new Date();
    if (publishTime > now) {
      publishTimeInput.min = publishTimeInput.min;
    } else {
      initPublishTimeInput();
    }
  }
}

function getContentSnapshot() {
  return {
    title: titleInput ? titleInput.value.trim() : '',
    summary: summaryInput ? summaryInput.value.trim() : '',
    content: editorCanvas ? editorCanvas.innerHTML.trim() : '',
    category: categoryInput ? String(categoryInput.value || '').trim() : '',
    coverImage: currentCoverImage,
    tags: currentTags(),
  };
}

function hasContentChanged() {
  if (contentSaved) {
    return false;
  }
  if (savedContentSnapshot === null) {
    return true;
  }
  const current = getContentSnapshot();
  return (
    current.title !== savedContentSnapshot.title ||
    current.summary !== savedContentSnapshot.summary ||
    current.content !== savedContentSnapshot.content ||
    current.category !== savedContentSnapshot.category ||
    current.coverImage !== savedContentSnapshot.coverImage ||
    JSON.stringify(current.tags) !== JSON.stringify(savedContentSnapshot.tags)
  );
}

function markContentSaved() {
  contentSaved = true;
  savedContentSnapshot = getContentSnapshot();
}

function saveInitialSnapshot() {
  savedContentSnapshot = getContentSnapshot();
  contentSaved = false;
}

function buildPayload(targetStatus) {
  const title = titleInput ? titleInput.value.trim() : '';
  const summary = summaryInput ? summaryInput.value.trim() : '';
  const selectedCategory = categoryInput ? String(categoryInput.value || '').trim() : '';
  const category = isEssayCreateMode ? ESSAY_CATEGORY : selectedCategory;
  const content = editorCanvas ? editorCanvas.innerHTML.trim() : '';
  const plainText = editorCanvas ? String(editorCanvas.textContent || '').trim() : '';
  const status = targetStatus === STATUS_DRAFT ? STATUS_DRAFT : STATUS_PUBLISHED;
  const publishTime = publishTimeInput ? publishTimeInput.value.trim() : null;

  if (status === STATUS_PUBLISHED && !title) {
    throw new Error('发布前请填写文章标题。');
  }
  if (status === STATUS_PUBLISHED && !plainText) {
    throw new Error('发布前请填写正文内容。');
  }
  if (status === STATUS_DRAFT && !title && !plainText) {
    throw new Error('保存草稿至少需要标题或正文内容。');
  }

  if (publishTime) {
    const selectedTime = new Date(publishTime);
    const now = new Date();
    if (selectedTime <= now) {
      throw new Error('发布时间必须晚于当前时间。');
    }
  }

  return {
    title,
    summary,
    content,
    category,
    coverImage: currentCoverImage,
    status,
    tags: currentTags(),
    publishTime: publishTime || null,
  };
}

async function saveArticle(targetStatus) {
  if (!api) {
    throw new Error('接口客户端不可用。');
  }

  if (!isAuthed()) {
    showToast('请先登录。', 'error');
    redirectToLogin();
    throw new Error('authorization required');
  }

  if (!isAdmin(getProfile())) {
    throw new Error('仅管理员可发布或编辑文章。');
  }

  const payload = buildPayload(targetStatus);
  if (isEditMode && articleId != null) {
    return api.put(`/articles/${articleId}`, payload, { auth: true });
  }
  return api.post('/articles', payload, { auth: true });
}

async function saveDraftAndReturn(mode) {
  const result = await saveArticle(STATUS_DRAFT);
  const createdId = Number(result && result.id);

  if (!isEditMode && Number.isFinite(createdId) && createdId > 0) {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('id', String(createdId));
    window.history.replaceState({}, '', newUrl.toString());
    window.location.href = newUrl.toString();
    return result;
  }

  showToast('草稿已保存。', 'success');
  markContentSaved();
  return result;
}

async function previewArticle() {
  if (!api) {
    throw new Error('接口客户端不可用。');
  }
  if (!isAuthed()) {
    showToast('请先登录。', 'error');
    redirectToLogin();
    throw new Error('authorization required');
  }
  if (!isAdmin(getProfile())) {
    throw new Error('仅管理员可预览文章。');
  }

  const payload = buildPayload(STATUS_PUBLISHED);
  return api.post('/articles/preview', payload, { auth: true });
}

async function uploadCoverFile(file) {
  if (!api) {
    throw new Error('接口客户端不可用。');
  }
  if (!file) {
    throw new Error('缺少封面文件。');
  }
  if (!isAuthed()) {
    showToast('请先登录。', 'error');
    redirectToLogin();
    throw new Error('authorization required');
  }
  if (!isAdmin(getProfile())) {
    throw new Error('仅管理员可上传封面图。');
  }
  if (!String(file.type || '').toLowerCase().startsWith('image/')) {
    throw new Error('封面文件必须是图片格式。');
  }

  const formData = new FormData();
  formData.append('file', file);
  const response = await api.postForm('/articles/cover', formData, { auth: true });
  const coverImage = String((response && response.coverImage) || '').trim();
  if (!coverImage) {
    throw new Error('封面上传成功，但未返回图片地址。');
  }

  return {
    coverImage,
    objectKey: String((response && response.objectKey) || '').trim(),
    fileName: String((response && response.fileName) || '').trim(),
  };
}

async function uploadImageToAliyun(file) {
  if (!api) {
    throw new Error('接口客户端不可用。');
  }
  if (!file) {
    throw new Error('缺少图片文件。');
  }
  if (!isAuthed()) {
    showToast('请先登录。', 'error');
    redirectToLogin();
    throw new Error('authorization required');
  }
  if (!isAdmin(getProfile())) {
    throw new Error('仅管理员可上传文章图片。');
  }
  if (!String(file.type || '').toLowerCase().startsWith('image/')) {
    throw new Error('图片文件必须是图片格式。');
  }

  const formData = new FormData();
  formData.append('file', file);
  const response = await api.postForm('/articles/image', formData, { auth: true });
  const imageUrl = String((response && response.imageUrl) || '').trim();
  if (!imageUrl) {
    throw new Error('图片上传成功，但未返回地址。');
  }
  return imageUrl;
}

if (tagInput) {
  tagInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTagFromInput();
    }
  });
  tagInput.addEventListener('blur', addTagFromInput);
}

if (tagList) {
  Array.from(tagList.querySelectorAll('.tag-chip button')).forEach((button) => {
    button.addEventListener('click', () => removeTag(button));
  });
}

if (editorCanvas) {
  ['mouseup', 'keyup', 'input'].forEach((eventName) => {
    editorCanvas.addEventListener(eventName, () => {
      saveEditorSelection();
      syncToolbarState();
      updateFloatingToolbar();
    });
  });

  editorCanvas.addEventListener('blur', () => {
    window.setTimeout(updateFloatingToolbar, 0);
  });

  editorCanvas.addEventListener('contextmenu', (event) => {
    if (!editorContextMenu) return;
    
    const target = event.target;
    const isInsideEditor = editorCanvas.contains(target);
    
    if (!isInsideEditor) {
      hideContextMenu();
      return;
    }
    
    event.preventDefault();
    showContextMenu(event.clientX, event.clientY);
  });
}

function showContextMenu(x, y) {
  if (!editorContextMenu) return;
  
  const menuWidth = 180;
  const menuHeight = 50;
  const padding = 10;
  
  let posX = x;
  let posY = y;
  
  if (posX + menuWidth > window.innerWidth - padding) {
    posX = window.innerWidth - menuWidth - padding;
  }
  if (posY + menuHeight > window.innerHeight - padding) {
    posY = window.innerHeight - menuHeight - padding;
  }
  
  editorContextMenu.style.left = `${posX}px`;
  editorContextMenu.style.top = `${posY}px`;
  editorContextMenu.hidden = false;
}

function hideContextMenu() {
  if (!editorContextMenu) return;
  editorContextMenu.hidden = true;
}

if (editorContextMenu) {
  editorContextMenu.addEventListener('click', async (event) => {
    const menuItem = event.target.closest('.context-menu-item');
    if (!menuItem) return;
    
    const action = menuItem.dataset.action;
    if (action === 'upload-image') {
      hideContextMenu();
      await handleContextMenuUploadImage();
    }
  });
}

async function handleContextMenuUploadImage() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/gif';
  
  input.onchange = async () => {
    const [file] = input.files || [];
    if (!file) return;
    
    try {
      showToast('正在上传图片...', 'info');
      const imageUrl = await uploadImageToAliyun(file);
      
      const canvasWidth = editorCanvas ? editorCanvas.clientWidth - 40 : 800;
      const maxWidth = Math.min(800, canvasWidth);
      
      const imageHtml = `
        <div class="editor-image-wrapper" style="text-align: center; margin: 16px 0;">
          <img src="${imageUrl}" alt="${file.name}" style="max-width: ${maxWidth}px; height: auto; display: block; margin: 0 auto;" />
        </div>
        <p><br></p>
      `;
      
      runEditorCommand('insertHTML', imageHtml);
      showToast('图片上传成功', 'success');
    } catch (error) {
      showToast(error && error.message ? error.message : '图片上传失败', 'error');
    }
  };
  
  input.click();
}

document.addEventListener('click', (event) => {
  if (editorContextMenu && !editorContextMenu.contains(event.target)) {
    hideContextMenu();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    hideContextMenu();
  }
});

document.addEventListener('selectionchange', () => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    hideFloatingToolbar();
    syncToolbarState();
    return;
  }
  const range = selection.getRangeAt(0);
  if (!isRangeInEditor(range)) {
    hideFloatingToolbar();
    syncToolbarState();
    return;
  }
  saveEditorSelection();
  syncToolbarState();
  updateFloatingToolbar();
});

if (blockStyleSelect) {
  blockStyleSelect.addEventListener('change', () => {
    applyBlockStyleByIndex(blockStyleSelect.selectedIndex);
  });
}

if (floatingBlockStyleSelect) {
  floatingBlockStyleSelect.addEventListener('change', () => {
    applyBlockStyleByTag(floatingBlockStyleSelect.value);
  });
}

allToolbarButtons.forEach((button) => {
  button.addEventListener('mousedown', (event) => {
    const toggle = button.dataset.toggle || '';
    if (toggle !== 'table-add-row' && toggle !== 'table-add-col' && toggle !== 'table-del-row' && toggle !== 'table-del-col') {
      event.preventDefault();
    }
  });
  button.addEventListener('click', () => {
    handleToolbarAction(button.dataset.toggle || '');
  });
});

if (categoryInput) {
  categoryInput.addEventListener('change', () => {
    currentArticleCategory = String(categoryInput.value || '').trim();
    syncModeUI();
  });
}

window.addEventListener('scroll', updateFloatingToolbar, true);
window.addEventListener('resize', updateFloatingToolbar);

if (coverInput && coverUploadText) {
  coverInput.addEventListener('change', async () => {
    const [file] = coverInput.files || [];
    if (!file) {
      if (!currentCoverImage) {
        setCoverUploadLabel('上传封面图', '');
        renderCoverPreview('');
      }
      return;
    }

    setCoverUploadLabel(`上传中：${file.name}`, '');
    try {
      const uploaded = await uploadCoverFile(file);
      currentCoverImage = uploaded.coverImage;
      renderCoverPreview(currentCoverImage);
      setCoverUploadLabel('封面上传完成', currentCoverImage);
      showToast('封面上传成功。', 'success');
    } catch (error) {
      if (currentCoverImage) {
        renderCoverPreview(currentCoverImage);
        setCoverUploadLabel('已上传封面图', currentCoverImage);
      } else {
        renderCoverPreview('');
        setCoverUploadLabel('上传封面图', '');
      }
      showToast(error && error.message ? error.message : '封面上传失败。', 'error');
    } finally {
      coverInput.value = '';
    }
  });
}

if (articleImageInput && articleImageText) {
  articleImageInput.addEventListener('change', async () => {
    const [file] = articleImageInput.files || [];
    if (!file) return;
    
    try {
      showToast('正在上传图片...', 'info');
      const imageUrl = await uploadImageToAliyun(file);
      
      const canvasWidth = editorCanvas ? editorCanvas.clientWidth - 40 : 800;
      const maxWidth = Math.min(800, canvasWidth);
      
      const imageHtml = `
        <div class="editor-image-wrapper" style="text-align: center; margin: 16px 0;">
          <img src="${imageUrl}" alt="${file.name}" style="max-width: ${maxWidth}px; height: auto; display: block; margin: 0 auto;" />
        </div>
        <p><br></p>
      `;
      
      runEditorCommand('insertHTML', imageHtml);
      showToast('图片上传成功', 'success');
      
      articleImageInput.value = '';
      articleImageText.textContent = '点击或拖拽图片到此处';
    } catch (error) {
      showToast(error && error.message ? error.message : '图片上传失败', 'error');
    }
  });
}

if (previewButton) {
  previewButton.addEventListener('click', async () => {
    try {
      const preview = await previewArticle();
      openPreviewModal(preview);
      showToast('预览生成成功。', 'success');
    } catch (error) {
      showToast(error && error.message ? error.message : '预览生成失败。', 'error');
    }
  });
}

if (publishButton) {
  publishButton.addEventListener('click', async () => {
    try {
      const selectedPublishTime = publishTimeInput ? publishTimeInput.value.trim() : '';
      let confirmMessage = '确认立即发布当前文章吗？';
      let confirmButtonText = '发布';

      if (selectedPublishTime) {
        const selectedTime = new Date(selectedPublishTime);
        const now = new Date();
        if (selectedTime > now) {
          const formattedTime = selectedTime.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          });
          confirmMessage = `确认将文章定时发布于 ${formattedTime} 吗？\n定时发布的文章将在设定时间自动发布，无需重复操作。`;
          confirmButtonText = '确认定时发布';
        }
      }

      const confirmed = await confirmAction({
        title: '发布文章',
        message: confirmMessage,
        confirmText: confirmButtonText,
        cancelText: '取消',
      });
      if (!confirmed) {
        return;
      }

      const result = await saveArticle(STATUS_PUBLISHED);
      if (selectedPublishTime) {
        const selectedTime = new Date(selectedPublishTime);
        const now = new Date();
        if (selectedTime > now) {
          showToast('定时发布设置成功，文章将在设定时间自动发布', 'success');
        } else {
          showToast('文章发布成功，正在跳转...', 'success');
        }
      } else {
        showToast('文章发布成功，正在跳转...', 'success');
      }
      markContentSaved();
      window.location.href = './index.html';
    } catch (error) {
      showToast(error && error.message ? error.message : '发布失败。', 'error');
    }
  });
}

if (goBackButton) {
  goBackButton.addEventListener('click', async () => {
    if (!hasContentChanged()) {
      navigateToHomePage();
      return;
    }

    const shouldSaveDraft = await confirmAction({
      title: '返回首页',
      message: '返回首页前是否将当前内容保存为草稿？',
      confirmText: '保存草稿',
      cancelText: '不保存并返回',
    });

    if (!shouldSaveDraft) {
      navigateToHomePage();
      return;
    }

    try {
      await saveDraftAndReturn('home');
    } catch (error) {
      showToast(error && error.message ? error.message : '草稿保存失败。', 'error');
    }
  });
}

if (saveDraftButton) {
  saveDraftButton.addEventListener('click', async () => {
    try {
      await saveDraftAndReturn();
    } catch (error) {
      showToast(error && error.message ? error.message : '草稿保存失败。', 'error');
    }
  });
}

bindCounter(summaryInput, summaryCount, ' 字');
bindCounter(seoInput, seoCount, ' 字');
bindDialogEvents();
bindPreviewEvents();
initPublishTimeInput();
syncModeUI();
ensureDefaultParagraphSeparator();
ensureEditorRootAsParagraph();
syncToolbarState();
updateFloatingToolbar();

(async () => {
  const canAccess = await ensureEditorAccess();
  if (!canAccess) {
    return;
  }

  await loadCategories();

  if (isEditMode) {
    await loadArticle();
  } else {
    resetCreateDefaults();
  }

  saveInitialSnapshot();

  bindCounter(summaryInput, summaryCount, ' 字');
  bindCounter(seoInput, seoCount, ' 字');
})().catch((error) => {
  showToast(error && error.message ? error.message : '页面初始化失败。', 'error');
});

const IMAGE_RESIZE_MIN_WIDTH = 80;
const IMAGE_RESIZE_FRAME_PADDING = 4;
const IMAGE_RESIZE_HANDLE_SIZE = 14;

let imageAlignmentControls = null;

function createImageAlignmentControls() {
  if (imageAlignmentControls) return;

  imageAlignmentControls = document.createElement('div');
  imageAlignmentControls.className = 'editor-image-alignment-controls';
  imageAlignmentControls.hidden = true;

  const alignLeftBtn = document.createElement('button');
  alignLeftBtn.type = 'button';
  alignLeftBtn.className = 'editor-image-align-btn';
  alignLeftBtn.setAttribute('aria-label', '左对齐');
  alignLeftBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M3 3h18v2H3V3zm0 4h10v2H3V7zm0 4h18v2H3v-2zm0 4h10v2H3v-2zm0 4h18v2H3v-2z"/></svg>';
  alignLeftBtn.addEventListener('click', () => setImageAlignment('left'));

  const alignCenterBtn = document.createElement('button');
  alignCenterBtn.type = 'button';
  alignCenterBtn.className = 'editor-image-align-btn';
  alignCenterBtn.setAttribute('aria-label', '居中');
  alignCenterBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M3 3h18v2H3V3zm4 4h10v2H7V7zm-4 4h18v2H3v-2zm4 4h10v2H7v-2zm-4 4h18v2H3v-2z"/></svg>';
  alignCenterBtn.addEventListener('click', () => setImageAlignment('center'));

  const alignRightBtn = document.createElement('button');
  alignRightBtn.type = 'button';
  alignRightBtn.className = 'editor-image-align-btn';
  alignRightBtn.setAttribute('aria-label', '右对齐');
  alignRightBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M3 3h18v2H3V3zm8 4h10v2H11V7zm-8 4h18v2H3v-2zm8 4h10v2H11v-2zm-8 4h18v2H3v-2z"/></svg>';
  alignRightBtn.addEventListener('click', () => setImageAlignment('right'));

  imageAlignmentControls.appendChild(alignLeftBtn);
  imageAlignmentControls.appendChild(alignCenterBtn);
  imageAlignmentControls.appendChild(alignRightBtn);

  document.body.appendChild(imageAlignmentControls);
}

function setImageAlignment(align) {
  if (!selectedEditorImage || !editorCanvas) return;

  const canvasRect = editorCanvas.getBoundingClientRect();
  const imageWidth = selectedEditorImage.offsetWidth;

  const wrapper = selectedEditorImage.parentElement;
  if (wrapper && wrapper.classList.contains('editor-image-wrapper')) {
    wrapper.style.textAlign = align;
    if (align === 'center') {
      wrapper.style.marginLeft = 'auto';
      wrapper.style.marginRight = 'auto';
    } else if (align === 'left') {
      wrapper.style.marginLeft = '0';
      wrapper.style.marginRight = 'auto';
    } else if (align === 'right') {
      wrapper.style.marginLeft = 'auto';
      wrapper.style.marginRight = '0';
    }
  } else {
    const newWrapper = document.createElement('div');
    newWrapper.className = 'editor-image-wrapper';
    newWrapper.style.textAlign = align;
    if (align === 'center') {
      newWrapper.style.marginLeft = 'auto';
      newWrapper.style.marginRight = 'auto';
    } else if (align === 'left') {
      newWrapper.style.marginLeft = '0';
      newWrapper.style.marginRight = 'auto';
    } else if (align === 'right') {
      newWrapper.style.marginLeft = 'auto';
      newWrapper.style.marginRight = '0';
    }
    newWrapper.style.marginTop = '16px';
    newWrapper.style.marginBottom = '16px';
    newWrapper.style.maxWidth = '100%';

    selectedEditorImage.parentNode.insertBefore(newWrapper, selectedEditorImage);
    newWrapper.appendChild(selectedEditorImage);
  }

  positionImageAlignmentControls();
}

function positionImageAlignmentControls() {
  if (!selectedEditorImage || !imageAlignmentControls) {
    if (imageAlignmentControls) {
      imageAlignmentControls.hidden = true;
    }
    return;
  }

  if (!selectedEditorImage.isConnected || !editorCanvas.contains(selectedEditorImage)) {
    selectedEditorImage = null;
    imageAlignmentControls.hidden = true;
    return;
  }

  const imageRect = selectedEditorImage.getBoundingClientRect();
  const canvasRect = editorCanvas.getBoundingClientRect();

  const controlsWidth = 96;

  let left;
  if (imageRect.left < canvasRect.left) {
    left = canvasRect.left + 4;
  } else if (imageRect.right > canvasRect.right) {
    left = canvasRect.right - controlsWidth - 4;
  } else {
    left = imageRect.left + (imageRect.width - controlsWidth) / 2;
  }

  left = Math.max(canvasRect.left + 4, Math.min(left, canvasRect.right - controlsWidth - 4));

  const top = imageRect.bottom + 8;

  imageAlignmentControls.style.left = `${Math.round(left)}px`;
  imageAlignmentControls.style.top = `${Math.round(top)}px`;
  imageAlignmentControls.hidden = false;
}

function hideImageAlignmentControls() {
  if (imageAlignmentControls) {
    imageAlignmentControls.hidden = true;
  }
}

function createImageResizeControls() {
  if (imageResizeHandle && imageResizeFrame) {
    return;
  }

  imageResizeFrame = document.createElement('div');
  imageResizeFrame.className = 'editor-image-resize-frame';
  imageResizeFrame.hidden = true;

  imageResizeHandle = document.createElement('button');
  imageResizeHandle.type = 'button';
  imageResizeHandle.className = 'editor-image-resize-handle';
  imageResizeHandle.setAttribute('aria-label', '调整图片大小');
  imageResizeHandle.hidden = true;
  imageResizeHandle.addEventListener('mousedown', startImageResizeDrag);

  document.body.appendChild(imageResizeFrame);
  document.body.appendChild(imageResizeHandle);
}

function getEditorImageFromTarget(target) {
  if (!target || !editorCanvas) return null;
  if (!(target instanceof HTMLElement)) return null;
  const imageElement = target.closest('img');
  if (!imageElement || imageElement.tagName !== 'IMG') return null;
  return editorCanvas.contains(imageElement) ? imageElement : null;
}

function hideImageResizeControls() {
  if (imageResizeFrame) {
    imageResizeFrame.hidden = true;
  }
  if (imageResizeHandle) {
    imageResizeHandle.hidden = true;
  }
}

function positionImageResizeControls() {
  if (!selectedEditorImage || !editorCanvas || !imageResizeHandle || !imageResizeFrame) {
    hideImageResizeControls();
    return;
  }
  if (!selectedEditorImage.isConnected || !editorCanvas.contains(selectedEditorImage)) {
    selectedEditorImage = null;
    hideImageResizeControls();
    return;
  }

  const imageRect = selectedEditorImage.getBoundingClientRect();
  if (imageRect.width <= 0 || imageRect.height <= 0) {
    hideImageResizeControls();
    return;
  }

  const frameLeft = imageRect.left - IMAGE_RESIZE_FRAME_PADDING;
  const frameTop = imageRect.top - IMAGE_RESIZE_FRAME_PADDING;
  const frameWidth = imageRect.width + IMAGE_RESIZE_FRAME_PADDING * 2;
  const frameHeight = imageRect.height + IMAGE_RESIZE_FRAME_PADDING * 2;

  imageResizeFrame.style.left = `${Math.round(frameLeft)}px`;
  imageResizeFrame.style.top = `${Math.round(frameTop)}px`;
  imageResizeFrame.style.width = `${Math.round(frameWidth)}px`;
  imageResizeFrame.style.height = `${Math.round(frameHeight)}px`;
  imageResizeFrame.hidden = false;

  const handleLeft = imageRect.right - IMAGE_RESIZE_HANDLE_SIZE / 2;
  const handleTop = imageRect.bottom - IMAGE_RESIZE_HANDLE_SIZE / 2;
  imageResizeHandle.style.left = `${Math.round(handleLeft)}px`;
  imageResizeHandle.style.top = `${Math.round(handleTop)}px`;
  imageResizeHandle.hidden = false;
}

function selectEditorImage(imageElement) {
  selectedEditorImage = imageElement || null;
  if (!selectedEditorImage) {
    hideImageResizeControls();
    hideImageAlignmentControls();
    return;
  }
  selectedEditorImage.draggable = false;
  positionImageResizeControls();
  positionImageAlignmentControls();
}

function clearEditorImageSelection() {
  selectedEditorImage = null;
  hideImageResizeControls();
  hideImageAlignmentControls();
}

function startImageResizeDrag(event) {
  if (!selectedEditorImage || !editorCanvas || event.button !== 0) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();

  const imageRect = selectedEditorImage.getBoundingClientRect();
  const canvasRect = editorCanvas.getBoundingClientRect();
  const aspectRatio = imageRect.height > 0 ? imageRect.width / imageRect.height : 0;
  const maxWidth = Math.max(IMAGE_RESIZE_MIN_WIDTH, canvasRect.width - 18);

  activeImageResizeState = {
    startX: event.clientX,
    startWidth: imageRect.width,
    startHeight: imageRect.height,
    aspectRatio,
    maxWidth,
  };

  document.body.classList.add('is-image-resizing');
  document.addEventListener('mousemove', onImageResizeDrag);
  document.addEventListener('mouseup', endImageResizeDrag);
}

function onImageResizeDrag(event) {
  if (!activeImageResizeState || !selectedEditorImage) {
    return;
  }

  const deltaX = event.clientX - activeImageResizeState.startX;
  const nextWidth = Math.min(
    activeImageResizeState.maxWidth,
    Math.max(IMAGE_RESIZE_MIN_WIDTH, activeImageResizeState.startWidth + deltaX)
  );
  const nextHeight = activeImageResizeState.aspectRatio > 0
    ? nextWidth / activeImageResizeState.aspectRatio
    : activeImageResizeState.startHeight;

  const width = Math.round(nextWidth);
  const height = Math.round(nextHeight);

  selectedEditorImage.style.width = `${width}px`;
  selectedEditorImage.style.height = `${height}px`;
  selectedEditorImage.setAttribute('width', String(width));
  selectedEditorImage.setAttribute('height', String(height));

  positionImageResizeControls();
  positionImageAlignmentControls();
}

function endImageResizeDrag() {
  if (!activeImageResizeState) {
    return;
  }
  activeImageResizeState = null;
  document.body.classList.remove('is-image-resizing');
  document.removeEventListener('mousemove', onImageResizeDrag);
  document.removeEventListener('mouseup', endImageResizeDrag);
  positionImageAlignmentControls();
}

function bindImageResizeEvents() {
  if (!editorCanvas || editorCanvas.dataset.imageResizeBound === '1') return;
  editorCanvas.dataset.imageResizeBound = '1';
  createImageResizeControls();
  createImageAlignmentControls();

  editorCanvas.addEventListener('click', (event) => {
    const targetImage = getEditorImageFromTarget(event.target);
    if (!targetImage) {
      clearEditorImageSelection();
      return;
    }
    event.preventDefault();
    selectEditorImage(targetImage);
  });

  editorCanvas.addEventListener('input', () => {
    if (!selectedEditorImage || !editorCanvas.contains(selectedEditorImage)) {
      clearEditorImageSelection();
      return;
    }
    positionImageResizeControls();
  });

  document.addEventListener('mousedown', (event) => {
    if (!editorCanvas) return;
    const targetImage = getEditorImageFromTarget(event.target);
    if (targetImage) return;
    if (imageResizeHandle && imageResizeHandle.contains(event.target)) return;
    if (imageAlignmentControls && imageAlignmentControls.contains(event.target)) return;
    if (editorCanvas.contains(event.target)) {
      clearEditorImageSelection();
      return;
    }
    clearEditorImageSelection();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      clearEditorImageSelection();
    }
  });

  window.addEventListener('resize', () => {
    positionImageResizeControls();
    positionImageAlignmentControls();
  });
  window.addEventListener('scroll', () => {
    positionImageResizeControls();
    positionImageAlignmentControls();
  }, true);
}

bindImageResizeEvents();

let selectedEditorTable = null;
let tableResizeHandle = null;
let tableResizeFrame = null;
let activeTableResizeState = null;

const TABLE_RESIZE_MIN_WIDTH = 200;
const TABLE_RESIZE_FRAME_PADDING = 4;
const TABLE_RESIZE_HANDLE_SIZE = 14;

function createTableResizeControls() {
  if (tableResizeHandle && tableResizeFrame) {
    return;
  }

  tableResizeFrame = document.createElement('div');
  tableResizeFrame.className = 'editor-table-resize-frame';
  tableResizeFrame.hidden = true;

  tableResizeHandle = document.createElement('button');
  tableResizeHandle.type = 'button';
  tableResizeHandle.className = 'editor-table-resize-handle';
  tableResizeHandle.setAttribute('aria-label', '调整表格大小');
  tableResizeHandle.hidden = true;
  tableResizeHandle.addEventListener('mousedown', startTableResizeDrag);

  document.body.appendChild(tableResizeFrame);
  document.body.appendChild(tableResizeHandle);
}

function getEditorTableFromTarget(target) {
  if (!target || !editorCanvas) return null;
  if (!(target instanceof HTMLElement)) return null;
  const tableElement = target.closest('table');
  if (!tableElement || tableElement.tagName !== 'TABLE') return null;
  return editorCanvas.contains(tableElement) ? tableElement : null;
}

function hideTableResizeControls() {
  if (tableResizeFrame) {
    tableResizeFrame.hidden = true;
  }
  if (tableResizeHandle) {
    tableResizeHandle.hidden = true;
  }
}

function positionTableResizeControls() {
  if (!selectedEditorTable || !editorCanvas || !tableResizeHandle || !tableResizeFrame) {
    hideTableResizeControls();
    return;
  }
  if (!selectedEditorTable.isConnected || !editorCanvas.contains(selectedEditorTable)) {
    selectedEditorTable = null;
    hideTableResizeControls();
    return;
  }

  const tableRect = selectedEditorTable.getBoundingClientRect();
  if (tableRect.width <= 0 || tableRect.height <= 0) {
    hideTableResizeControls();
    return;
  }

  const frameLeft = tableRect.left - TABLE_RESIZE_FRAME_PADDING;
  const frameTop = tableRect.top - TABLE_RESIZE_FRAME_PADDING;
  const frameWidth = tableRect.width + TABLE_RESIZE_FRAME_PADDING * 2;
  const frameHeight = tableRect.height + TABLE_RESIZE_FRAME_PADDING * 2;

  tableResizeFrame.style.left = `${Math.round(frameLeft)}px`;
  tableResizeFrame.style.top = `${Math.round(frameTop)}px`;
  tableResizeFrame.style.width = `${Math.round(frameWidth)}px`;
  tableResizeFrame.style.height = `${Math.round(frameHeight)}px`;
  tableResizeFrame.hidden = false;

  const handleLeft = tableRect.right - TABLE_RESIZE_HANDLE_SIZE / 2;
  const handleTop = tableRect.bottom - TABLE_RESIZE_HANDLE_SIZE / 2;
  tableResizeHandle.style.left = `${Math.round(handleLeft)}px`;
  tableResizeHandle.style.top = `${Math.round(handleTop)}px`;
  tableResizeHandle.hidden = false;
}

function selectEditorTable(tableElement) {
  selectedEditorTable = tableElement || null;
  if (!selectedEditorTable) {
    hideTableResizeControls();
    return;
  }
  positionTableResizeControls();
}

function clearEditorTableSelection() {
  selectedEditorTable = null;
  hideTableResizeControls();
}

function startTableResizeDrag(event) {
  if (!selectedEditorTable || !editorCanvas || event.button !== 0) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();

  const tableRect = selectedEditorTable.getBoundingClientRect();
  const canvasRect = editorCanvas.getBoundingClientRect();
  const maxWidth = Math.max(TABLE_RESIZE_MIN_WIDTH, canvasRect.width - 18);

  activeTableResizeState = {
    startX: event.clientX,
    startWidth: tableRect.width,
    maxWidth,
  };

  document.body.classList.add('is-table-resizing');
  document.addEventListener('mousemove', onTableResizeDrag);
  document.addEventListener('mouseup', endTableResizeDrag);
}

function onTableResizeDrag(event) {
  if (!activeTableResizeState || !selectedEditorTable) {
    return;
  }

  const deltaX = event.clientX - activeTableResizeState.startX;
  const nextWidth = Math.min(
    activeTableResizeState.maxWidth,
    Math.max(TABLE_RESIZE_MIN_WIDTH, activeTableResizeState.startWidth + deltaX)
  );

  selectedEditorTable.style.width = `${Math.round(nextWidth)}px`;
  positionTableResizeControls();
}

function endTableResizeDrag() {
  if (!activeTableResizeState) {
    return;
  }
  activeTableResizeState = null;
  document.body.classList.remove('is-table-resizing');
  document.removeEventListener('mousemove', onTableResizeDrag);
  document.removeEventListener('mouseup', endTableResizeDrag);
}

function parsePastedTableData(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 1) return null;

  const rows = lines.map((line) => {
    return line.split(/\t/).map((cell) => cell.trim());
  });

  const columnCount = Math.max(...rows.map((row) => row.length));
  if (columnCount < 1) return null;

  return rows;
}

function createTableFromData(rows) {
  if (!rows || rows.length < 1) return null;

  const hasHeader = rows.length > 1;
  const columnCount = Math.max(...rows.map((row) => row.length));

  const canvasWidth = editorCanvas ? editorCanvas.clientWidth - 40 : 800;
  const columnWidth = Math.floor(canvasWidth / columnCount);
  const tableWidth = columnWidth * columnCount;

  let html = [`<table class="editor-table" style="width: ${tableWidth}px; max-width: 100%; table-layout: fixed;">`];

  if (hasHeader) {
    html.push('<thead><tr>');
    const headerRow = rows[0];
    for (let i = 0; i < columnCount; i++) {
      const cellContent = headerRow[i] || '';
      html.push(`<th style="width: ${columnWidth}px; min-width: 40px;">${cellContent || '<br>'}</th>`);
    }
    html.push('</tr></thead>');
  }

  html.push('<tbody>');
  const dataRows = hasHeader ? rows.slice(1) : rows;
  dataRows.forEach((row) => {
    html.push('<tr>');
    for (let i = 0; i < columnCount; i++) {
      const cellContent = row[i] || '';
      html.push(`<td style="width: ${columnWidth}px; min-width: 40px;">${cellContent || '<br>'}</td>`);
    }
    html.push('</tr>');
  });
  html.push('</tbody></table><p><br></p>');

  return html.join('');
}

let columnResizeIndicator = null;
let activeColumnResizeState = null;
const COLUMN_MIN_WIDTH = 40;

function createColumnResizeIndicator() {
  if (columnResizeIndicator) return;
  columnResizeIndicator = document.createElement('div');
  columnResizeIndicator.className = 'editor-column-resize-indicator';
  columnResizeIndicator.hidden = true;
  document.body.appendChild(columnResizeIndicator);
}

function showColumnResizeIndicator(x, tableRect) {
  if (!columnResizeIndicator) return;
  columnResizeIndicator.style.left = `${x}px`;
  columnResizeIndicator.style.top = `${tableRect.top}px`;
  columnResizeIndicator.style.height = `${tableRect.height}px`;
  columnResizeIndicator.hidden = false;
}

function hideColumnResizeIndicator() {
  if (columnResizeIndicator) {
    columnResizeIndicator.hidden = true;
  }
}

function getColumnResizeTarget(event) {
  if (!editorCanvas) return null;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return null;

  const cell = target.closest('th, td');
  if (!cell || !editorCanvas.contains(cell)) return null;

  const cellRect = cell.getBoundingClientRect();
  const mouseX = event.clientX;
  const threshold = 8;

  if (mouseX >= cellRect.right - threshold && mouseX <= cellRect.right + threshold) {
    return { cell, position: 'right' };
  }

  return null;
}

function startColumnResizeDrag(event, cell) {
  if (!editorCanvas) return;

  const table = cell.closest('table');
  if (!table) return;

  const tableRect = table.getBoundingClientRect();
  const cellRect = cell.getBoundingClientRect();
  const row = cell.parentElement;
  const cellIndex = cell.cellIndex;
  const nextCell = row ? row.cells[cellIndex + 1] : null;

  const firstRow = table.querySelector('tr');
  const columnCount = firstRow ? firstRow.cells.length : 0;

  const columnWidths = [];
  const firstRowCells = firstRow ? firstRow.cells : [];
  for (let i = 0; i < firstRowCells.length; i++) {
    columnWidths.push(firstRowCells[i].offsetWidth);
  }

  activeColumnResizeState = {
    table,
    cellIndex,
    startX: event.clientX,
    startCellWidth: cell.offsetWidth,
    startNextCellWidth: nextCell ? nextCell.offsetWidth : 0,
    tableWidth: table.offsetWidth,
    columnWidths,
    columnCount,
    hasNextCell: !!nextCell,
  };

  createColumnResizeIndicator();
  showColumnResizeIndicator(cellRect.right, tableRect);
  document.body.classList.add('is-column-resizing');
  document.addEventListener('mousemove', onColumnResizeDrag);
  document.addEventListener('mouseup', endColumnResizeDrag);
}

function onColumnResizeDrag(event) {
  if (!activeColumnResizeState) return;

  const { table, cellIndex, startX, startCellWidth, startNextCellWidth, tableWidth, columnWidths, columnCount, hasNextCell } = activeColumnResizeState;

  const deltaX = event.clientX - startX;
  let newCellWidth = startCellWidth + deltaX;
  let newNextCellWidth = startNextCellWidth - deltaX;

  if (newCellWidth < COLUMN_MIN_WIDTH) {
    newCellWidth = COLUMN_MIN_WIDTH;
    newNextCellWidth = startCellWidth + startNextCellWidth - COLUMN_MIN_WIDTH;
  }

  if (hasNextCell && newNextCellWidth < COLUMN_MIN_WIDTH) {
    newNextCellWidth = COLUMN_MIN_WIDTH;
    newCellWidth = startCellWidth + startNextCellWidth - COLUMN_MIN_WIDTH;
  }

  const tableRect = table.getBoundingClientRect();
  const indicatorX = tableRect.left;

  let cumulativeWidth = 0;
  for (let i = 0; i <= cellIndex; i++) {
    if (i === cellIndex) {
      cumulativeWidth += newCellWidth;
    } else {
      cumulativeWidth += columnWidths[i] || COLUMN_MIN_WIDTH;
    }
  }

  showColumnResizeIndicator(indicatorX + cumulativeWidth, tableRect);
}

function endColumnResizeDrag(event) {
  if (!activeColumnResizeState) return;

  const { table, cellIndex, startX, startCellWidth, startNextCellWidth, columnWidths, columnCount, hasNextCell } = activeColumnResizeState;

  const deltaX = event.clientX - startX;
  let newCellWidth = startCellWidth + deltaX;
  let newNextCellWidth = startNextCellWidth - deltaX;

  if (newCellWidth < COLUMN_MIN_WIDTH) {
    newCellWidth = COLUMN_MIN_WIDTH;
    newNextCellWidth = startCellWidth + startNextCellWidth - COLUMN_MIN_WIDTH;
  }

  if (hasNextCell && newNextCellWidth < COLUMN_MIN_WIDTH) {
    newNextCellWidth = COLUMN_MIN_WIDTH;
    newCellWidth = startCellWidth + startNextCellWidth - COLUMN_MIN_WIDTH;
  }

  const rows = table.querySelectorAll('tr');
  rows.forEach((row) => {
    const cells = row.cells;
    if (cells[cellIndex]) {
      cells[cellIndex].style.width = `${newCellWidth}px`;
      cells[cellIndex].style.minWidth = `${newCellWidth}px`;
    }
    if (hasNextCell && cells[cellIndex + 1]) {
      cells[cellIndex + 1].style.width = `${newNextCellWidth}px`;
      cells[cellIndex + 1].style.minWidth = `${newNextCellWidth}px`;
    }
  });

  hideColumnResizeIndicator();
  document.body.classList.remove('is-column-resizing');
  document.removeEventListener('mousemove', onColumnResizeDrag);
  document.removeEventListener('mouseup', endColumnResizeDrag);
  activeColumnResizeState = null;

  positionTableResizeControls();
}

function bindTableEvents() {
  if (!editorCanvas || editorCanvas.dataset.tableEventsBound === '1') return;
  editorCanvas.dataset.tableEventsBound = '1';
  createTableResizeControls();

  editorCanvas.addEventListener('mousedown', (event) => {
    const resizeTarget = getColumnResizeTarget(event);
    if (resizeTarget) {
      event.preventDefault();
      event.stopPropagation();
      startColumnResizeDrag(event, resizeTarget.cell);
      return;
    }

    const targetTable = getEditorTableFromTarget(event.target);
    if (targetTable) {
      const cell = event.target.closest('td, th');
      if (!cell) {
        event.preventDefault();
      }
    }
  });

  editorCanvas.addEventListener('click', (event) => {
    const resizeTarget = getColumnResizeTarget(event);
    if (resizeTarget) {
      event.preventDefault();
      return;
    }

    const targetTable = getEditorTableFromTarget(event.target);
    if (!targetTable) {
      clearEditorTableSelection();
      return;
    }

    const cell = event.target.closest('td, th');
    if (!cell) {
      event.preventDefault();
      selectEditorTable(targetTable);
    }
  });

  editorCanvas.addEventListener('input', () => {
    if (!selectedEditorTable || !editorCanvas.contains(selectedEditorTable)) {
      clearEditorTableSelection();
      return;
    }
    positionTableResizeControls();
  });

  editorCanvas.addEventListener('keydown', (event) => {
    const cell = getCurrentTableCell();
    if (!cell) return;

    if (event.key === 'Delete' || event.key === 'Backspace') {
      const selection = window.getSelection();
      if (selection && selection.isCollapsed) {
        const row = cell.parentElement;
        const table = cell.closest('table');
        if (row && table) {
          const tbody = table.querySelector('tbody');
          const thead = table.querySelector('thead');
          const totalBodyRows = tbody ? tbody.querySelectorAll('tr').length : 0;

          if (row.parentElement !== thead && totalBodyRows > 1) {
            event.preventDefault();
            deleteTableRow();
          }
        }
      }
    }
  });

  editorCanvas.addEventListener('paste', async (event) => {
    const cell = getCurrentTableCell();
    const clipboardData = event.clipboardData || window.clipboardData;
    if (!clipboardData) return;

    const items = clipboardData.items || [];
    const imageItem = Array.from(items).find(item => item.type.startsWith('image/'));
    
    if (imageItem) {
      event.preventDefault();
      
      const file = imageItem.getAsFile();
      if (!file) return;
      
      try {
        showToast('正在上传图片...', 'info');
        const imageUrl = await uploadImageToAliyun(file);
        
        const canvasWidth = editorCanvas ? editorCanvas.clientWidth - 40 : 800;
        const maxWidth = Math.min(800, canvasWidth);
        
        const imageHtml = `
          <div class="editor-image-wrapper" style="text-align: center; margin: 16px 0;">
            <img src="${imageUrl}" alt="粘贴的图片" style="max-width: ${maxWidth}px; height: auto; display: block; margin: 0 auto;" />
          </div>
          <p><br></p>
        `;
        
        runEditorCommand('insertHTML', imageHtml);
        showToast('图片上传成功', 'success');
      } catch (error) {
        showToast(error && error.message ? error.message : '图片上传失败', 'error');
      }
      return;
    }
    
    if (!cell) return;

    const text = clipboardData.getData('text/plain');
    if (!text) return;

    const rows = parsePastedTableData(text);
    if (!rows || rows.length < 2) return;

    const hasMultipleCells = rows.some((row) => row.length > 1);
    if (!hasMultipleCells) return;

    event.preventDefault();

    const tableHtml = createTableFromData(rows);
    if (tableHtml) {
      runEditorCommand('insertHTML', tableHtml);
      showToast('表格数据已粘贴', 'success');
    }
  });

  document.addEventListener('mousedown', (event) => {
    if (!editorCanvas) return;
    const targetTable = getEditorTableFromTarget(event.target);
    if (targetTable) return;
    if (tableResizeHandle && tableResizeHandle.contains(event.target)) return;
    if (editorCanvas.contains(event.target)) {
      clearEditorTableSelection();
      return;
    }
    clearEditorTableSelection();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      clearEditorTableSelection();
    }
  });

  editorCanvas.addEventListener('mousemove', (event) => {
    if (activeColumnResizeState) return;

    const resizeTarget = getColumnResizeTarget(event);
    if (resizeTarget) {
      editorCanvas.style.cursor = 'col-resize';
    } else {
      editorCanvas.style.cursor = '';
    }
  });

  document.addEventListener('mouseup', () => {
    if (activeColumnResizeState) {
      hideColumnResizeIndicator();
      document.body.classList.remove('is-column-resizing');
      document.removeEventListener('mousemove', onColumnResizeDrag);
      document.removeEventListener('mouseup', endColumnResizeDrag);
      activeColumnResizeState = null;
    }
  });

  window.addEventListener('resize', positionTableResizeControls);
  window.addEventListener('scroll', positionTableResizeControls, true);
}

bindTableEvents();

let draftSearchTimer = 0;
let draftSearchAbortController = null;
let activeDraftIndex = -1;
let draftSuggestions = [];

const draftSuggestionsEl = document.getElementById('draft-suggestions');

function hideDraftSuggestions() {
  if (draftSuggestionsEl) {
    draftSuggestionsEl.hidden = true;
    draftSuggestionsEl.innerHTML = '';
  }
  draftSuggestions = [];
  activeDraftIndex = -1;
}

function formatDateShort(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

function renderDraftSuggestions(drafts) {
  if (!draftSuggestionsEl) return;
  
  if (!drafts || drafts.length === 0) {
    draftSuggestionsEl.innerHTML = `
      <div class="draft-suggestion-empty">未找到匹配的草稿</div>
    `;
    draftSuggestionsEl.hidden = false;
    return;
  }

  const headerHtml = `<div class="draft-suggestions-header">找到 ${drafts.length} 篇草稿</div>`;
  const itemsHtml = drafts.map((draft, index) => `
    <div class="draft-suggestion-item${index === activeDraftIndex ? ' active' : ''}" 
         data-draft-index="${index}"
         data-draft-id="${draft.id}">
      <div class="draft-suggestion-title">${escapeHtml(draft.title || '无标题')}</div>
      <div class="draft-suggestion-meta">
        更新于 ${formatDateShort(draft.updatedAt || draft.createdAt)}
        ${draft.category ? ` · ${escapeHtml(draft.category)}` : ''}
      </div>
    </div>
  `).join('');

  draftSuggestionsEl.innerHTML = headerHtml + itemsHtml;
  draftSuggestionsEl.hidden = false;

  draftSuggestionsEl.querySelectorAll('.draft-suggestion-item').forEach((item) => {
    item.addEventListener('click', () => {
      const index = Number(item.dataset.draftIndex);
      if (Number.isFinite(index) && index >= 0 && index < draftSuggestions.length) {
        selectDraft(draftSuggestions[index]);
      }
    });
  });
}

async function searchDrafts(keyword) {
  if (!api || !isAuthed() || !isAdmin(getProfile())) {
    return [];
  }

  if (draftSearchAbortController) {
    draftSearchAbortController.abort();
  }

  const trimmedKeyword = String(keyword || '').trim();
  if (trimmedKeyword.length === 0) {
    return [];
  }

  draftSearchAbortController = new AbortController();
  
  try {
    const drafts = await api.get(`/articles/drafts/search?keyword=${encodeURIComponent(trimmedKeyword)}`, { auth: true });
    return Array.isArray(drafts) ? drafts : [];
  } catch (error) {
    if (error && error.name === 'AbortError') {
      return [];
    }
    console.error('Failed to search drafts:', error);
    return [];
  }
}

function selectDraft(draft) {
  if (!draft || !draft.id) return;
  
  hideDraftSuggestions();
  
  const newUrl = new URL(window.location.href);
  newUrl.searchParams.set('id', String(draft.id));
  window.history.replaceState({}, '', newUrl.toString());
  
  window.location.reload();
}

function updateActiveDraftHighlight() {
  if (!draftSuggestionsEl) return;
  
  draftSuggestionsEl.querySelectorAll('.draft-suggestion-item').forEach((item, index) => {
    item.classList.toggle('active', index === activeDraftIndex);
  });
}

if (titleInput && !isEditMode) {
  titleInput.addEventListener('input', () => {
    window.clearTimeout(draftSearchTimer);
    
    const keyword = String(titleInput.value || '').trim();
    
    if (keyword.length === 0) {
      hideDraftSuggestions();
      return;
    }
    
    draftSearchTimer = window.setTimeout(async () => {
      const drafts = await searchDrafts(keyword);
      draftSuggestions = drafts;
      activeDraftIndex = -1;
      renderDraftSuggestions(drafts);
    }, 300);
  });

  titleInput.addEventListener('keydown', (event) => {
    if (draftSuggestionsEl && draftSuggestionsEl.hidden) return;
    if (draftSuggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeDraftIndex = Math.min(activeDraftIndex + 1, draftSuggestions.length - 1);
      updateActiveDraftHighlight();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeDraftIndex = Math.max(activeDraftIndex - 1, 0);
      updateActiveDraftHighlight();
    } else if (event.key === 'Enter' && activeDraftIndex >= 0) {
      event.preventDefault();
      selectDraft(draftSuggestions[activeDraftIndex]);
    } else if (event.key === 'Escape') {
      hideDraftSuggestions();
    }
  });

  titleInput.addEventListener('blur', () => {
    window.setTimeout(hideDraftSuggestions, 200);
  });

  titleInput.addEventListener('focus', () => {
    const keyword = String(titleInput.value || '').trim();
    if (keyword.length > 0 && draftSuggestions.length > 0) {
      renderDraftSuggestions(draftSuggestions);
    }
  });
}

document.addEventListener('click', (event) => {
  if (draftSuggestionsEl && !draftSuggestionsEl.hidden) {
    if (!titleInput?.contains(event.target) && !draftSuggestionsEl.contains(event.target)) {
      hideDraftSuggestions();
    }
  }
});
