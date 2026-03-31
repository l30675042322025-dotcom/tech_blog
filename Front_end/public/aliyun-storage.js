(function () {
  const META_KEY = 'techvibe_aliyun_meta';

  const FOLDERS = {
    avatar: 'avatar',
    log: 'log',
  };

  const LABELS = {
    avatar: '头像',
    log: '日志',
  };

  function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  function parseMeta() {
    try {
      const value = window.localStorage.getItem(META_KEY);
      if (!value) {
        return { counters: {}, records: [] };
      }

      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object') {
        return { counters: {}, records: [] };
      }

      return {
        counters: parsed.counters && typeof parsed.counters === 'object' ? parsed.counters : {},
        records: Array.isArray(parsed.records) ? parsed.records : [],
      };
    } catch {
      return { counters: {}, records: [] };
    }
  }

  function persistMeta(meta) {
    window.localStorage.setItem(META_KEY, JSON.stringify(meta));
  }

  function normalizeType(type) {
    return type === 'avatar' ? 'avatar' : 'log';
  }

  function normalizeExt(ext) {
    if (!ext) return '';
    return ext.startsWith('.') ? ext : `.${ext}`;
  }

  function nextIndex(type, dateKey, meta) {
    const counterKey = `${type}:${dateKey}`;
    const current = Number(meta.counters[counterKey] || 0);
    meta.counters[counterKey] = current + 1;
    return current;
  }

  function buildFileName(type, dateKey, index, ext) {
    return `${dateKey}-${LABELS[type]}-${index}${normalizeExt(ext)}`;
  }

  function allocateObjectKey(type, options) {
    const currentType = normalizeType(type);
    const meta = parseMeta();
    const dateKey = formatDateKey(options && options.date instanceof Date ? options.date : new Date());
    const index = nextIndex(currentType, dateKey, meta);
    const fileName = buildFileName(currentType, dateKey, index, options && options.ext ? options.ext : '');
    const objectKey = `${FOLDERS[currentType]}/${fileName}`;

    persistMeta(meta);

    return {
      folder: FOLDERS[currentType],
      dateKey,
      index,
      fileName,
      objectKey,
      label: LABELS[currentType],
    };
  }

  function saveRecord(type, payload) {
    const currentType = normalizeType(type);
    const allocated = allocateObjectKey(currentType, {
      ext: payload && payload.ext ? payload.ext : '',
      date: payload && payload.date instanceof Date ? payload.date : new Date(),
    });

    const rawPayload = payload && typeof payload === 'object' ? { ...payload } : {};
    delete rawPayload.ext;
    delete rawPayload.date;

    const record = {
      type: currentType,
      objectKey: allocated.objectKey,
      aliyunPath: `aliyun/${allocated.objectKey}`,
      folder: allocated.folder,
      dateKey: allocated.dateKey,
      index: allocated.index,
      fileName: allocated.fileName,
      createdAt: new Date().toISOString(),
      payload: rawPayload,
    };

    const latestMeta = parseMeta();
    latestMeta.records.push(record);
    persistMeta(latestMeta);

    return record;
  }

  function listRecords(type) {
    const meta = parseMeta();
    const currentType = type ? normalizeType(type) : null;

    if (!currentType) {
      return [...meta.records];
    }

    return meta.records.filter((item) => item.type === currentType);
  }

  window.TechVibeAliyun = {
    folders: { ...FOLDERS },
    labels: { ...LABELS },
    formatDateKey,
    allocateObjectKey,
    saveRecord,
    listRecords,
  };
})();
