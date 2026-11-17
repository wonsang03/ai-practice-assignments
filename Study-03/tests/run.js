// 실행: node tests/run.js  (설치 필요 없음)
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { QUESTIONS, CATEGORIES, DIFFICULTIES } = require("../js/questions.js");
const Core = require("../js/quiz-core.js");
const Teacher = require("../tools/teacher.js");

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("FAIL  " + name + "\n      " + e.message); process.exitCode = 1; }
}

// 재현 가능한 난수
function seeded(seed) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}

console.log("문제 데이터");
test("id가 모두 다르다", () => {
  const ids = QUESTIONS.map(q => q.id);
  assert.equal(new Set(ids).size, ids.length);
});
test("모든 문제가 4지선다이고 정답 번호가 범위 안이다", () => {
  for (const q of QUESTIONS) {
    assert.equal(q.choices.length, 4, q.id);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4, q.id);
  }
});
test("보기가 서로 겹치지 않는다", () => {
  for (const q of QUESTIONS) assert.equal(new Set(q.choices).size, 4, q.id);
});
test("문제·해설이 비어 있지 않다", () => {
  for (const q of QUESTIONS) {
    assert.ok(q.question.trim(), q.id);
    assert.ok(q.explanation.trim(), q.id);
  }
});
test("과목이 정의되어 있고 과목마다 2문제 이상이다", () => {
  for (const key of Object.keys(CATEGORIES)) {
    assert.ok(QUESTIONS.filter(q => q.category === key).length >= 2, key);
  }
  for (const q of QUESTIONS) assert.ok(CATEGORIES[q.category], q.id);
});

test("정답 위치가 과목마다 한쪽에 몰리지 않는다 (가이드라인 7)", () => {
  for (const key of Object.keys(CATEGORIES)) {
    const qs = QUESTIONS.filter(q => q.category === key);
    const counts = [0, 0, 0, 0];
    qs.forEach(q => counts[q.answer]++);
    assert.ok(Math.max(...counts) <= Math.ceil(qs.length * 0.4), `${key}: ${counts}`);
  }
});
test("id 접두어가 과목과 맞다", () => {
  const prefix = { design: "d", develop: "v", database: "b", language: "p", system: "s" };
  for (const q of QUESTIONS) assert.ok(q.id.startsWith(prefix[q.category]), q.id);
});
test("모든 문제에 난이도(1~3)가 있다", () => {
  for (const q of QUESTIONS) assert.ok(DIFFICULTIES[q.difficulty], `${q.id}: ${q.difficulty}`);
});
test("문제 문장·코드가 같은 중복 문제가 없다 (/quiz-check)", () => {
  assert.deepEqual(Core.findDuplicates(QUESTIONS), []);
});

console.log("퀴즈 로직");
test("pickQuestions: 과목당 지정한 개수만 뽑고 중복이 없다", () => {
  const keys = Object.keys(CATEGORIES);
  const picked = Core.pickQuestions(QUESTIONS, keys, 2, seeded(1));
  assert.equal(picked.length, keys.length * 2);
  assert.equal(new Set(picked.map(q => q.id)).size, picked.length);
  for (const k of keys) assert.equal(picked.filter(q => q.category === k).length, 2);
});
test("pickCategory: 그 과목 문제만 전부, 중복 없이", () => {
  const key = Object.keys(CATEGORIES)[0];
  const picked = Core.pickCategory(QUESTIONS, key, seeded(2));
  assert.equal(picked.length, QUESTIONS.filter(q => q.category === key).length);
  assert.ok(picked.every(q => q.category === key));
  assert.equal(new Set(picked.map(q => q.id)).size, picked.length);
});
test("shuffleChoices: 이미 섞은 문제를 다시 섞어도 정답이 같다", () => {
  const once = Core.shuffleChoices(QUESTIONS[0], seeded(5));
  const twice = Core.shuffleChoices(once, seeded(9));
  assert.equal(twice.choices[twice.answer], QUESTIONS[0].choices[QUESTIONS[0].answer]);
});
test("shuffleChoices: 섞은 뒤에도 정답 보기가 같다 (여러 시드)", () => {
  for (let s = 1; s <= 50; s++) {
    for (const q of QUESTIONS) {
      const m = Core.shuffleChoices(q, seeded(s));
      assert.equal(m.choices[m.answer], q.choices[q.answer], q.id);
      assert.deepEqual([...m.choices].sort(), [...q.choices].sort(), q.id);
    }
  }
});
test("shuffleChoices: 원본 문제를 바꾸지 않는다", () => {
  const q = QUESTIONS[0];
  const before = JSON.stringify(q);
  Core.shuffleChoices(q, seeded(3));
  assert.equal(JSON.stringify(q), before);
});
test("addRecord: 점수 높은 순, 동점이면 시간 짧은 순", () => {
  let r = [];
  r = Core.addRecord(r, { name: "a", score: 50, seconds: 40 });
  r = Core.addRecord(r, { name: "b", score: 80, seconds: 90 });
  r = Core.addRecord(r, { name: "c", score: 80, seconds: 30 });
  assert.deepEqual(r.map(x => x.name), ["c", "b", "a"]);
});
test("addRecord: 같은 점수·시간이면 먼저 기록한 사람이 위", () => {
  let r = Core.addRecord([], { name: "first", score: 70, seconds: 50 });
  r = Core.addRecord(r, { name: "second", score: 70, seconds: 50 });
  assert.deepEqual(r.map(x => x.name), ["first", "second"]);
});
test("addRecord: 상위 10개만 남긴다", () => {
  let r = [];
  for (let i = 0; i < 15; i++) r = Core.addRecord(r, { name: "p" + i, score: i * 10 % 110, seconds: i });
  assert.equal(r.length, Core.RANK_LIMIT);
});
test("addRecord: 순위표는 문제 수별로 따로 센다 (count 없는 옛 기록은 10문제)", () => {
  let r = [];
  for (let i = 0; i < 12; i++) r = Core.addRecord(r, { name: "t" + i, score: i, seconds: 1, count: 5 });
  r = Core.addRecord(r, { name: "old", score: 10, seconds: 9 });
  r = Core.addRecord(r, { name: "big", score: 200, seconds: 9, count: 25 });
  assert.equal(Core.recordsFor(r, 5).length, Core.RANK_LIMIT);
  assert.deepEqual(Core.recordsFor(r, 10).map(x => x.name), ["old"]);
  assert.deepEqual(Core.recordsFor(r, 25).map(x => x.name), ["big"]);
});
test("pickQuestions: 문제 수 5·10·15·25·50 모두 과목별로 같은 수를 뽑는다", () => {
  const keys = Object.keys(CATEGORIES);
  for (const n of [5, 10, 15, 25, 50]) {
    const picked = Core.pickQuestions(QUESTIONS, keys, n / keys.length, seeded(n));
    assert.equal(picked.length, n);
    assert.equal(new Set(picked.map(q => q.id)).size, n);
  }
});
test("formatTime", () => {
  assert.equal(Core.formatTime(45), "45초");
  assert.equal(Core.formatTime(125), "2분 5초");
});

console.log("점수·힌트·스피드 (8주차)");
test("questionPoints: 정답 10점, 힌트 쓰면 5점, 오답 0점", () => {
  assert.equal(Core.questionPoints({ correct: true }), 10);
  assert.equal(Core.questionPoints({ correct: true, hinted: true }), 5);
  assert.equal(Core.questionPoints({ correct: false, hinted: true, speed: true, remaining: 15 }), 0);
});
test("questionPoints: 스피드 보너스는 남은 3초마다 1점, 최대 5점", () => {
  assert.equal(Core.questionPoints({ correct: true, speed: true, remaining: 14.9 }), 14);
  assert.equal(Core.questionPoints({ correct: true, speed: true, remaining: 15 }), 15);
  assert.equal(Core.questionPoints({ correct: true, speed: true, remaining: 99 }), 15);
  assert.equal(Core.questionPoints({ correct: true, speed: true, remaining: 2.9 }), 10);
  assert.equal(Core.questionPoints({ correct: true, hinted: true, speed: true, remaining: 6 }), 7);
  assert.equal(Core.questionPoints({ correct: true, speed: false, remaining: 15 }), 10);
});
test("hintRemovals: 정답은 남기고 오답 2개만 지운다 (여러 시드, 모든 문제)", () => {
  for (let s = 1; s <= 20; s++) {
    for (const q of QUESTIONS) {
      const m = Core.shuffleChoices(q, seeded(s));
      const removed = Core.hintRemovals(m, seeded(s + 100));
      assert.equal(removed.length, 2, q.id);
      assert.equal(new Set(removed).size, 2, q.id);
      assert.ok(!removed.includes(m.answer), q.id);
    }
  }
});
test("addRecord/recordsFor: 도전·스피드 순위표가 섞이지 않는다 (mode 없는 옛 기록은 도전)", () => {
  let r = [];
  r = Core.addRecord(r, { name: "old", score: 50, seconds: 9 });
  r = Core.addRecord(r, { name: "fast", score: 140, seconds: 30, mode: "speed", count: 10 });
  r = Core.addRecord(r, { name: "norm", score: 90, seconds: 30, mode: "challenge", count: 10 });
  assert.deepEqual(Core.recordsFor(r, 10).map(x => x.name), ["norm", "old"]);
  assert.deepEqual(Core.recordsFor(r, 10, "speed").map(x => x.name), ["fast"]);
  for (let i = 0; i < 12; i++) r = Core.addRecord(r, { name: "s" + i, score: i, seconds: 1, mode: "speed", count: 10 });
  assert.equal(Core.recordsFor(r, 10, "speed").length, Core.RANK_LIMIT);
  assert.equal(Core.recordsFor(r, 10).length, 2);
});

console.log("통계·점검 (9주차)");
test("summarizeHistory: 누적 정답률·과목/난이도별·자주 틀린 문제", () => {
  const s = Core.summarizeHistory([
    { count: 10, correct: 7, score: 70, seconds: 60, hints: 1, perCat: { design: { total: 2, correct: 1 } }, perDiff: { 1: { total: 4, correct: 4 } }, wrongIds: ["d01", "v01"] },
    { count: 10, correct: 9, score: 95, seconds: 40, hints: 0, timeouts: 2, perCat: { design: { total: 2, correct: 2 } }, perDiff: { 1: { total: 1, correct: 0 } }, wrongIds: ["d01"] }
  ]);
  assert.equal(s.games, 2);
  assert.equal(s.accuracy, 0.8);
  assert.equal(s.bestScore, 95);
  assert.equal(s.seconds, 100);
  assert.equal(s.timeouts, 2);
  assert.deepEqual(s.perCat.design, { total: 4, correct: 3 });
  assert.deepEqual(s.perDiff[1], { total: 5, correct: 4 });
  assert.deepEqual(s.wrongCounts[0], { id: "d01", n: 2 });
  assert.equal(Core.summarizeHistory([]).accuracy, 0);
});
test("findDuplicates: 공백만 다른 같은 문제를 찾는다", () => {
  const qs = [
    { id: "a", question: "질문  하나", code: "x = 1" },
    { id: "b", question: "질문 하나", code: "x  = 1" },
    { id: "c", question: "질문 하나", code: "x = 2" }
  ];
  assert.deepEqual(Core.findDuplicates(qs), [["a", "b"]]);
});
test("findSuperlatives: 최상급 표현이 있는 문제만 고른다", () => {
  const found = Core.findSuperlatives([
    { id: "x", question: "가장 긴 강은?", choices: ["a", "b", "c", "d"], explanation: "" },
    { id: "y", question: "보통 문제", choices: ["a", "b", "c", "d"], explanation: "" }
  ]);
  assert.deepEqual(found.map(f => f.id), ["x"]);
  assert.deepEqual(found[0].words, ["가장"]);
});
test("difficultyStats: 평균·표준편차", () => {
  const s = Core.difficultyStats([{ difficulty: 1 }, { difficulty: 3 }, { difficulty: 2 }, { difficulty: 2 }]);
  assert.equal(s.mean, 2);
  assert.ok(Math.abs(s.std - Math.sqrt(0.5)) < 1e-9);
  assert.deepEqual(s.counts, { 1: 1, 2: 2, 3: 1 });
});

console.log("선생님 모드 (9주차)");
test("assignGrades: 정답률 상대평가, 같은 정답률은 같은 순위·등급, 10문제 미만은 기록 부족", () => {
  const st = [
    { name: "a", accuracy: 0.9, bestScore: 90, questions: 20 },
    { name: "b", accuracy: 0.8, bestScore: 80, questions: 20 },
    { name: "c", accuracy: 0.8, bestScore: 80, questions: 20 },
    { name: "d", accuracy: 0.5, bestScore: 50, questions: 20 },
    { name: "e", accuracy: 0.4, bestScore: 40, questions: 20 },
    { name: "f", accuracy: 1, bestScore: 100, questions: 5 }
  ];
  Teacher.assignGrades(st);
  const by = Object.fromEntries(st.map(s => [s.name, s]));
  assert.equal(by.a.grade, "A");
  assert.equal(by.b.rank, by.c.rank);
  assert.equal(by.b.grade, by.c.grade);
  assert.equal(by.e.grade, "C");
  assert.equal(by.f.grade, "기록 부족");
  assert.equal(by.f.rank, null);
});
test("collect: 앱에서 내보낸 파일만 읽고 같은 기록은 한 번만 센다", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "study03-"));
  const entry = { id: "e1", name: "홍길동", count: 10, correct: 8, score: 80, seconds: 50 };
  const file = { app: "study03-quiz", version: 1, history: [entry, { ...entry, id: "e2" }, { id: "bad", name: "", count: 10, correct: 1 }] };
  fs.writeFileSync(path.join(dir, "a.json"), JSON.stringify(file));
  fs.writeFileSync(path.join(dir, "b.json"), JSON.stringify(file)); // 같은 기록을 또 내보냄
  fs.writeFileSync(path.join(dir, "c.json"), "{broken");
  fs.writeFileSync(path.join(dir, "d.json"), JSON.stringify({ hello: 1 }));
  const c = Teacher.collect(dir);
  fs.rmSync(dir, { recursive: true, force: true });
  assert.deepEqual(c.entries.map(e => e.id), ["e1", "e2"]);
  assert.equal(c.skipped.length, 2);
});
test("leaderboard: 학생별 최고 기록 하나만, 모드·문제 수가 맞는 것만", () => {
  const e = [
    { name: "a", mode: "challenge", count: 10, score: 70, seconds: 50 },
    { name: "a", mode: "challenge", count: 10, score: 90, seconds: 60 },
    { name: "b", count: 10, score: 90, seconds: 40 },
    { name: "c", mode: "speed", count: 10, score: 150, seconds: 40 }
  ];
  assert.deepEqual(Teacher.leaderboard(e).map(x => `${x.name}${x.score}`), ["b90", "a90"]);
  assert.deepEqual(Teacher.leaderboard(e, "speed", 10).map(x => x.name), ["c"]);
});
test("renderCsv: BOM 포함, 엑셀 수식 주입·쉼표를 안전하게 처리", () => {
  const { students } = Teacher.analyze([{ id: "1", name: "=HYPERLINK(1,2)", count: 10, correct: 5, score: 50, seconds: 30 },
    { id: "2", name: "김,철수", count: 10, correct: 9, score: 90, seconds: 30 }]);
  const csv = Teacher.renderCsv({ students });
  assert.ok(csv.startsWith("﻿"));
  assert.ok(csv.includes("'=HYPERLINK(1"));
  assert.ok(csv.includes('"김,철수"'));
});
test("demoData: 가상 데이터라고 표시되고 형식이 올바르다", () => {
  const d = Teacher.demoData();
  assert.equal(d.demo, true);
  assert.ok(d.history.length > 0 && d.history.every(e => e.id.startsWith("demo-") && e.correct <= e.count));
});

console.log(`\n${passed}개 통과` + (process.exitCode ? ", 실패 있음" : ""));
