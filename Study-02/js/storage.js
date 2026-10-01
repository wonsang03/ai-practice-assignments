/**
 * 저장과 불러오기, 가져오기/내보내기 파일 형식을 담당합니다.
 *
 * localStorage는 사생활 보호 모드나 용량 초과 때 예외를 던질 수 있으므로
 * 모든 접근을 try/catch로 감쌉니다. 저장소를 못 쓰면 앱은 메모리에서만 동작하고,
 * 화면에 안내 문구를 띄웁니다(app.js).
 */
(function (root, factory) {
  const api = factory(root.TodoTasks || (typeof require === 'function' ? require('./tasks.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TodoStorage = api;
})(typeof self !== 'undefined' ? self : this, function (T) {
  'use strict';

  const APP_ID = 'personal-todo';
  const SCHEMA_VERSION = 1;
  const KEY = `${APP_ID}/data`;
  const BACKUP_KEY = `${APP_ID}/backup`;
  const MAX_IMPORT = 5000;
  const MAX_IMAGE_CHARS = 8 * 1024 * 1024; // data URL 한 장당 최대 길이(약 6MB 이미지)
  const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

  const DEFAULT_SETTINGS = {
    category: 'all',
    sort: 'manual',
    theme: 'system', // 'system' | 'light' | 'dark'
    showDone: true,
    dashboardOpen: true,
    view: 'list', // 'list' | 'calendar'
  };

  function emptyState() {
    return { tasks: [], history: {}, settings: { ...DEFAULT_SETTINGS } };
  }

  function normalizeSettings(raw) {
    const s = { ...DEFAULT_SETTINGS };
    if (!raw || typeof raw !== 'object') return s;
    if (raw.category === 'all' || T.categoryIds.includes(raw.category)) s.category = raw.category;
    // 강의 버전은 currentFilter / currentSort / isDarkMode 라는 이름을 씁니다.
    if (T.categoryIds.includes(raw.currentFilter)) s.category = raw.currentFilter;
    if (T.sortIds.includes(raw.sort)) s.sort = raw.sort;
    if (['system', 'light', 'dark'].includes(raw.theme)) s.theme = raw.theme;
    else if (typeof raw.isDarkMode === 'boolean') s.theme = raw.isDarkMode ? 'dark' : 'light';
    if (typeof raw.showDone === 'boolean') s.showDone = raw.showDone;
    if (typeof raw.dashboardOpen === 'boolean') s.dashboardOpen = raw.dashboardOpen;
    if (raw.view === 'list' || raw.view === 'calendar') s.view = raw.view;
    return s;
  }

  /** 저장된 값이나 가져온 파일을 앱 상태로 바꿉니다. 형식이 맞지 않으면 예외. */
  function normalizeState(raw, now = new Date()) {
    let rawTasks;
    if (Array.isArray(raw)) rawTasks = raw;
    else if (raw && typeof raw === 'object' && Array.isArray(raw.tasks)) rawTasks = raw.tasks;
    else throw new Error('할 일 목록(tasks)을 찾을 수 없어요.');

    if (rawTasks.length > MAX_IMPORT) {
      throw new Error(`할 일이 너무 많아요 (${rawTasks.length}개, 최대 ${MAX_IMPORT}개).`);
    }

    const tasks = [];
    let skipped = 0;
    rawTasks.forEach((item, i) => {
      const task = T.normalizeTask(item, i, now);
      if (task) tasks.push(task);
      else skipped += 1;
    });

    const todayKey = T.toDateKey(now);
    let history = T.pruneHistory(raw && raw.history, todayKey);
    // 기록이 없는 데이터(강의 버전 파일 등)는 완료 시각으로 기록을 만들어 둡니다.
    if (!Object.keys(history).length) {
      for (const t of tasks) {
        if (t.completedAt) history = T.recordCompletion(history, T.toDateKey(new Date(t.completedAt)), 1);
      }
      history = T.pruneHistory(history, todayKey);
    }

    return {
      state: {
        tasks: T.dedupeIds(tasks),
        history,
        settings: normalizeSettings(raw && raw.settings),
      },
      skipped,
    };
  }

  function createStore(backend) {
    let available = true;

    function read(key) {
      try {
        return backend.getItem(key);
      } catch {
        available = false;
        return null;
      }
    }

    function write(key, value) {
      try {
        backend.setItem(key, value);
        available = true;
        return true;
      } catch {
        available = false;
        return false;
      }
    }

    // 쓰기·지우기가 실제로 되는지 확인합니다(사파리 사생활 보호 모드 등).
    try {
      const probe = `${APP_ID}/probe`;
      backend.setItem(probe, '1');
      backend.removeItem(probe);
    } catch {
      available = false;
    }

    return {
      get available() { return available; },

      load(now = new Date()) {
        const text = read(KEY);
        if (!text) return { state: emptyState(), recovered: false };
        try {
          return { state: normalizeState(JSON.parse(text), now).state, recovered: false };
        } catch {
          // 망가진 데이터는 지우지 않고 백업 칸으로 옮겨 둔 뒤 빈 상태로 시작합니다.
          write(`${APP_ID}/corrupt-${Date.now()}`, text);
          return { state: emptyState(), recovered: true };
        }
      },

      save(state) {
        const payload = { version: SCHEMA_VERSION, ...state };
        return write(KEY, JSON.stringify(payload));
      },

      backup(state) {
        return write(BACKUP_KEY, JSON.stringify({ version: SCHEMA_VERSION, savedAt: new Date().toISOString(), ...state }));
      },
    };
  }

  /**
   * 내보내기 파일 내용. 사진은 {id: data URL} 형태로 함께 넣어서 파일 하나로 옮길 수 있게 합니다.
   * @param {object} images 사진 id → data URL
   */
  function buildExport(state, images = {}, now = new Date()) {
    return {
      app: APP_ID,
      version: SCHEMA_VERSION,
      exportedAt: now.toISOString(),
      taskCount: state.tasks.length,
      tasks: state.tasks,
      history: state.history,
      settings: state.settings,
      images,
    };
  }

  /** 가져온 파일의 사진 중 형식이 맞는 것만 남깁니다. */
  function normalizeImages(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    for (const [id, url] of Object.entries(raw)) {
      if (!/^[\w-]{1,64}$/.test(id)) continue;
      if (typeof url !== 'string' || url.length > MAX_IMAGE_CHARS || !IMAGE_DATA_URL.test(url)) continue;
      out[id] = url;
    }
    return out;
  }

  function exportFileName(now = new Date()) {
    return `my-tasks-${T.toDateKey(now)}.json`;
  }

  /** 가져오기 파일 문자열을 읽어 상태로 바꿉니다. */
  function parseImport(text, now = new Date()) {
    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error('JSON 파일이 아니거나 내용이 손상됐어요.');
    }
    const result = normalizeState(raw, now);
    result.images = normalizeImages(raw && raw.images);
    return result;
  }

  /** 합치기: 같은 id는 가져온 쪽으로 덮어쓰고, 새 항목은 기존 목록 위에 붙입니다. */
  function mergeStates(current, incoming) {
    const byId = new Map(current.tasks.map((t) => [t.id, t]));
    let order = T.topOrder(current.tasks);
    const added = [];
    for (const t of incoming.tasks) {
      if (byId.has(t.id)) byId.set(t.id, { ...t, order: byId.get(t.id).order });
      else added.push(t);
    }
    // 가져온 순서를 유지하며 맨 위에 쌓습니다.
    for (let i = added.length - 1; i >= 0; i -= 1) {
      added[i] = { ...added[i], order: order };
      order -= 1;
    }
    const history = { ...current.history };
    for (const [key, value] of Object.entries(incoming.history)) {
      history[key] = Math.max(history[key] ?? 0, value);
    }
    return {
      tasks: T.compactOrder([...added, ...byId.values()]),
      history,
      settings: current.settings,
    };
  }

  return {
    KEY,
    BACKUP_KEY,
    SCHEMA_VERSION,
    DEFAULT_SETTINGS,
    emptyState,
    normalizeState,
    createStore,
    buildExport,
    exportFileName,
    parseImport,
    normalizeImages,
    mergeStates,
  };
});
