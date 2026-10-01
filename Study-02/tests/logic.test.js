// 실행: node --test tests/
// 화면 없이 할 일 계산 로직(tasks.js)과 저장 형식(storage.js)을 검사합니다.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/tasks.js');
const S = require('../js/storage.js');

// 2026-10-01(목) 오전 8시 (한국 시간 기준 오전에는 UTC 날짜가 하루 전이라 날짜 버그가 잘 드러납니다)
const NOW = new Date(2026, 9, 1, 8, 0, 0);

function memoryBackend() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    map,
  };
}

test('날짜 키는 UTC가 아니라 로컬 날짜를 씁니다', () => {
  assert.equal(T.toDateKey(new Date(2026, 9, 1, 0, 30)), '2026-10-01');
  assert.equal(T.daysBetween('2026-09-28', '2026-10-01'), 3);
  assert.equal(T.isValidDateKey('2026-02-30'), false);
  assert.equal(T.isValidDateKey('2026-02-28'), true);
});

test('빠른 입력: 카테고리·마감일 토큰을 떼어 냅니다', () => {
  const r = T.parseQuickAdd('보고서 제출 #업무 @내일', NOW);
  assert.deepEqual(r, { text: '보고서 제출', category: 'work', start: null, due: '2026-10-02' });
  assert.equal(T.parseQuickAdd('자료구조 #과제', NOW).category, 'study');
});

test('빠른 입력: 기간 @시작~마감', () => {
  assert.deepEqual(T.parseQuickAdd('과제 @10/3~10/7', NOW), { text: '과제', category: null, start: '2026-10-03', due: '2026-10-07' });
  assert.deepEqual(T.parseQuickAdd('과제 @오늘~금', NOW), { text: '과제', category: null, start: '2026-10-01', due: '2026-10-02' });
  // 거꾸로 적어도 바로잡습니다.
  assert.equal(T.parseQuickAdd('a @10/7~10/3', NOW).start, '2026-10-03');
  assert.equal(T.parseQuickAdd('a @10/7~이상함', NOW).text, 'a @10/7~이상함');
});

test('빠른 입력: 요일과 월/일', () => {
  assert.equal(T.parseQuickAdd('a @금', NOW).due, '2026-10-02'); // 목요일 → 다음 날 금요일
  assert.equal(T.parseQuickAdd('a @목요일', NOW).due, '2026-10-01'); // 오늘
  assert.equal(T.parseQuickAdd('a @10/5', NOW).due, '2026-10-05');
  assert.equal(T.parseQuickAdd('a @9/1', NOW).due, '2027-09-01'); // 이미 지났으면 내년
  assert.equal(T.parseQuickAdd('a @2/30', NOW).due, null);
});

test('빠른 입력: 문장 속 기호는 건드리지 않습니다', () => {
  const r = T.parseQuickAdd('끝내기! 메일@회사 #해시태그 C#', NOW);
  assert.equal(r.text, '끝내기! 메일@회사 #해시태그 C#');
  assert.equal(r.category, null);
  assert.equal(r.due, null);
});

test('할 일 생성: 공백 정리, 길이 제한, 잘못된 값은 기본값', () => {
  const t = T.createTask({ text: '  공부   하기  ', category: 'nope', due: 'x' }, NOW);
  assert.equal(t.text, '공부 하기');
  assert.equal(t.category, 'work');
  assert.equal(t.due, null);
  assert.deepEqual(t.images, []);
  assert.equal(t.note, '');
  assert.equal(T.createTask({ text: 'a'.repeat(500) }).text.length, T.MAX_TEXT);
  // 시작일이 마감일보다 늦으면 바꿔 넣습니다.
  const p = T.createTask({ text: 'x', start: '2026-10-09', due: '2026-10-03' }, NOW);
  assert.deepEqual([p.start, p.due], ['2026-10-03', '2026-10-09']);
});

test('메모: 줄바꿈은 살리고 지나친 빈 줄과 끝 공백만 정리', () => {
  assert.equal(T.cleanNote('  첫 줄  \r\n둘째 줄\n\n\n\n\n끝  '), '첫 줄\n둘째 줄\n\n\n끝');
  assert.equal(T.cleanNote('a'.repeat(6000)).length, T.MAX_NOTE);
});

test('정렬: 마감일순은 마감일 없는 항목을 뒤로 보냅니다', () => {
  const mk = (text, due, order) => ({ ...T.createTask({ text, due, order }, NOW) });
  const tasks = [mk('없음', null, 0), mk('늦음', '2026-10-09', 1), mk('빠름', '2026-10-02', 2)];
  assert.deepEqual(T.sortTasks(tasks, 'due').map((t) => t.text), ['빠름', '늦음', '없음']);
});

test('정렬: 카테고리순', () => {
  const tasks = [
    T.createTask({ text: '공부', category: 'study', order: 0 }, NOW),
    T.createTask({ text: '업무', category: 'work', order: 1 }, NOW),
    T.createTask({ text: '개인', category: 'personal', order: 2 }, NOW),
  ];
  assert.deepEqual(T.sortTasks(tasks, 'category').map((t) => t.text), ['업무', '개인', '공부']);
});

test('목록: 완료 항목은 따로, 필터와 검색 적용', () => {
  const a = T.createTask({ text: '기획서 검토', category: 'work', order: 0 }, NOW);
  const b = { ...T.createTask({ text: '운동', category: 'personal', order: 1 }, NOW), completed: true, completedAt: NOW.toISOString() };
  const c = T.createTask({ text: '영어 단어', category: 'study', order: 2 }, NOW);
  const all = T.visibleLists([a, b, c]);
  assert.deepEqual(all.active.map((t) => t.text), ['기획서 검토', '영어 단어']);
  assert.deepEqual(all.done.map((t) => t.text), ['운동']);
  assert.deepEqual(T.visibleLists([a, b, c], { category: 'study' }).active.map((t) => t.text), ['영어 단어']);
  assert.deepEqual(T.visibleLists([a, b, c], { query: '검토' }).active.map((t) => t.text), ['기획서 검토']);
  // 카테고리 이름과 메모로도 검색됩니다.
  assert.deepEqual(T.visibleLists([a, b, c], { query: '공부' }).active.map((t) => t.text), ['영어 단어']);
  const withNote = { ...a, note: '회의실 3층 예약' };
  assert.deepEqual(T.visibleLists([withNote, c], { query: '회의실' }).active.map((t) => t.text), ['기획서 검토']);
});

test('드래그 순서: 필터로 숨긴 항목의 위치는 그대로 둡니다', () => {
  const tasks = ['A', 'B', 'C', 'D'].map((text, order) => ({ ...T.createTask({ text, order }, NOW) }));
  // 화면에는 A, C, D만 보이는데 D를 맨 위로 옮김
  const [A, B, C, D] = tasks;
  const next = T.applyVisibleOrder(tasks, [D.id, A.id, C.id]);
  const order = T.sortTasks(next, 'manual').map((t) => t.text);
  assert.deepEqual(order, ['D', 'B', 'A', 'C']); // B는 2번째 자리를 지킵니다
  assert.equal(next.find((t) => t.id === B.id).order, 1);
});

test('완료 기록: 취소하면 줄고 0이면 지워집니다', () => {
  let h = T.recordCompletion({}, '2026-10-01', 1);
  h = T.recordCompletion(h, '2026-10-01', 1);
  assert.equal(h['2026-10-01'], 2);
  h = T.recordCompletion(h, '2026-10-01', -1);
  h = T.recordCompletion(h, '2026-10-01', -1);
  assert.deepEqual(h, {});
});

test('통계: 진행률, 기한 지남, 오늘 추가', () => {
  const tasks = [
    T.createTask({ text: 'a', due: '2026-09-30' }, NOW),
    { ...T.createTask({ text: 'b' }, NOW), completed: true, completedAt: NOW.toISOString() },
    T.createTask({ text: 'c', due: '2026-10-01' }, new Date(2026, 8, 20)),
  ];
  const s = T.computeStats(tasks, { '2026-10-01': 1 }, '2026-10-01');
  assert.equal(s.percent, 33);
  assert.equal(s.overdue, 1);
  assert.equal(s.dueToday, 1);
  assert.equal(s.addedToday, 2);
  assert.equal(s.doneToday, 1);
  assert.equal(s.streak, undefined);
  assert.equal(s.week.length, 7);
  assert.equal(s.week[6].isToday, true);
});

test('마감일 문구', () => {
  assert.deepEqual(T.dueInfo('2026-09-29', '2026-10-01'), { label: '2일 지남', tone: 'overdue' });
  assert.equal(T.dueInfo('2026-10-01', '2026-10-01').label, '오늘까지');
  assert.equal(T.dueInfo('2026-10-02', '2026-10-01').label, '내일까지');
  assert.equal(T.dueInfo('2026-10-03', '2026-10-01').label, '토요일까지');
  assert.equal(T.dueInfo('2026-11-20', '2026-10-01').label, '11월 20일까지');
  assert.equal(T.dueInfo('2027-01-20', '2026-10-01').label, '2027. 1. 20.까지');
});

test('상대 시간 문구', () => {
  assert.equal(T.relativeTime(new Date(2026, 9, 1, 7, 59, 40).toISOString(), NOW), '방금 전');
  assert.equal(T.relativeTime(new Date(2026, 9, 1, 7, 15).toISOString(), NOW), '45분 전');
  assert.equal(T.relativeTime(new Date(2026, 9, 1, 5, 0).toISOString(), NOW), '3시간 전');
  assert.equal(T.relativeTime(new Date(2026, 8, 30, 23, 0).toISOString(), NOW), '어제');
  assert.equal(T.relativeTime(new Date(2026, 8, 12).toISOString(), NOW), '9월 12일');
});

test('저장소: 저장 후 다시 불러오면 같은 상태', () => {
  const backend = memoryBackend();
  const store = S.createStore(backend);
  assert.equal(store.available, true);
  const state = S.emptyState();
  state.tasks.push(T.createTask({ text: '저장 테스트', category: 'study', start: '2026-10-01', due: '2026-10-03', note: '메모\n둘째 줄', images: ['img-1'] }, NOW));
  state.settings.theme = 'dark';
  assert.equal(store.save(state), true);
  const loaded = S.createStore(backend).load(NOW).state;
  assert.deepEqual(loaded.tasks, state.tasks);
  assert.equal(loaded.settings.theme, 'dark');
});

test('저장소: 쓸 수 없는 환경에서도 앱이 멈추지 않습니다', () => {
  const fail = () => { throw new Error('QuotaExceeded'); };
  const store = S.createStore({ getItem: fail, setItem: fail, removeItem: fail });
  assert.equal(store.available, false);
  assert.deepEqual(store.load(NOW).state.tasks, []);
  assert.equal(store.save(S.emptyState()), false);
});

test('저장소: 망가진 데이터는 따로 보관하고 빈 상태로 시작합니다', () => {
  const backend = memoryBackend();
  backend.setItem(S.KEY, '{망가짐');
  const result = S.createStore(backend).load(NOW);
  assert.equal(result.recovered, true);
  assert.deepEqual(result.state.tasks, []);
  assert.ok([...backend.map.keys()].some((k) => k.includes('corrupt')));
});

test('가져오기: 강의 버전 앱이 내보낸 JSON도 읽습니다', () => {
  const legacy = JSON.stringify({
    tasks: [
      { id: '1757654783527xnr7uhkm3', text: '주말 가족 모임 장소 예약', category: 'personal', completed: false, createdAt: '2025-09-12T05:26:23.527Z' },
      { id: '1757654759497ngaozpfbr', text: '프로젝트 기획서 검토', category: 'work', completed: true, createdAt: '2025-09-12T05:25:59.497Z' },
    ],
    settings: { currentFilter: 'all', currentSort: 'date-desc', isDarkMode: true },
    metadata: { version: '1.0.0', exportDate: '2025-09-15T05:53:55.255Z', taskCount: 2 },
  });
  const { state, skipped } = S.parseImport(legacy, NOW);
  assert.equal(skipped, 0);
  assert.equal(state.tasks.length, 2);
  assert.equal(state.tasks[0].note, '');
  assert.deepEqual(state.tasks[0].images, []);
  assert.equal(state.tasks[1].completedAt, '2025-09-12T05:25:59.497Z');
  assert.equal(state.settings.theme, 'dark');
});

test('가져오기: 잘못된 항목은 건너뛰고, 형식이 틀리면 알려 줍니다', () => {
  const { state, skipped } = S.parseImport(JSON.stringify([{ text: '정상' }, { text: '   ' }, 42, null]), NOW);
  assert.equal(state.tasks.length, 1);
  assert.equal(skipped, 3);
  assert.throws(() => S.parseImport('not json', NOW), /JSON/);
  assert.throws(() => S.parseImport('{"foo": 1}', NOW), /tasks/);
});

test('가져오기: 스크립트가 섞인 텍스트도 글자 그대로 보관됩니다', () => {
  const { state } = S.parseImport(JSON.stringify([{ text: '<img src=x onerror=alert(1)>' }]), NOW);
  assert.equal(state.tasks[0].text, '<img src=x onerror=alert(1)>');
});

test('합치기: 같은 id는 덮어쓰고 새 항목은 위에 붙입니다', () => {
  const a = T.createTask({ text: '기존', order: 0 }, NOW);
  const current = { tasks: [a], history: { '2026-09-30': 1 }, settings: S.emptyState().settings };
  const incoming = {
    tasks: [{ ...a, text: '기존(수정됨)' }, T.createTask({ text: '새 항목' }, NOW)],
    history: { '2026-09-30': 3, '2026-09-29': 1 },
  };
  const merged = S.mergeStates(current, incoming);
  const order = T.sortTasks(merged.tasks, 'manual').map((t) => t.text);
  assert.deepEqual(order, ['새 항목', '기존(수정됨)']);
  assert.deepEqual(merged.history, { '2026-09-30': 3, '2026-09-29': 1 });
});

test('가져오기: id가 겹치는 파일은 새 id를 줍니다', () => {
  const { state } = S.parseImport(JSON.stringify([{ id: 'x', text: '하나' }, { id: 'x', text: '둘' }]), NOW);
  assert.notEqual(state.tasks[0].id, state.tasks[1].id);
});

// ---------------------------------------------------------------------------
// 달력
// ---------------------------------------------------------------------------

test('달력: 2026년 10월은 9월 27일(일)부터 10월 31일(토)까지 5주', () => {
  const weeks = T.monthWeeks(2026, 9);
  assert.equal(weeks.length, 5);
  assert.equal(weeks[0][0], '2026-09-27');
  assert.equal(weeks[0][4], '2026-10-01');
  assert.equal(weeks[4][6], '2026-10-31');
});

test('달력: 기간은 시작일(없으면 등록일)부터 마감일(없으면 그날)까지', () => {
  const created = new Date(2026, 9, 1, 14);
  assert.deepEqual(T.taskSpan(T.createTask({ text: 'a', due: '2026-10-05' }, created)), { start: '2026-10-01', end: '2026-10-05' });
  assert.deepEqual(T.taskSpan(T.createTask({ text: 'b' }, created)), { start: '2026-10-01', end: '2026-10-01' });
  assert.deepEqual(T.taskSpan(T.createTask({ text: 'c', start: '2026-10-03' }, created)), { start: '2026-10-03', end: '2026-10-03' });
  // 지난 마감일을 나중에 등록하면 마감일 하루로
  assert.deepEqual(T.taskSpan(T.createTask({ text: 'd', due: '2026-09-28' }, created)), { start: '2026-09-28', end: '2026-09-28' });
});

test('달력: 주를 넘는 기간은 주마다 잘라서 이어진다고 표시합니다', () => {
  const task = T.createTask({ text: '과제', start: '2026-10-01', due: '2026-10-06' }, NOW);
  const [w1, w2] = T.monthWeeks(2026, 9);
  const a = T.layoutWeek(w1, [task]).segments[0];
  const b = T.layoutWeek(w2, [task]).segments[0];
  assert.deepEqual([a.startCol, a.endCol, a.continuesBefore, a.continuesAfter], [4, 6, false, true]);
  assert.deepEqual([b.startCol, b.endCol, b.continuesBefore, b.continuesAfter], [0, 2, true, false]);
});

test('달력: 겹치는 일은 다른 줄, 안 겹치면 같은 줄, 넘치면 +N', () => {
  const week = T.monthWeeks(2026, 9)[1]; // 10/4(일) ~ 10/10(토)
  const mk = (text, start, due, order) => ({ ...T.createTask({ text, start, due }, NOW), order });
  const long = mk('긴 과제', '2026-10-04', '2026-10-10', 0);
  const early = mk('월~화', '2026-10-05', '2026-10-06', 1);
  const late = mk('목~금', '2026-10-08', '2026-10-09', 2);
  const one = mk('수요일 하루', '2026-10-07', '2026-10-07', 3);
  const extra1 = mk('월 하루', '2026-10-05', '2026-10-05', 4);
  const extra2 = mk('월 하루 2', '2026-10-05', '2026-10-05', 5);
  const { segments, overflow } = T.layoutWeek(week, [one, late, early, long, extra1, extra2], 3);
  const lane = (t) => segments.find((s) => s.task === t)?.lane;
  assert.equal(lane(long), 0); // 여러 날짜 일이 먼저 자리를 잡습니다
  assert.equal(lane(early), 1);
  assert.equal(lane(late), 1); // 월~화와 겹치지 않으니 같은 줄
  assert.equal(lane(one), 1); // 수요일은 비어 있음
  assert.equal(lane(extra1), 2);
  assert.equal(lane(extra2), undefined); // 4번째 줄이라 숨김
  assert.equal(overflow[1], 1); // 월요일에 +1
  assert.equal(overflow[2], 0);
});

test('달력: 그날에 걸친 일 목록', () => {
  const a = T.createTask({ text: '기간', start: '2026-10-01', due: '2026-10-05' }, NOW);
  const b = T.createTask({ text: '그날', due: '2026-10-03' }, NOW);
  const c = T.createTask({ text: '다른 날', start: '2026-10-07', due: '2026-10-08' }, NOW);
  assert.deepEqual(T.tasksOnDay([a, b, c], '2026-10-03').map((t) => t.text), ['그날', '기간']);
  assert.deepEqual(T.tasksOnDay([a, b, c], '2026-10-06').map((t) => t.text), []);
});

test('기간 문구', () => {
  assert.equal(T.formatPeriod('2026-10-03', '2026-10-07'), '10월 3일(토) ~ 10월 7일(수)');
  assert.equal(T.formatPeriod('2026-10-03', '2026-10-03'), '10월 3일(토)');
  assert.equal(T.startInfo('2026-10-02', '2026-10-01'), '내일 시작');
  assert.equal(T.startInfo('2026-10-01', '2026-10-01'), null);
});

test('가져오기: 사진은 형식이 맞는 data URL만 받습니다', () => {
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  const { images } = S.parseImport(JSON.stringify({
    tasks: [{ text: '사진 있음', images: ['ok', 'bad id!'] }],
    images: { ok: png, js: 'data:text/html;base64,PHNjcmlwdD4=', 'bad id!': png },
  }), NOW);
  assert.deepEqual(images, { ok: png });
  const { state } = S.parseImport(JSON.stringify({ tasks: [{ text: 'x', images: ['ok', 'bad id!'] }] }), NOW);
  assert.deepEqual(state.tasks[0].images, ['ok']);
});

test('내보내기: 사진을 함께 담습니다', () => {
  const out = S.buildExport(S.emptyState(), { a: 'data:image/png;base64,AAAA' }, NOW);
  assert.equal(out.images.a, 'data:image/png;base64,AAAA');
  assert.equal(out.app, 'personal-todo');
});

test('설정: 보기 방식 저장, 없어진 정렬(우선순위)은 기본값으로', () => {
  const { state } = S.normalizeState({ tasks: [], settings: { view: 'calendar', sort: 'priority' } }, NOW);
  assert.equal(state.settings.view, 'calendar');
  assert.equal(state.settings.sort, 'manual');
});
