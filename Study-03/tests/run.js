// 실행: node tests/run.js  (설치 필요 없음)
const assert = require("node:assert/strict");
const { QUESTIONS, CATEGORIES } = require("../js/questions.js");
const Core = require("../js/quiz-core.js");

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

console.log("퀴즈 로직");
test("pickQuestions: 과목당 지정한 개수만 뽑고 중복이 없다", () => {
  const keys = Object.keys(CATEGORIES);
  const picked = Core.pickQuestions(QUESTIONS, keys, 2, seeded(1));
  assert.equal(picked.length, keys.length * 2);
  assert.equal(new Set(picked.map(q => q.id)).size, picked.length);
  for (const k of keys) assert.equal(picked.filter(q => q.category === k).length, 2);
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
test("formatTime", () => {
  assert.equal(Core.formatTime(45), "45초");
  assert.equal(Core.formatTime(125), "2분 5초");
});

console.log(`\n${passed}개 통과` + (process.exitCode ? ", 실패 있음" : ""));
