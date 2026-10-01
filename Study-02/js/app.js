/**
 * 화면(DOM)과 사용자 입력을 담당합니다.
 * 데이터 계산은 tasks.js, 저장은 storage.js, 사진 저장은 images.js에 맡기고
 * 여기서는 그 결과를 그리기만 합니다.
 */
(function () {
  'use strict';

  const T = window.TodoTasks;
  const S = window.TodoStorage;
  const IMG = window.TodoImages;

  const QUOTES = [
    '작은 진전도 큰 성과입니다.',
    '시작이 반이다.',
    '오늘 할 수 있는 일에 집중하세요.',
    '완벽보다 완료가 낫다.',
    '천 리 길도 한 걸음부터.',
    '하나씩 끝내면 전부 끝난다.',
    '꾸준함이 재능을 이긴다.',
    '가장 어려운 일을 먼저 하세요.',
    '할 일을 적는 순간 머리가 가벼워진다.',
    '어제보다 한 걸음만 더.',
    '쉬는 것도 계획의 일부입니다.',
    '노력하는 모든 순간이 소중해요.',
    '큰 일은 작게 나누면 쉬워진다.',
    '지금 5분만 해 보세요.',
  ];

  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');
  const DARK_QUERY = window.matchMedia('(prefers-color-scheme: dark)');
  const NARROW = window.matchMedia('(max-width: 520px)');

  // ---------------------------------------------------------------------------
  // 상태
  // ---------------------------------------------------------------------------

  const store = S.createStore(getBackend());
  let state = store.load().state;
  state.history = T.pruneHistory(state.history, todayKey());

  const now0 = new Date();
  const ui = {
    query: '',
    quoteOffset: 0,
    rendered: false,
    calYear: now0.getFullYear(),
    calMonth: now0.getMonth(),
    calDay: todayKey(),
    detail: null, // { id, images: string[] } 상세 창에서 고치는 중인 사본
    imagesOk: false,
  };

  let undo = null; // { label, snapshot }
  let toastTimer = 0;
  let pendingImport = null;

  /** 노드 캐시: id → { el, sig }. 바뀐 항목만 다시 그리기 위해 씁니다. */
  const nodes = new Map();

  function getBackend() {
    try {
      return window.localStorage;
    } catch {
      const fail = () => { throw new Error('unavailable'); };
      return { getItem: fail, setItem: fail, removeItem: fail };
    }
  }

  function todayKey() {
    return T.toDateKey(new Date());
  }

  // ---------------------------------------------------------------------------
  // DOM 참조
  // ---------------------------------------------------------------------------

  const $ = (id) => document.getElementById(id);
  const els = Object.fromEntries([
    'todayLabel', 'themeBtn', 'helpBtn', 'storageBanner', 'dashToggle', 'dashBody',
    'ringWrap', 'ringFill', 'ringPercent', 'ringCount', 'ringSub',
    'statRemaining', 'statDoneToday', 'statDueToday', 'statOverdue', 'tileOverdue',
    'catProgress', 'weekBars', 'quote', 'quoteBtn',
    'addForm', 'taskInput', 'catSelect', 'startInput', 'dueInput', 'parsePreview',
    'searchInput', 'sortSelect', 'sortWrap', 'filterChips',
    'listView', 'activeList', 'doneList', 'emptyState', 'doneSection', 'doneCount',
    'calendarView', 'calPrev', 'calNext', 'calToday', 'calTitle', 'calGrid',
    'dayTitle', 'dayList', 'dayEmpty', 'addOnDay',
    'remainingLabel', 'clearDoneBtn', 'exportBtn', 'importBtn', 'importFile',
    'importDialog', 'importSummary', 'helpDialog',
    'detailDialog', 'detailForm', 'detailDone', 'detailText', 'detailClose', 'detailCategory',
    'detailStart', 'detailDue', 'detailNote', 'noteCounter', 'gallery', 'addImageBtn',
    'imageFile', 'imageHint', 'imageCounter', 'detailMeta', 'detailDelete', 'detailCancel',
    'viewerDialog', 'viewerImg',
    'toast', 'toastText', 'toastUndo', 'announcer',
  ].map((id) => [id, $(id)]));
  const viewButtons = [...document.querySelectorAll('.view-switch [data-view]')];

  // ---------------------------------------------------------------------------
  // 상태 변경 → 저장 → 다시 그리기
  // ---------------------------------------------------------------------------

  function commit(next, { undoLabel, toast, announce } = {}) {
    if (undoLabel) undo = { label: undoLabel, snapshot: { tasks: state.tasks, history: state.history } };
    state = next;
    persist();
    render();
    if (undoLabel) showToast(undoLabel, { withUndo: true });
    else if (toast) showToast(toast);
    if (announce) say(announce);
  }

  function updateTasks(fn, opts) {
    commit({ ...state, tasks: fn(state.tasks) }, opts);
  }

  function updateSettings(patch) {
    state = { ...state, settings: { ...state.settings, ...patch } };
    persist();
    render();
  }

  function persist() {
    const ok = store.save(state);
    els.storageBanner.hidden = ok;
  }

  function runUndo() {
    if (!undo) return;
    const { snapshot } = undo;
    undo = null;
    state = { ...state, tasks: snapshot.tasks, history: snapshot.history };
    persist();
    render();
    showToast('되돌렸어요');
    say('되돌렸어요');
  }

  // ---------------------------------------------------------------------------
  // 할 일 조작
  // ---------------------------------------------------------------------------

  function findTask(id) {
    return state.tasks.find((t) => t.id === id);
  }

  function addTask() {
    const parsed = T.parseQuickAdd(els.taskInput.value);
    if (!parsed.text) {
      shake(els.taskInput);
      showToast(els.taskInput.value.trim() ? '할 일 내용도 함께 적어 주세요' : '할 일을 입력해 주세요');
      els.taskInput.focus();
      return;
    }
    const fromTokens = Boolean(parsed.due);
    const task = T.createTask({
      text: parsed.text,
      category: parsed.category ?? els.catSelect.value,
      start: fromTokens ? parsed.start : (els.startInput.value || null),
      due: fromTokens ? parsed.due : (els.dueInput.value || null),
      order: T.topOrder(state.tasks),
    });

    // 새 항목이 지금 필터에 가려지면 필터를 풀어서 바로 보이게 합니다.
    if (!T.matchesFilter(task, { category: state.settings.category, query: ui.query })) {
      ui.query = '';
      els.searchInput.value = '';
      state = { ...state, settings: { ...state.settings, category: 'all' } };
    }

    // 달력 보기에서는 새 일정의 마감일(없으면 시작일)로 이동해서 보여 줍니다.
    if (state.settings.view === 'calendar') {
      const span = T.taskSpan(task);
      goToDay(span.end);
    }

    els.taskInput.value = '';
    els.startInput.value = '';
    els.dueInput.value = '';
    renderParsePreview();
    updateTasks((tasks) => [task, ...tasks], { announce: `"${task.text}" 추가됨` });
    nodes.get(task.id)?.el.scrollIntoView({ block: 'nearest', behavior: REDUCED_MOTION.matches ? 'auto' : 'smooth' });
  }

  /** 완료 상태를 바꾼 새 할 일과 기록을 돌려줍니다. */
  function withCompletion(task, completed, history, now = new Date()) {
    if (task.completed === completed) return { task, history };
    if (completed) {
      return {
        task: { ...task, completed: true, completedAt: now.toISOString(), updatedAt: now.toISOString() },
        history: T.recordCompletion(history, T.toDateKey(now), 1),
      };
    }
    const h = task.completedAt ? T.recordCompletion(history, T.toDateKey(new Date(task.completedAt)), -1) : history;
    return { task: { ...task, completed: false, completedAt: null, updatedAt: now.toISOString() }, history: h };
  }

  function toggleTask(id) {
    const task = findTask(id);
    if (!task) return;
    const { task: next, history } = withCompletion(task, !task.completed, state.history);
    const tasks = state.tasks.map((t) => (t.id === id ? next : t));
    commit({ ...state, tasks, history }, { announce: next.completed ? `"${task.text}" 완료` : `"${task.text}" 다시 진행 중` });
    const li = nodes.get(id)?.el;
    if (li && next.completed && !REDUCED_MOTION.matches) {
      li.classList.add('just-done');
      li.addEventListener('animationend', () => li.classList.remove('just-done'), { once: true });
    }
    if (next.completed && tasks.length && tasks.every((t) => t.completed)) {
      showToast('모든 할 일을 끝냈어요! 수고했어요');
    }
  }

  function deleteTask(id) {
    if (!findTask(id)) return;
    const focusTarget = neighborId(id);
    animateOut(id, () => {
      updateTasks((tasks) => tasks.filter((t) => t.id !== id), { undoLabel: '할 일을 삭제했어요' });
      focusTask(focusTarget);
    });
  }

  function clearDone() {
    const count = state.tasks.filter((t) => t.completed).length;
    if (!count) return;
    updateTasks((tasks) => tasks.filter((t) => !t.completed), {
      undoLabel: `완료된 할 일 ${count}개를 삭제했어요`,
    });
  }

  /** 키보드로 한 칸 위/아래로 옮기기 (직접 정렬일 때만) */
  function moveTask(id, direction) {
    if (state.settings.sort !== 'manual') {
      showToast('순서를 바꾸려면 정렬을 "직접 정렬"로 바꿔 주세요');
      return;
    }
    const ids = idsOf(els.activeList);
    const i = ids.indexOf(id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    updateTasks((tasks) => T.applyVisibleOrder(tasks, ids));
    focusTask(id, 'handle');
  }

  function setCategoryFilter(category) {
    updateSettings({ category });
    if (category !== 'all') els.catSelect.value = category;
  }

  function setView(view) {
    if (state.settings.view === view) return;
    updateSettings({ view });
  }

  // ---------------------------------------------------------------------------
  // 상세 창 (제목·카테고리·기간·메모·사진)
  // ---------------------------------------------------------------------------

  function openDetail(id) {
    const task = findTask(id);
    if (!task) return;
    ui.detail = { id, images: [...task.images], returnFocus: document.activeElement };
    els.detailDone.checked = task.completed;
    els.detailText.value = task.text;
    els.detailCategory.value = task.category;
    els.detailStart.value = task.start ?? '';
    els.detailDue.value = task.due ?? '';
    els.detailNote.value = task.note;
    els.detailDialog.classList.toggle('is-done', task.completed);
    els.detailDialog.dataset.category = task.category;
    updateNoteCounter();
    renderDetailMeta(task);
    renderGallery();
    els.imageHint.hidden = true;
    // 더블클릭으로 열면 두 번째 클릭이 막 열린 창 안의 버튼을 누르게 됩니다. 잠깐 클릭을 막습니다.
    els.detailDialog.classList.add('is-opening');
    setTimeout(() => els.detailDialog.classList.remove('is-opening'), 350);
    els.detailDialog.showModal();
    autosizeNote();
    els.detailText.focus();
    els.detailText.setSelectionRange(els.detailText.value.length, els.detailText.value.length);
  }

  /** 상세 창 저장. 내용이 비어 있으면 저장하지 않고 false */
  function saveDetail() {
    const d = ui.detail;
    const task = d && findTask(d.id);
    if (!task) { closeDetail(); return true; }
    const text = T.cleanText(els.detailText.value);
    if (!text) {
      shake(els.detailText);
      showToast('할 일 내용을 적어 주세요');
      els.detailText.focus();
      return false;
    }
    const period = T.cleanPeriod(els.detailStart.value || null, els.detailDue.value || null);
    let next = {
      ...task,
      text,
      category: els.detailCategory.value,
      ...period,
      note: T.cleanNote(els.detailNote.value),
      images: d.images,
    };
    const changed = ['text', 'category', 'start', 'due', 'note'].some((k) => next[k] !== task[k])
      || next.images.join() !== task.images.join();
    if (changed) next.updatedAt = new Date().toISOString();

    const completion = withCompletion(next, els.detailDone.checked, state.history);
    next = completion.task;
    closeDetail();
    if (changed || next.completed !== task.completed) {
      commit({ ...state, tasks: state.tasks.map((t) => (t.id === task.id ? next : t)), history: completion.history },
        { announce: '저장됨' });
    }
    return true;
  }

  function closeDetail() {
    const d = ui.detail;
    ui.detail = null;
    if (els.detailDialog.open) els.detailDialog.close();
    if (d) focusTask(d.id) || d.returnFocus?.focus?.();
  }

  function renderDetailMeta(task) {
    const fmt = (iso) => new Date(iso).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const parts = [`등록 ${fmt(task.createdAt)}`];
    if (task.updatedAt !== task.createdAt) parts.push(`수정 ${fmt(task.updatedAt)}`);
    if (task.completedAt) parts.push(`완료 ${fmt(task.completedAt)}`);
    els.detailMeta.textContent = parts.join(' · ');
  }

  function updateNoteCounter() {
    const n = els.detailNote.value.length;
    els.noteCounter.textContent = n ? `${n.toLocaleString()} / ${T.MAX_NOTE.toLocaleString()}` : '';
  }

  function autosizeNote() {
    const area = els.detailNote;
    area.style.height = 'auto';
    area.style.height = `${Math.min(Math.max(area.scrollHeight + 2, 110), 360)}px`;
  }

  function renderGallery() {
    const d = ui.detail;
    if (!d) return;
    const thumbs = d.images.map((id, i) => {
      const img = el('img', { alt: `사진 ${i + 1}`, loading: 'lazy', decoding: 'async' });
      setImageSrc(img, id);
      return el('div', { className: 'thumb', dataset: { image: id } },
        el('button', { type: 'button', className: 'thumb-open', dataset: { role: 'view' }, 'aria-label': `사진 ${i + 1} 크게 보기` }, img),
        el('button', { type: 'button', className: 'thumb-remove', dataset: { role: 'remove' }, 'aria-label': `사진 ${i + 1} 빼기`, title: '사진 빼기' }, icon('close')));
    });
    els.addImageBtn.hidden = !ui.imagesOk || d.images.length >= T.MAX_IMAGES;
    els.gallery.replaceChildren(...thumbs, els.addImageBtn);
    els.imageCounter.textContent = d.images.length ? `${d.images.length} / ${T.MAX_IMAGES}` : '';
    if (!ui.imagesOk) {
      els.imageHint.hidden = false;
      els.imageHint.textContent = '이 브라우저에서는 사진을 저장할 수 없어요. (사생활 보호 모드 등)';
    }
  }

  async function addImages(files) {
    const d = ui.detail;
    if (!d || !ui.imagesOk) return;
    const list = [...files].filter((f) => f.type.startsWith('image/'));
    if (!list.length) {
      showToast('이미지 파일만 붙일 수 있어요');
      return;
    }
    const room = T.MAX_IMAGES - d.images.length;
    if (list.length > room) showToast(`사진은 할 일 하나에 ${T.MAX_IMAGES}장까지예요`);
    els.gallery.classList.add('is-busy');
    try {
      for (const file of list.slice(0, Math.max(0, room))) {
        try {
          const id = await IMG.add(file, T.makeId);
          if (ui.detail !== d) return; // 처리하는 동안 창을 닫았으면 중단
          d.images.push(id);
          renderGallery();
        } catch (err) {
          showToast(err.message || '사진을 저장하지 못했어요');
        }
      }
    } finally {
      els.gallery.classList.remove('is-busy');
    }
  }

  async function setImageSrc(img, id) {
    try {
      const url = await IMG.url(id);
      if (url) img.src = url;
      else img.closest('.thumb, .task-thumb')?.classList.add('is-missing');
    } catch {
      img.closest('.thumb, .task-thumb')?.classList.add('is-missing');
    }
  }

  async function openViewer(id) {
    const url = await IMG.url(id).catch(() => null);
    if (!url) return;
    els.viewerImg.src = url;
    els.viewerDialog.showModal();
  }

  // ---------------------------------------------------------------------------
  // 그리기
  // ---------------------------------------------------------------------------

  function render() {
    const now = new Date();
    const today = T.toDateKey(now);
    const focus = rememberFocus();
    const stats = T.computeStats(state.tasks, state.history, today);
    const view = state.settings.view;

    renderHeader(now);
    renderDashboard(stats, today);
    renderControls(stats);
    els.listView.hidden = view !== 'list';
    els.calendarView.hidden = view !== 'calendar';
    els.sortWrap.hidden = view !== 'list';
    if (view === 'list') renderLists(now, today, stats);
    else renderCalendar(today);
    restoreFocus(focus);
    ui.rendered = true;
  }

  function renderHeader(now) {
    els.todayLabel.textContent = T.formatLongDate(now);
    els.themeBtn.setAttribute('aria-checked', String(effectiveTheme() === 'dark'));
  }

  function renderDashboard(stats, today) {
    const open = state.settings.dashboardOpen;
    els.dashBody.hidden = !open;
    els.dashToggle.setAttribute('aria-expanded', String(open));
    els.dashToggle.querySelector('span').textContent = open ? '접기' : '펼치기';
    if (!open) return;

    const circumference = 2 * Math.PI * 34;
    els.ringFill.style.strokeDasharray = `${circumference}`;
    els.ringFill.style.strokeDashoffset = `${circumference * (1 - stats.percent / 100)}`;
    els.ringPercent.textContent = `${stats.percent}%`;
    els.ringWrap.setAttribute('aria-label', `전체 진행률 ${stats.percent}%`);
    els.ringCount.textContent = `${stats.done}/${stats.total} 완료`;
    els.ringSub.textContent = `오늘 추가 ${stats.addedToday}개`;

    els.statRemaining.textContent = stats.remaining;
    els.statDoneToday.textContent = stats.doneToday;
    els.statDueToday.textContent = stats.dueToday;
    els.statOverdue.textContent = stats.overdue;
    els.tileOverdue.classList.toggle('is-active', stats.overdue > 0);

    // 카테고리별 진행률 (누르면 그 카테고리로 필터)
    els.catProgress.replaceChildren(...stats.byCategory.map((c) => {
      const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
      return el('button', {
        type: 'button',
        className: 'cat-card',
        dataset: { category: c.id },
        'aria-pressed': String(state.settings.category === c.id),
        'aria-label': `${c.label} ${c.total}개 중 ${c.done}개 완료`,
        title: `${c.label}만 보기`,
      },
      el('span', { className: 'cat-name' }, el('i', { className: 'dot' }), c.label),
      el('span', { className: 'cat-count' }, `${c.done}/${c.total}`),
      el('span', { className: 'mini-bar', 'aria-hidden': 'true' }, el('span', { style: `width:${pct}%` })));
    }));

    // 최근 7일 막대
    const max = Math.max(1, ...stats.week.map((d) => d.count));
    els.weekBars.replaceChildren(...stats.week.map((d) => {
      const h = d.count ? Math.max(8, (d.count / max) * 100) : 0;
      return el('div', {
        className: `bar-col${d.isToday ? ' is-today' : ''}`,
        tabIndex: 0,
        role: 'img',
        'aria-label': `${T.formatShortDate(d.key)} ${d.count}개 완료`,
        dataset: { tip: `${d.isToday ? '오늘' : T.formatShortDate(d.key)} · ${d.count}개` },
      },
      el('span', { className: 'bar-track' }, el('span', { className: 'bar', style: `height:${h}%` })),
      el('span', { className: 'bar-day' }, d.isToday ? '오늘' : d.weekday));
    }));

    const dayNumber = Math.floor(T.parseDateKey(today).getTime() / 86400000);
    els.quote.textContent = QUOTES[(dayNumber + ui.quoteOffset) % QUOTES.length];
  }

  function renderControls(stats) {
    const { category, sort, view } = state.settings;
    if (els.sortSelect.value !== sort) els.sortSelect.value = sort;
    for (const btn of viewButtons) btn.setAttribute('aria-pressed', String(btn.dataset.view === view));

    const remainingBy = Object.fromEntries(stats.byCategory.map((c) => [c.id, c.total - c.done]));
    const chips = [{ id: 'all', label: '전체', count: stats.remaining }]
      .concat(T.CATEGORIES.map((c) => ({ id: c.id, label: c.label, count: remainingBy[c.id] })));
    els.filterChips.replaceChildren(...chips.map((c, i) => el('button', {
      type: 'button',
      className: 'chip',
      dataset: { category: c.id },
      'aria-pressed': String(category === c.id),
      title: `${c.label} (Alt+${i + 1})`,
    }, c.id === 'all' ? null : el('i', { className: 'dot' }), c.label, el('span', { className: 'count' }, String(c.count)))));

    els.remainingLabel.textContent = stats.remaining ? `남은 할 일 ${stats.remaining}개` : '남은 할 일 없음';
    els.clearDoneBtn.disabled = stats.done === 0;
  }

  // ---------- 목록 ----------

  function renderLists(now, today, stats) {
    const { category, sort, showDone } = state.settings;
    const { active, done } = T.visibleLists(state.tasks, { category, query: ui.query, sort });
    document.body.classList.toggle('is-manual', sort === 'manual');

    syncList(els.activeList, active, now, today);
    syncList(els.doneList, done, now, today);

    const alive = new Set(state.tasks.map((t) => t.id));
    for (const id of nodes.keys()) if (!alive.has(id)) nodes.delete(id);

    els.doneSection.hidden = done.length === 0;
    els.doneCount.textContent = done.length;
    if (els.doneSection.open !== showDone) els.doneSection.open = showDone;

    renderEmpty(active, done, stats);
  }

  function renderEmpty(active, done, stats) {
    let message = '';
    let sub = '';
    if (active.length === 0) {
      const label = T.CATEGORIES.find((c) => c.id === state.settings.category)?.label;
      if (stats.total === 0) {
        message = '할 일이 없습니다. 추가해 보세요!';
        sub = '위 입력창에 오늘 할 일을 적고 Enter를 누르면 돼요.';
      } else if (ui.query) {
        message = `'${ui.query}'와(과) 일치하는 할 일이 없어요`;
        sub = '검색어를 바꾸거나 지워 보세요.';
      } else if (label && stats.remaining > 0) {
        message = `${label}에 남은 할 일이 없어요`;
        sub = '다른 카테고리에 할 일이 남아 있어요.';
      } else {
        message = '모든 할 일을 끝냈어요!';
        sub = done.length ? '완료한 일은 아래에서 다시 볼 수 있어요.' : '';
      }
    }
    els.emptyState.hidden = !message;
    els.emptyState.replaceChildren(...[el('strong', {}, message), sub ? el('span', {}, sub) : null].filter(Boolean));
  }

  /** 목록을 바뀐 부분만 고칩니다(항목 노드를 재사용해서 애니메이션과 포커스를 지킵니다). */
  function syncList(listEl, tasks, now, today) {
    const wanted = new Set(tasks.map((t) => t.id));
    const stale = [...listEl.children].filter((child) => !wanted.has(child.dataset.id));
    // 검색처럼 한 번에 많이 사라질 때는 하나씩 지우는 것보다 통째로 비우는 편이 빠릅니다.
    if (stale.length > 30) listEl.replaceChildren(...[...listEl.children].filter((c) => wanted.has(c.dataset.id)));
    else stale.forEach((child) => child.remove());

    let prev = null;
    for (const task of tasks) {
      let entry = nodes.get(task.id);
      const isNew = !entry;
      if (!entry) {
        entry = { el: el('li', { className: 'task', dataset: { id: task.id } }), sig: '' };
        nodes.set(task.id, entry);
      }
      const sig = signature(task, now, today);
      if (entry.sig !== sig) {
        fillTask(entry.el, task, now, today);
        entry.sig = sig;
      }
      const expected = prev ? prev.nextSibling : listEl.firstChild;
      if (entry.el !== expected) listEl.insertBefore(entry.el, expected);
      if (isNew && ui.rendered && !REDUCED_MOTION.matches) {
        entry.el.classList.add('is-entering');
        entry.el.addEventListener('animationend', () => entry.el.classList.remove('is-entering'), { once: true });
      }
      prev = entry.el;
    }
  }

  function signature(task, now, today) {
    const stamp = task.completed ? task.completedAt : task.createdAt;
    return [task.text, task.category, task.start, task.due, task.completed, task.note.length,
      task.images.join(','), T.relativeTime(stamp, now), today].join('|');
  }

  function fillTask(li, task, now, today) {
    li.className = `task cat-${task.category}${task.completed ? ' is-done' : ''}`;
    li.dataset.id = task.id;

    const handle = el('button', {
      type: 'button',
      className: 'handle',
      dataset: { role: 'handle' },
      'aria-label': `"${task.text}" 순서 옮기기 (Alt+위/아래 화살표)`,
      title: '끌어서 순서 바꾸기',
    }, icon('grip'));

    const check = el('label', { className: 'check' },
      el('input', { type: 'checkbox', dataset: { role: 'toggle' }, checked: task.completed, 'aria-label': `"${task.text}" 완료` }),
      el('span', { className: 'check-box', 'aria-hidden': 'true' }, icon('check')));

    const meta = el('span', { className: 'task-meta' });
    const cat = T.CATEGORIES.find((c) => c.id === task.category);
    meta.append(el('span', { className: 'tag' }, el('i', { className: 'dot' }), cat.label));
    if (!task.completed) {
      const startLabel = T.startInfo(task.start, today);
      if (startLabel) meta.append(el('span', { className: 'due due-later' }, icon('calendar'), startLabel));
      const due = T.dueInfo(task.due, today);
      if (due) {
        meta.append(el('span', { className: `due due-${due.tone}`, title: T.formatPeriod(T.taskSpan(task).start, task.due) },
          icon(due.tone === 'overdue' ? 'alert' : 'calendar'), due.label));
      }
    }
    if (task.note) meta.append(el('span', { className: 'attach', title: '메모 있음' }, icon('note'), '메모'));
    if (task.images.length) meta.append(el('span', { className: 'attach', title: `사진 ${task.images.length}장` }, icon('image'), String(task.images.length)));
    const stamp = task.completed ? task.completedAt : task.createdAt;
    meta.append(el('time', { dateTime: stamp, title: new Date(stamp).toLocaleString('ko-KR') },
      task.completed ? `완료 · ${T.relativeTime(stamp, now)}` : T.relativeTime(stamp, now)));

    // 본문 전체가 상세 창을 여는 버튼입니다(누르면 메모·사진까지 볼 수 있음).
    const main = el('button', {
      type: 'button',
      className: 'task-main',
      dataset: { role: 'open' },
      'aria-label': `"${task.text}" 자세히 보기`,
    },
    el('span', { className: 'task-text' }, task.text),
    task.note ? el('span', { className: 'task-note' }, task.note.split('\n')[0]) : null,
    meta);

    let thumb = null;
    if (task.images.length) {
      const img = el('img', { alt: '', loading: 'lazy', decoding: 'async' });
      setImageSrc(img, task.images[0]);
      thumb = el('span', { className: 'task-thumb', dataset: { role: 'open' }, 'aria-hidden': 'true' }, img);
    }

    const actions = el('div', { className: 'task-actions' },
      el('button', { type: 'button', className: 'icon-btn small', dataset: { role: 'edit' }, 'aria-label': `"${task.text}" 수정`, title: '자세히·수정' }, icon('edit')),
      el('button', { type: 'button', className: 'icon-btn small danger', dataset: { role: 'delete' }, 'aria-label': `"${task.text}" 삭제`, title: '삭제 (Delete)' }, icon('trash')));

    // replaceChildren은 null을 "null" 글자로 넣으므로 빈 값은 걸러 냅니다.
    li.replaceChildren(...[task.completed ? el('span', { className: 'handle-space' }) : handle, check, main, thumb, actions].filter(Boolean));
  }

  // ---------- 달력 ----------

  function goToDay(key) {
    const d = T.parseDateKey(key);
    ui.calYear = d.getFullYear();
    ui.calMonth = d.getMonth();
    ui.calDay = key;
  }

  function shiftMonth(delta) {
    const d = new Date(ui.calYear, ui.calMonth + delta, 1);
    ui.calYear = d.getFullYear();
    ui.calMonth = d.getMonth();
    render();
  }

  function renderCalendar(today) {
    const { category } = state.settings;
    const tasks = state.tasks.filter((t) => T.matchesFilter(t, { category, query: ui.query }));
    const maxLanes = NARROW.matches ? 2 : 3;
    els.calTitle.textContent = `${ui.calYear}년 ${ui.calMonth + 1}월`;
    els.calGrid.style.setProperty('--lanes', maxLanes);

    const weeks = T.monthWeeks(ui.calYear, ui.calMonth);
    els.calGrid.replaceChildren(...weeks.map((week) => {
      const { segments, overflow } = T.layoutWeek(week, tasks, maxLanes);
      const row = el('div', { className: 'cal-week' });

      week.forEach((key, col) => {
        const date = T.parseDateKey(key);
        const count = segments.filter((s) => s.startCol <= col && col <= s.endCol).length + overflow[col];
        const classes = ['cal-day'];
        if (date.getMonth() !== ui.calMonth) classes.push('is-other');
        if (key === today) classes.push('is-today');
        if (key === ui.calDay) classes.push('is-selected');
        if (date.getDay() === 0) classes.push('sun');
        if (date.getDay() === 6) classes.push('sat');
        const label = `${T.formatShortDate(key)}${key === today ? ' 오늘' : ''}, 할 일 ${count}개`;
        row.append(el('button', {
          type: 'button',
          className: classes.join(' '),
          style: `grid-column:${col + 1}`,
          dataset: { day: key },
          'aria-label': label,
          'aria-pressed': String(key === ui.calDay),
        },
        el('span', { className: 'cal-num' }, date.getDate() === 1 ? `${date.getMonth() + 1}.${date.getDate()}` : String(date.getDate())),
        overflow[col] ? el('span', { className: 'cal-more' }, `+${overflow[col]}`) : null));
      });

      for (const seg of segments) {
        const t = seg.task;
        const span = T.taskSpan(t);
        const classes = ['cal-bar', `cat-${t.category}`];
        if (t.completed) classes.push('is-done');
        if (!t.completed && t.due && t.due < today) classes.push('is-overdue');
        if (seg.continuesBefore) classes.push('cont-before');
        if (seg.continuesAfter) classes.push('cont-after');
        if (!seg.multiDay) classes.push('is-single');
        const showText = !seg.continuesBefore || seg.startCol === 0;
        row.append(el('button', {
          type: 'button',
          className: classes.join(' '),
          style: `grid-column:${seg.startCol + 1} / ${seg.endCol + 2};grid-row:${seg.lane + 2}`,
          dataset: { id: t.id },
          title: `${t.text} · ${T.formatPeriod(span.start, span.end)}`,
          'aria-label': `${t.text}, ${T.CATEGORIES.find((c) => c.id === t.category).label}, ${T.formatPeriod(span.start, span.end)}${t.completed ? ', 완료' : ''}`,
        }, showText ? el('span', { className: 'cal-bar-text' }, t.text) : null));
      }
      return row;
    }));

    renderDayPanel(tasks, today);
  }

  function renderDayPanel(tasks, today) {
    const key = ui.calDay;
    els.dayTitle.textContent = `${T.formatShortDate(key)}${key === today ? ' · 오늘' : ''}`;
    const items = T.tasksOnDay(tasks, key);
    els.dayEmpty.hidden = items.length > 0;
    els.dayList.replaceChildren(...items.map((t) => {
      const span = T.taskSpan(t);
      const due = !t.completed ? T.dueInfo(t.due, today) : null;
      return el('li', { className: `day-item cat-${t.category}${t.completed ? ' is-done' : ''}`, dataset: { id: t.id } },
        el('label', { className: 'check' },
          el('input', { type: 'checkbox', dataset: { role: 'toggle' }, checked: t.completed, 'aria-label': `"${t.text}" 완료` }),
          el('span', { className: 'check-box', 'aria-hidden': 'true' }, icon('check'))),
        el('button', { type: 'button', className: 'day-main', dataset: { role: 'open' }, 'aria-label': `"${t.text}" 자세히 보기` },
          el('span', { className: 'day-text' }, el('i', { className: 'dot' }), t.text),
          el('span', { className: 'day-sub' },
            T.formatPeriod(span.start, span.end),
            due ? el('span', { className: `due due-${due.tone}` }, ` · ${due.label}`) : null,
            t.note ? el('span', { className: 'attach' }, icon('note')) : null,
            t.images.length ? el('span', { className: 'attach' }, icon('image'), String(t.images.length)) : null)));
    }));
  }

  // ---------- 빠른 입력 미리보기 ----------

  function renderParsePreview() {
    const parsed = T.parseQuickAdd(els.taskInput.value);
    const chips = [];
    if (parsed.category) chips.push(['cat', `카테고리 · ${T.CATEGORIES.find((c) => c.id === parsed.category).label}`]);
    if (parsed.start) chips.push(['due', `기간 · ${T.formatPeriod(parsed.start, parsed.due)}`]);
    else if (parsed.due) chips.push(['due', `마감 · ${T.formatShortDate(parsed.due)}`]);
    els.parsePreview.replaceChildren(...chips.map(([kind, label]) => el('span', { className: `parsed parsed-${kind}` }, label)));
    els.catSelect.classList.toggle('is-overridden', Boolean(parsed.category));
    els.startInput.closest('.field').classList.toggle('is-overridden', Boolean(parsed.due));
    els.dueInput.closest('.field').classList.toggle('is-overridden', Boolean(parsed.due));
  }

  // ---------------------------------------------------------------------------
  // 포커스·애니메이션·알림 도우미
  // ---------------------------------------------------------------------------

  function rememberFocus() {
    const active = document.activeElement;
    const li = active && active.closest && active.closest('.task');
    if (!li) return null;
    return { id: li.dataset.id, role: active.dataset.role };
  }

  function restoreFocus(info) {
    if (!info) return;
    const li = nodes.get(info.id)?.el;
    if (!li || !li.isConnected || li.contains(document.activeElement)) return;
    const target = li.querySelector(`[data-role="${info.role}"]`) || li.querySelector('[data-role="toggle"]');
    target?.focus({ preventScroll: true });
  }

  /** 목록에서 그 할 일로 포커스. 성공하면 true */
  function focusTask(id, role = 'toggle') {
    if (!id) return false;
    const li = nodes.get(id)?.el;
    if (!li || !li.isConnected) return false;
    const target = li.querySelector(`[data-role="${role}"]`) || li.querySelector('[data-role="toggle"]');
    if (!target) return false;
    target.focus({ preventScroll: false });
    return true;
  }

  function neighborId(id) {
    const li = nodes.get(id)?.el;
    if (!li || !li.isConnected) return null;
    return (li.nextElementSibling || li.previousElementSibling)?.dataset.id ?? null;
  }

  function animateOut(id, done) {
    const li = nodes.get(id)?.el;
    if (!li || !li.isConnected || REDUCED_MOTION.matches) { done(); return; }
    li.classList.add('is-leaving');
    let finished = false;
    const finish = () => { if (!finished) { finished = true; done(); } };
    li.addEventListener('animationend', finish, { once: true });
    setTimeout(finish, 300);
  }

  function shake(target) {
    target.classList.remove('is-shaking');
    void target.offsetWidth; // 애니메이션을 다시 시작하기 위한 리플로
    target.classList.add('is-shaking');
  }

  function showToast(message, { withUndo = false } = {}) {
    els.toastText.textContent = message;
    els.toastUndo.hidden = !withUndo;
    els.toast.hidden = false;
    requestAnimationFrame(() => els.toast.classList.add('is-visible'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, withUndo ? 6000 : 2800);
  }

  function hideToast() {
    els.toast.classList.remove('is-visible');
    setTimeout(() => { if (!els.toast.classList.contains('is-visible')) els.toast.hidden = true; }, 250);
  }

  function say(message) {
    els.announcer.textContent = '';
    setTimeout(() => { els.announcer.textContent = message; }, 30);
  }

  // ---------------------------------------------------------------------------
  // 테마
  // ---------------------------------------------------------------------------

  function effectiveTheme() {
    const t = state.settings.theme;
    if (t === 'light' || t === 'dark') return t;
    return DARK_QUERY.matches ? 'dark' : 'light';
  }

  function applyTheme() {
    const t = state.settings.theme;
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
  }

  function toggleTheme() {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.add('theme-transition');
    setTimeout(() => document.documentElement.classList.remove('theme-transition'), 400);
    state = { ...state, settings: { ...state.settings, theme: next } };
    applyTheme();
    persist();
    render();
  }

  // ---------------------------------------------------------------------------
  // 드래그로 순서 바꾸기 (마우스·터치 모두 지원하는 포인터 이벤트)
  // 항목을 DOM에서 옮기면 포인터 캡처가 풀리므로, 드래그 중에는 window에서 이벤트를 받습니다.
  // ---------------------------------------------------------------------------

  let drag = null;

  function onHandlePointerDown(e) {
    const handle = e.target.closest('[data-role="handle"]');
    if (!handle || e.button !== 0 || state.settings.sort !== 'manual') return;
    const li = handle.closest('.task');
    e.preventDefault();
    drag = { li, pointerId: e.pointerId, startIds: idsOf(els.activeList) };
    li.classList.add('is-dragging');
    document.body.classList.add('is-sorting');
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd);
    window.addEventListener('pointercancel', onDragEnd);
  }

  function onDragMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    // offsetTop은 transform(애니메이션 중인 이동)의 영향을 받지 않아 위치 판단이 흔들리지 않습니다.
    const y = e.clientY - els.activeList.getBoundingClientRect().top;
    const siblings = [...els.activeList.children].filter((n) => n !== drag.li);
    let before = null;
    for (const sib of siblings) {
      if (y < sib.offsetTop + sib.offsetHeight / 2) { before = sib; break; }
    }
    const alreadyThere = before ? drag.li.nextElementSibling === before : els.activeList.lastElementChild === drag.li;
    if (!alreadyThere) flip(siblings, () => els.activeList.insertBefore(drag.li, before));

    // 화면 끝에 가까우면 자동으로 스크롤
    const edge = 70;
    if (e.clientY < edge) window.scrollBy(0, -12);
    else if (e.clientY > window.innerHeight - edge) window.scrollBy(0, 12);
  }

  function onDragEnd(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { li, startIds } = drag;
    drag = null;
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
    window.removeEventListener('pointercancel', onDragEnd);
    li.classList.remove('is-dragging');
    document.body.classList.remove('is-sorting');
    const ids = idsOf(els.activeList);
    if (ids.join() !== startIds.join()) {
      updateTasks((tasks) => T.applyVisibleOrder(tasks, ids), { announce: '순서를 바꿨어요' });
    }
  }

  function idsOf(listEl) {
    return [...listEl.children].map((n) => n.dataset.id);
  }

  /** FLIP 애니메이션: 자리를 옮긴 형제 항목이 부드럽게 미끄러지게 합니다. */
  function flip(items, mutate) {
    if (REDUCED_MOTION.matches) { mutate(); return; }
    const before = new Map(items.map((n) => [n, n.offsetTop]));
    mutate();
    for (const n of items) {
      const dy = before.get(n) - n.offsetTop;
      if (!dy) continue;
      n.style.transition = 'none';
      n.style.transform = `translateY(${dy}px)`;
      requestAnimationFrame(() => {
        n.style.transition = '';
        n.style.transform = '';
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 가져오기 / 내보내기
  // ---------------------------------------------------------------------------

  async function exportData() {
    const ids = state.tasks.flatMap((t) => t.images);
    let images = {};
    if (ids.length && ui.imagesOk) {
      showToast('사진을 담는 중이에요…');
      images = await IMG.exportMany(ids).catch(() => ({}));
    }
    const data = S.buildExport(state, images);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: S.exportFileName() });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const photoCount = Object.keys(images).length;
    showToast(`${data.taskCount}개 할 일${photoCount ? `과 사진 ${photoCount}장` : ''}을 내보냈어요`);
  }

  async function onImportFile() {
    const file = els.importFile.files[0];
    els.importFile.value = '';
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) {
      showToast('파일이 너무 커요 (최대 200MB)');
      return;
    }
    try {
      const parsed = S.parseImport(await file.text());
      if (!parsed.state.tasks.length) {
        showToast('가져올 수 있는 할 일이 없어요');
        return;
      }
      pendingImport = parsed;
      const photos = Object.keys(parsed.images).length;
      const skipped = parsed.skipped ? ` (읽을 수 없는 항목 ${parsed.skipped}개는 건너뛰어요)` : '';
      els.importSummary.textContent = `"${file.name}"에서 할 일 ${parsed.state.tasks.length}개${photos ? `, 사진 ${photos}장` : ''}을 찾았어요${skipped}. 지금 목록에는 ${state.tasks.length}개가 있어요.`;
      els.importDialog.returnValue = '';
      els.importDialog.showModal();
    } catch (err) {
      showToast(`가져오지 못했어요: ${err.message}`);
    }
  }

  async function onImportClose() {
    const choice = els.importDialog.returnValue;
    const parsed = pendingImport;
    pendingImport = null;
    if (!parsed || (choice !== 'merge' && choice !== 'replace')) return;
    const incoming = parsed.state;
    if (Object.keys(parsed.images).length && ui.imagesOk) {
      try {
        await IMG.importMany(parsed.images);
      } catch {
        showToast('사진 일부를 저장하지 못했어요 (저장 공간 부족)');
      }
    }
    store.backup(state);
    if (choice === 'merge') {
      commit(S.mergeStates(state, incoming), { undoLabel: `${incoming.tasks.length}개를 합쳤어요` });
    } else {
      commit({ ...state, tasks: incoming.tasks, history: incoming.history }, { undoLabel: `${incoming.tasks.length}개로 바꿨어요` });
    }
  }

  /** 어떤 할 일(백업 포함)에서도 쓰지 않는 사진을 정리합니다. 시작할 때 한 번 실행합니다. */
  async function cleanupImages() {
    const used = state.tasks.flatMap((t) => t.images);
    try {
      const backup = JSON.parse(localStorage.getItem(S.BACKUP_KEY) || '{}');
      if (Array.isArray(backup.tasks)) for (const t of backup.tasks) if (Array.isArray(t.images)) used.push(...t.images);
    } catch { /* 백업이 없거나 읽을 수 없으면 무시 */ }
    try {
      await IMG.cleanup(used);
    } catch { /* 정리는 다음에 다시 시도 */ }
  }

  // ---------------------------------------------------------------------------
  // 작은 DOM 도우미
  // ---------------------------------------------------------------------------

  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null) continue;
      if (key === 'dataset') Object.assign(node.dataset, value);
      else if (key === 'style') node.setAttribute('style', value);
      else if (key.startsWith('aria-') || key === 'role') node.setAttribute(key, value);
      else node[key] = value;
    }
    for (const child of children) {
      if (child === null || child === undefined || child === false) continue;
      node.append(child); // 문자열은 텍스트로 들어가므로 HTML로 해석되지 않습니다(XSS 방지).
    }
    return node;
  }

  /**
   * 아이콘. <use href="#i-…"> 대신 symbol 내용을 복사해 넣습니다. 목록 항목마다 아이콘이
   * 여러 개라 <use>를 쓰면 항목을 대량으로 지울 때 크롬에서 눈에 띄게 느려지기 때문입니다.
   */
  const iconCache = new Map();
  function icon(name) {
    let template = iconCache.get(name);
    if (!template) {
      const symbol = document.getElementById(`i-${name}`);
      template = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      template.setAttribute('viewBox', symbol.getAttribute('viewBox'));
      template.setAttribute('aria-hidden', 'true');
      template.setAttribute('class', 'icon');
      for (const child of symbol.children) template.append(child.cloneNode(true));
      iconCache.set(name, template);
    }
    return template.cloneNode(true);
  }

  function isTyping(target) {
    return target instanceof HTMLElement
      && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      && target.type !== 'checkbox';
  }

  // ---------------------------------------------------------------------------
  // 이벤트 연결
  // ---------------------------------------------------------------------------

  function bindEvents() {
    els.addForm.addEventListener('submit', (e) => {
      e.preventDefault();
      addTask();
    });
    els.taskInput.addEventListener('input', renderParsePreview);
    els.taskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.taskInput.value) {
        els.taskInput.value = '';
        renderParsePreview();
      }
    });

    els.searchInput.addEventListener('input', () => {
      ui.query = els.searchInput.value;
      render();
    });
    els.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        els.searchInput.value = '';
        ui.query = '';
        render();
        els.searchInput.blur();
      }
    });
    els.sortSelect.addEventListener('change', () => updateSettings({ sort: els.sortSelect.value }));
    for (const btn of viewButtons) btn.addEventListener('click', () => setView(btn.dataset.view));

    els.filterChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (chip) setCategoryFilter(chip.dataset.category);
    });
    els.catProgress.addEventListener('click', (e) => {
      const card = e.target.closest('.cat-card');
      if (!card) return;
      const id = card.dataset.category;
      setCategoryFilter(state.settings.category === id ? 'all' : id);
    });

    els.dashToggle.addEventListener('click', () => updateSettings({ dashboardOpen: !state.settings.dashboardOpen }));
    els.quoteBtn.addEventListener('click', () => {
      ui.quoteOffset += 1;
      render();
    });
    els.themeBtn.addEventListener('click', toggleTheme);
    els.helpBtn.addEventListener('click', () => els.helpDialog.showModal());

    els.doneSection.addEventListener('toggle', () => {
      if (els.doneSection.open !== state.settings.showDone) updateSettings({ showDone: els.doneSection.open });
    });

    els.clearDoneBtn.addEventListener('click', clearDone);
    els.exportBtn.addEventListener('click', exportData);
    els.importBtn.addEventListener('click', () => els.importFile.click());
    els.importFile.addEventListener('change', onImportFile);
    els.importDialog.addEventListener('close', onImportClose);
    els.toastUndo.addEventListener('click', () => {
      runUndo();
      els.toastUndo.hidden = true;
    });

    for (const list of [els.activeList, els.doneList]) bindList(list);
    els.activeList.addEventListener('pointerdown', onHandlePointerDown);

    bindCalendar();
    bindDetail();

    document.addEventListener('keydown', onGlobalKey);

    // 다른 탭에서 바꾼 내용 반영
    window.addEventListener('storage', (e) => {
      if (e.key !== S.KEY) return;
      state = store.load().state;
      applyTheme();
      render();
    });

    DARK_QUERY.addEventListener('change', render);
    NARROW.addEventListener('change', render);

    // "3분 전" 같은 표시와 날짜 변경을 반영하기 위해 1분마다 다시 그립니다.
    setInterval(() => { if (!drag) render(); }, 60 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !drag) render();
    });
  }

  function bindList(list) {
    list.addEventListener('change', (e) => {
      if (e.target.dataset.role !== 'toggle') return;
      toggleTask(e.target.closest('.task').dataset.id);
    });

    list.addEventListener('click', (e) => {
      const target = e.target.closest('[data-role]');
      if (!target) return;
      const id = target.closest('.task').dataset.id;
      const role = target.dataset.role;
      if (role === 'delete') deleteTask(id);
      else if (role === 'edit' || role === 'open') openDetail(id);
    });

    list.addEventListener('keydown', (e) => {
      const li = e.target.closest('.task');
      if (!li) return;
      const id = li.dataset.id;
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && list === els.activeList) {
        e.preventDefault();
        moveTask(id, e.key === 'ArrowUp' ? -1 : 1);
      } else if (e.key === 'Delete') {
        e.preventDefault();
        deleteTask(id);
      } else if (e.key === 'F2' || (e.key === 'Enter' && e.target.dataset.role === 'toggle')) {
        e.preventDefault();
        openDetail(id);
      }
    });
  }

  function bindCalendar() {
    els.calPrev.addEventListener('click', () => shiftMonth(-1));
    els.calNext.addEventListener('click', () => shiftMonth(1));
    els.calToday.addEventListener('click', () => {
      goToDay(todayKey());
      render();
    });

    els.calGrid.addEventListener('click', (e) => {
      const bar = e.target.closest('.cal-bar');
      if (bar) {
        openDetail(bar.dataset.id);
        return;
      }
      const day = e.target.closest('.cal-day');
      if (day) {
        ui.calDay = day.dataset.day;
        render();
      }
    });

    els.dayList.addEventListener('change', (e) => {
      if (e.target.dataset.role === 'toggle') toggleTask(e.target.closest('.day-item').dataset.id);
    });
    els.dayList.addEventListener('click', (e) => {
      const open = e.target.closest('[data-role="open"]');
      if (open) openDetail(open.closest('.day-item').dataset.id);
    });

    els.addOnDay.addEventListener('click', () => {
      els.dueInput.value = ui.calDay;
      els.startInput.value = '';
      els.taskInput.focus();
      els.taskInput.scrollIntoView({ block: 'center', behavior: REDUCED_MOTION.matches ? 'auto' : 'smooth' });
      showToast(`${T.formatShortDate(ui.calDay)} 마감으로 추가해요`);
    });
  }

  function bindDetail() {
    els.detailForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveDetail();
    });
    // 닫기(X)와 Esc는 저장하고 닫고, '취소'만 바꾼 내용을 버립니다.
    els.detailClose.addEventListener('click', saveDetail);
    els.detailDialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      if (els.viewerDialog.open) return;
      saveDetail();
    });
    els.detailCancel.addEventListener('click', closeDetail);
    els.detailDelete.addEventListener('click', () => {
      const id = ui.detail?.id;
      closeDetail();
      if (id) deleteTask(id);
    });
    els.detailNote.addEventListener('input', () => {
      updateNoteCounter();
      autosizeNote();
    });
    els.detailDone.addEventListener('change', () => els.detailDialog.classList.toggle('is-done', els.detailDone.checked));
    els.detailCategory.addEventListener('change', () => { els.detailDialog.dataset.category = els.detailCategory.value; });
    els.detailText.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveDetail();
      }
    });

    els.addImageBtn.addEventListener('click', () => els.imageFile.click());
    els.imageFile.addEventListener('change', () => {
      addImages(els.imageFile.files);
      els.imageFile.value = '';
    });
    els.gallery.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-role]');
      const thumb = btn?.closest('.thumb');
      if (!thumb || !ui.detail) return;
      const id = thumb.dataset.image;
      if (btn.dataset.role === 'view') openViewer(id);
      else if (btn.dataset.role === 'remove') {
        ui.detail.images = ui.detail.images.filter((x) => x !== id);
        renderGallery();
        els.addImageBtn.focus();
      }
    });

    // 끌어다 놓기와 붙여넣기(Ctrl+V)로도 사진을 붙일 수 있습니다.
    const form = els.detailForm;
    form.addEventListener('dragover', (e) => {
      if (![...e.dataTransfer.types].includes('Files')) return;
      e.preventDefault();
      form.classList.add('is-dropping');
    });
    form.addEventListener('dragleave', (e) => {
      if (!form.contains(e.relatedTarget)) form.classList.remove('is-dropping');
    });
    form.addEventListener('drop', (e) => {
      if (!e.dataTransfer.files.length) return;
      e.preventDefault();
      form.classList.remove('is-dropping');
      addImages(e.dataTransfer.files);
    });
    els.detailDialog.addEventListener('paste', (e) => {
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
      if (!files.length) return;
      e.preventDefault();
      addImages(files);
    });

    els.viewerDialog.addEventListener('click', (e) => {
      if (e.target === els.viewerDialog || e.target === els.viewerImg) els.viewerDialog.close();
    });
  }

  function onGlobalKey(e) {
    if (document.querySelector('dialog[open]')) return;
    const typing = isTyping(e.target);

    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const actions = {
        KeyN: () => els.taskInput.focus(),
        KeyT: toggleTheme,
        KeyL: () => setView('list'),
        KeyC: () => setView('calendar'),
      };
      if (actions[e.code]) {
        e.preventDefault();
        actions[e.code]();
        return;
      }
      const digit = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
      if (digit >= 0) {
        e.preventDefault();
        setCategoryFilter(digit === 0 ? 'all' : T.CATEGORIES[digit - 1].id);
        return;
      }
    }

    if (typing) return;

    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && undo) {
      e.preventDefault();
      runUndo();
    } else if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      els.searchInput.focus();
      els.searchInput.select();
    } else if (e.key === '?') {
      e.preventDefault();
      els.helpDialog.showModal();
    } else if (state.settings.view === 'calendar' && (e.key === 'PageUp' || e.key === 'PageDown')) {
      e.preventDefault();
      shiftMonth(e.key === 'PageUp' ? -1 : 1);
    }
  }

  // ---------------------------------------------------------------------------
  // 시작
  // ---------------------------------------------------------------------------

  async function init() {
    for (const c of T.CATEGORIES) {
      els.catSelect.append(el('option', { value: c.id }, c.label));
      els.detailCategory.append(el('option', { value: c.id }, c.label));
    }
    for (const s of T.SORTS) els.sortSelect.append(el('option', { value: s.id }, s.label));
    if (state.settings.category !== 'all') els.catSelect.value = state.settings.category;

    applyTheme();
    bindEvents();
    persist(); // 저장소를 쓸 수 있는지 확인하고, 정리된 데이터를 바로 저장합니다.
    render();

    ui.imagesOk = await IMG.available();
    if (ui.imagesOk) cleanupImages();
  }

  init();
})();
