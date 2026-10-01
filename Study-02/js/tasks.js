/**
 * 할 일 데이터를 다루는 순수 함수 모음.
 *
 * DOM이나 저장소를 전혀 건드리지 않으므로 브라우저와 Node(테스트) 양쪽에서
 * 그대로 쓸 수 있습니다. 브라우저에서는 window.TodoTasks 로, Node에서는
 * require('./tasks.js') 로 불러옵니다.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TodoTasks = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_TEXT = 200;
  const MAX_NOTE = 5000;
  const MAX_IMAGES = 10;

  const CATEGORIES = [
    { id: 'work', label: '업무', aliases: ['업무', 'work', '일'] },
    { id: 'personal', label: '개인', aliases: ['개인', 'personal', '생활'] },
    { id: 'study', label: '공부', aliases: ['공부', 'study', '학습', '과제'] },
  ];

  const SORTS = [
    { id: 'manual', label: '직접 정렬' },
    { id: 'created-desc', label: '최신순' },
    { id: 'created-asc', label: '오래된순' },
    { id: 'due', label: '마감일순' },
    { id: 'category', label: '카테고리순' },
  ];

  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

  const categoryIds = CATEGORIES.map((c) => c.id);
  const sortIds = SORTS.map((s) => s.id);

  // ---------------------------------------------------------------------------
  // 날짜 도우미
  // 날짜는 모두 '로컬' 기준 YYYY-MM-DD 문자열로 다룹니다. toISOString()은 UTC라서
  // 한국 시간 오전 0~9시에는 하루 전 날짜가 나오는 문제가 있어 쓰지 않습니다.
  // ---------------------------------------------------------------------------

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function toDateKey(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function parseDateKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function isValidDateKey(key) {
    if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
    return toDateKey(parseDateKey(key)) === key;
  }

  function addDays(date, days) {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    next.setDate(next.getDate() + days);
    return next;
  }

  /** 두 날짜 키 사이의 일수 (b - a). 서머타임과 무관하게 정수로 나옵니다. */
  function daysBetween(aKey, bKey) {
    const a = parseDateKey(aKey);
    const b = parseDateKey(bKey);
    return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
      - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
  }

  // ---------------------------------------------------------------------------
  // 빠른 입력 문법
  //   #업무 #개인 #공부 (#과제)                  카테고리
  //   @오늘 @내일 @모레 @금 @10/5 @2026-10-05   마감일
  //   @10/3~10/7  @오늘~금                       기간 (시작일~마감일)
  // 토큰은 공백으로 구분된 단어 전체가 일치할 때만 인식합니다. 그래서
  // "메일@회사"나 "C#" 같은 일반 문장은 건드리지 않습니다.
  // ---------------------------------------------------------------------------

  function findCategory(word) {
    const w = word.toLowerCase();
    return CATEGORIES.find((c) => c.aliases.includes(w))?.id ?? null;
  }

  function parseDateToken(word, now) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const relative = { '오늘': 0, today: 0, '내일': 1, tomorrow: 1, '모레': 2 };
    const lower = word.toLowerCase();
    if (lower in relative) return toDateKey(addDays(today, relative[lower]));

    // 요일: '금' 또는 '금요일' → 오늘 포함 가장 가까운 그 요일
    const weekday = word.replace(/요일$/, '');
    const wIndex = WEEKDAYS.indexOf(weekday);
    if (weekday.length === 1 && wIndex >= 0) {
      return toDateKey(addDays(today, (wIndex - today.getDay() + 7) % 7));
    }

    if (isValidDateKey(word)) return word;

    // 10/5, 10-5, 10.5 → 올해 날짜, 이미 지났으면 내년
    const md = word.match(/^(\d{1,2})[/.-](\d{1,2})$/);
    if (md) {
      const month = Number(md[1]);
      const day = Number(md[2]);
      let candidate = new Date(today.getFullYear(), month - 1, day);
      if (candidate.getMonth() !== month - 1) return null;
      if (candidate < today) candidate = new Date(today.getFullYear() + 1, month - 1, day);
      return toDateKey(candidate);
    }
    return null;
  }

  /** '10/3~10/7' 같은 기간. 순서가 뒤집혀 있으면 바로잡습니다. */
  function parseRangeToken(word, now) {
    const parts = word.split('~');
    if (parts.length !== 2) return null;
    const a = parseDateToken(parts[0], now);
    const b = parseDateToken(parts[1], now);
    if (!a || !b) return null;
    return a <= b ? { start: a, due: b } : { start: b, due: a };
  }

  /**
   * 입력 문자열에서 빠른 입력 토큰을 찾아 떼어 냅니다.
   * @returns {{text: string, category: string|null, start: string|null, due: string|null}}
   */
  function parseQuickAdd(input, now = new Date()) {
    const result = { text: '', category: null, start: null, due: null };
    const kept = [];
    for (const token of String(input).split(/\s+/).filter(Boolean)) {
      if (token.length > 1 && token[0] === '#') {
        const category = findCategory(token.slice(1));
        if (category) { result.category = category; continue; }
      }
      if (token.length > 1 && token[0] === '@') {
        const range = parseRangeToken(token.slice(1), now);
        if (range) { result.start = range.start; result.due = range.due; continue; }
        const due = parseDateToken(token.slice(1), now);
        if (due) { result.due = due; result.start = null; continue; }
      }
      kept.push(token);
    }
    result.text = kept.join(' ');
    return result;
  }

  // ---------------------------------------------------------------------------
  // 할 일 생성 / 정리
  // ---------------------------------------------------------------------------

  function makeId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function cleanText(text) {
    return String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
  }

  /** 메모는 줄바꿈을 살리고, 끝의 공백과 3줄 넘게 이어진 빈 줄만 정리합니다. */
  function cleanNote(note) {
    return String(note ?? '')
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{4,}/g, '\n\n\n')
      .trim()
      .slice(0, MAX_NOTE);
  }

  function cleanImages(images) {
    if (!Array.isArray(images)) return [];
    const ids = images.filter((id) => typeof id === 'string' && /^[\w-]{1,64}$/.test(id));
    return [...new Set(ids)].slice(0, MAX_IMAGES);
  }

  /** 시작일·마감일을 검사하고, 시작일이 마감일보다 늦으면 서로 바꿉니다. */
  function cleanPeriod(start, due) {
    const s = isValidDateKey(start) ? start : null;
    const d = isValidDateKey(due) ? due : null;
    if (s && d && s > d) return { start: d, due: s };
    return { start: s, due: d };
  }

  function createTask({ text, category = 'work', start = null, due = null, note = '', images = [], order = 0 }, now = new Date()) {
    const iso = now.toISOString();
    return {
      id: makeId(),
      text: cleanText(text),
      category: categoryIds.includes(category) ? category : 'work',
      ...cleanPeriod(start, due),
      note: cleanNote(note),
      images: cleanImages(images),
      completed: false,
      createdAt: iso,
      updatedAt: iso,
      completedAt: null,
      order,
    };
  }

  function isIsoDate(value) {
    return typeof value === 'string' && !Number.isNaN(Date.parse(value));
  }

  /**
   * 외부(가져오기 파일, 오래된 저장 데이터)에서 들어온 값을 안전한 할 일 객체로 바꿉니다.
   * 쓸 수 없는 값이면 null. 강의 버전 앱이 내보낸 JSON 형식도 그대로 받아들입니다.
   */
  function normalizeTask(raw, fallbackOrder = 0, now = new Date()) {
    if (!raw || typeof raw !== 'object') return null;
    const text = cleanText(raw.text ?? raw.title);
    if (!text) return null;
    const createdAt = isIsoDate(raw.createdAt) ? new Date(raw.createdAt).toISOString() : now.toISOString();
    const completed = Boolean(raw.completed);
    let completedAt = null;
    if (completed) completedAt = isIsoDate(raw.completedAt) ? new Date(raw.completedAt).toISOString() : createdAt;
    return {
      id: typeof raw.id === 'string' && /^[\w-]{1,64}$/.test(raw.id) ? raw.id : makeId(),
      text,
      category: categoryIds.includes(raw.category) ? raw.category : 'work',
      ...cleanPeriod(raw.start, raw.due),
      note: cleanNote(raw.note),
      images: cleanImages(raw.images),
      completed,
      createdAt,
      updatedAt: isIsoDate(raw.updatedAt) ? new Date(raw.updatedAt).toISOString() : createdAt,
      completedAt,
      order: Number.isFinite(raw.order) ? raw.order : fallbackOrder,
    };
  }

  /** id가 겹치면 뒤에 오는 항목에 새 id를 줍니다. */
  function dedupeIds(tasks) {
    const seen = new Set();
    return tasks.map((t) => {
      if (!seen.has(t.id)) { seen.add(t.id); return t; }
      const copy = { ...t, id: makeId() };
      seen.add(copy.id);
      return copy;
    });
  }

  // ---------------------------------------------------------------------------
  // 목록 계산: 필터, 정렬, 순서 바꾸기
  // ---------------------------------------------------------------------------

  function matchesFilter(task, { category = 'all', query = '' } = {}) {
    if (category !== 'all' && task.category !== category) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const label = CATEGORIES.find((c) => c.id === task.category)?.label ?? '';
    return task.text.toLowerCase().includes(q)
      || (task.note ?? '').toLowerCase().includes(q)
      || label.includes(q);
  }

  function byCreatedDesc(a, b) {
    return b.createdAt.localeCompare(a.createdAt);
  }

  const comparators = {
    manual: (a, b) => a.order - b.order || byCreatedDesc(a, b),
    'created-desc': byCreatedDesc,
    'created-asc': (a, b) => a.createdAt.localeCompare(b.createdAt),
    due: (a, b) => {
      if (a.due && b.due) return a.due.localeCompare(b.due) || a.order - b.order;
      if (a.due) return -1;
      if (b.due) return 1;
      return a.order - b.order;
    },
    category: (a, b) => categoryIds.indexOf(a.category) - categoryIds.indexOf(b.category)
      || a.order - b.order,
  };

  function sortTasks(tasks, sort) {
    return [...tasks].sort(comparators[sort] ?? comparators.manual);
  }

  /**
   * 화면에 보일 목록. 진행 중인 일과 완료된 일을 나눠서 돌려줍니다.
   * 완료된 일은 정렬 기준과 상관없이 최근에 완료한 순서입니다.
   */
  function visibleLists(tasks, { category = 'all', query = '', sort = 'manual' } = {}) {
    const filtered = tasks.filter((t) => matchesFilter(t, { category, query }));
    const active = sortTasks(filtered.filter((t) => !t.completed), sort);
    const done = filtered
      .filter((t) => t.completed)
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
    return { active, done };
  }

  /** 맨 위에 넣을 새 항목의 order 값 */
  function topOrder(tasks) {
    return tasks.length ? Math.min(...tasks.map((t) => t.order)) - 1 : 0;
  }

  /**
   * 필터가 걸린 상태에서 드래그로 순서를 바꿨을 때, 화면에 보이던 항목들끼리만
   * order 값을 맞바꿔서 숨겨진 항목의 위치는 그대로 둡니다.
   * @param {object[]} tasks 전체 목록
   * @param {string[]} newVisibleIds 드래그 후 화면에 보이는 순서대로의 id
   */
  function applyVisibleOrder(tasks, newVisibleIds) {
    const visible = new Set(newVisibleIds);
    const slots = tasks
      .filter((t) => visible.has(t.id))
      .map((t) => t.order)
      .sort((a, b) => a - b);
    const nextOrder = new Map(newVisibleIds.map((id, i) => [id, slots[i]]));
    return tasks.map((t) => (nextOrder.has(t.id) ? { ...t, order: nextOrder.get(t.id) } : t));
  }

  /** order 값을 0,1,2… 로 다시 매깁니다(값이 계속 작아지는 것을 막기 위해). */
  function compactOrder(tasks) {
    const ranked = [...tasks].sort(comparators.manual);
    const orderOf = new Map(ranked.map((t, i) => [t.id, i]));
    return tasks.map((t) => ({ ...t, order: orderOf.get(t.id) }));
  }

  // ---------------------------------------------------------------------------
  // 달력
  // ---------------------------------------------------------------------------

  /**
   * 달력에 그릴 기간. 시작일이 없으면 등록한 날부터, 마감일이 없으면 시작한 그날 하루입니다.
   * 등록한 날보다 마감일이 이르면(지난 일을 나중에 적은 경우) 마감일 하루로 봅니다.
   */
  function taskSpan(task) {
    let start = task.start ?? toDateKey(new Date(task.createdAt));
    const end = task.due ?? start;
    if (start > end) start = end;
    return { start, end };
  }

  /** 그 달을 덮는 주(일요일 시작) 목록. 각 주는 날짜 키 7개입니다. */
  function monthWeeks(year, month) {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    let cursor = addDays(first, -first.getDay());
    const end = addDays(last, 6 - last.getDay());
    const weeks = [];
    while (cursor <= end) {
      const week = [];
      for (let i = 0; i < 7; i += 1) {
        week.push(toDateKey(cursor));
        cursor = addDays(cursor, 1);
      }
      weeks.push(week);
    }
    return weeks;
  }

  /**
   * 한 주 안에서 할 일 막대를 줄(lane)에 배치합니다. 겹치지 않으면 같은 줄을 씁니다.
   * 여러 날에 걸친 일(과제 기간 등)을 먼저 배치해서 하루짜리 일에 밀려 가려지지 않게 합니다.
   * @returns {{segments: object[], overflow: number[], lanes: number}}
   *   segments: 보이는 막대 {task, startCol, endCol, lane, continuesBefore, continuesAfter}
   *   overflow: 요일별로 자리가 없어 숨긴 개수
   */
  function layoutWeek(weekKeys, tasks, maxLanes = 3) {
    const first = weekKeys[0];
    const last = weekKeys[weekKeys.length - 1];
    const items = [];
    for (const task of tasks) {
      const span = taskSpan(task);
      if (span.end < first || span.start > last) continue;
      const startCol = span.start < first ? 0 : daysBetween(first, span.start);
      const endCol = span.end > last ? weekKeys.length - 1 : daysBetween(first, span.end);
      items.push({
        task,
        startCol,
        endCol,
        multiDay: span.start !== span.end,
        continuesBefore: span.start < first,
        continuesAfter: span.end > last,
      });
    }
    items.sort((a, b) => Number(b.multiDay) - Number(a.multiDay)
      || Number(a.task.completed) - Number(b.task.completed)
      || a.startCol - b.startCol
      || (b.endCol - b.startCol) - (a.endCol - a.startCol)
      || a.task.order - b.task.order);

    // 줄마다 요일별로 차 있는지 기억해서, 중간에 빈 칸이 있으면 그 자리에 넣습니다.
    const lanes = [];
    const segments = [];
    const overflow = new Array(weekKeys.length).fill(0);
    const fits = (used, item) => {
      for (let c = item.startCol; c <= item.endCol; c += 1) if (used[c]) return false;
      return true;
    };
    for (const item of items) {
      let lane = lanes.findIndex((used) => fits(used, item));
      if (lane === -1) { lane = lanes.length; lanes.push(new Array(weekKeys.length).fill(false)); }
      for (let c = item.startCol; c <= item.endCol; c += 1) lanes[lane][c] = true;
      if (lane < maxLanes) segments.push({ ...item, lane });
      else for (let c = item.startCol; c <= item.endCol; c += 1) overflow[c] += 1;
    }
    return { segments, overflow, lanes: Math.min(lanes.length, maxLanes) };
  }

  /** 그날에 걸쳐 있는 할 일 (진행 중 먼저, 마감 빠른 순) */
  function tasksOnDay(tasks, dayKey) {
    return tasks
      .filter((t) => {
        const span = taskSpan(t);
        return span.start <= dayKey && dayKey <= span.end;
      })
      .sort((a, b) => Number(a.completed) - Number(b.completed)
        || taskSpan(a).end.localeCompare(taskSpan(b).end)
        || a.order - b.order);
  }

  // ---------------------------------------------------------------------------
  // 통계
  // ---------------------------------------------------------------------------

  function lastNDays(history, todayKey, n = 7) {
    const today = parseDateKey(todayKey);
    const days = [];
    for (let i = n - 1; i >= 0; i -= 1) {
      const date = addDays(today, -i);
      const key = toDateKey(date);
      days.push({ key, weekday: WEEKDAYS[date.getDay()], count: history[key] ?? 0, isToday: i === 0 });
    }
    return days;
  }

  function computeStats(tasks, history, todayKey) {
    const total = tasks.length;
    const done = tasks.filter((t) => t.completed).length;
    const byCategory = CATEGORIES.map((c) => {
      const inCat = tasks.filter((t) => t.category === c.id);
      return { id: c.id, label: c.label, total: inCat.length, done: inCat.filter((t) => t.completed).length };
    });
    return {
      total,
      done,
      remaining: total - done,
      percent: total ? Math.round((done / total) * 100) : 0,
      addedToday: tasks.filter((t) => toDateKey(new Date(t.createdAt)) === todayKey).length,
      doneToday: history[todayKey] ?? 0,
      overdue: tasks.filter((t) => !t.completed && t.due && t.due < todayKey).length,
      dueToday: tasks.filter((t) => !t.completed && t.due === todayKey).length,
      byCategory,
      week: lastNDays(history, todayKey, 7),
    };
  }

  /** 완료 기록 갱신: 완료하면 +1, 완료를 취소하면 그 일을 완료했던 날짜에서 -1 */
  function recordCompletion(history, dayKey, delta) {
    const next = { ...history };
    const value = Math.max(0, (next[dayKey] ?? 0) + delta);
    if (value) next[dayKey] = value;
    else delete next[dayKey];
    return next;
  }

  /** 오래된 기록 정리 (기본 90일 보관) */
  function pruneHistory(history, todayKey, keepDays = 90) {
    const next = {};
    for (const [key, value] of Object.entries(history ?? {})) {
      if (!isValidDateKey(key) || !(Number.isFinite(value) && value > 0)) continue;
      const age = daysBetween(key, todayKey);
      if (age >= 0 && age < keepDays) next[key] = Math.floor(value);
    }
    return next;
  }

  // ---------------------------------------------------------------------------
  // 표시용 문구
  // ---------------------------------------------------------------------------

  function relativeTime(iso, now = new Date()) {
    const then = new Date(iso);
    const diffMin = Math.floor((now - then) / 60000);
    if (diffMin < 1) return '방금 전';
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHour = Math.floor(diffMin / 60);
    const dayDiff = daysBetween(toDateKey(then), toDateKey(now));
    if (dayDiff === 0) return `${diffHour}시간 전`;
    if (dayDiff === 1) return '어제';
    if (dayDiff < 7) return `${dayDiff}일 전`;
    if (then.getFullYear() === now.getFullYear()) return `${then.getMonth() + 1}월 ${then.getDate()}일`;
    return `${then.getFullYear()}. ${then.getMonth() + 1}. ${then.getDate()}.`;
  }

  /**
   * 마감일 표시. tone은 화면 색을 정하는 데 씁니다.
   * @returns {{label: string, tone: 'overdue'|'today'|'soon'|'later'}|null}
   */
  function dueInfo(due, todayKey) {
    if (!due) return null;
    const diff = daysBetween(todayKey, due);
    if (diff < 0) return { label: `${-diff}일 지남`, tone: 'overdue' };
    if (diff === 0) return { label: '오늘까지', tone: 'today' };
    if (diff === 1) return { label: '내일까지', tone: 'soon' };
    const date = parseDateKey(due);
    if (diff < 7) return { label: `${WEEKDAYS[date.getDay()]}요일까지`, tone: 'soon' };
    return { label: `${formatMonthDay(due, todayKey)}까지`, tone: 'later' };
  }

  /** 아직 시작 전인 일의 시작일 표시. 시작했거나 시작일이 없으면 null */
  function startInfo(start, todayKey) {
    if (!start || start <= todayKey) return null;
    const diff = daysBetween(todayKey, start);
    if (diff === 1) return '내일 시작';
    return `${formatMonthDay(start, todayKey)} 시작`;
  }

  function formatMonthDay(key, todayKey) {
    const date = parseDateKey(key);
    const sameYear = !todayKey || date.getFullYear() === parseDateKey(todayKey).getFullYear();
    return sameYear
      ? `${date.getMonth() + 1}월 ${date.getDate()}일`
      : `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`;
  }

  function formatLongDate(date) {
    return `${date.getMonth() + 1}월 ${date.getDate()}일 ${WEEKDAYS[date.getDay()]}요일`;
  }

  function formatShortDate(key) {
    const date = parseDateKey(key);
    return `${date.getMonth() + 1}월 ${date.getDate()}일(${WEEKDAYS[date.getDay()]})`;
  }

  /** 기간 문구: '10월 3일(토) ~ 10월 7일(수)' 또는 하루면 '10월 3일(토)' */
  function formatPeriod(start, end) {
    return start === end ? formatShortDate(start) : `${formatShortDate(start)} ~ ${formatShortDate(end)}`;
  }

  return {
    MAX_TEXT,
    MAX_NOTE,
    MAX_IMAGES,
    CATEGORIES,
    SORTS,
    WEEKDAYS,
    categoryIds,
    sortIds,
    toDateKey,
    parseDateKey,
    isValidDateKey,
    addDays,
    daysBetween,
    parseQuickAdd,
    makeId,
    cleanText,
    cleanNote,
    cleanPeriod,
    createTask,
    normalizeTask,
    dedupeIds,
    matchesFilter,
    sortTasks,
    visibleLists,
    topOrder,
    applyVisibleOrder,
    compactOrder,
    taskSpan,
    monthWeeks,
    layoutWeek,
    tasksOnDay,
    lastNDays,
    computeStats,
    recordCompletion,
    pruneHistory,
    relativeTime,
    dueInfo,
    startInfo,
    formatMonthDay,
    formatLongDate,
    formatShortDate,
    formatPeriod,
  };
});
