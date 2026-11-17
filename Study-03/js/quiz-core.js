/* 화면과 무관한 퀴즈 로직 (브라우저, Node 테스트, tools/ 스크립트에서 함께 사용) */
const QuizCore = (() => {
  const RANK_LIMIT = 10;

  // ───── 점수 규칙 ─────
  const POINTS = 10;          // 정답 1문제
  const HINT_COST = 5;        // 힌트(보기 2개 지우기)를 쓰고 맞히면 5점만 준다
  const SPEED_LIMIT = 15;     // 스피드 퀴즈 문제당 제한 시간(초)
  const SPEED_BONUS_STEP = 3; // 스피드 퀴즈: 남은 시간 3초마다 보너스 1점 (최대 5점)

  // Fisher-Yates 셔플. rng를 주입할 수 있어 테스트가 가능하다.
  function shuffle(list, rng = Math.random) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // 과목마다 perCategory문제씩 무작위로 뽑아 섞는다.
  function pickQuestions(all, categoryKeys, perCategory, rng = Math.random) {
    const picked = [];
    for (const key of categoryKeys) {
      const pool = all.filter(q => q.category === key);
      picked.push(...shuffle(pool, rng).slice(0, perCategory));
    }
    return shuffle(picked, rng);
  }

  // 한 과목의 문제를 전부 섞어서 돌려준다(과목 연습용).
  function pickCategory(all, key, rng = Math.random) {
    return shuffle(all.filter(q => q.category === key), rng);
  }

  // 보기 순서를 섞고, 섞인 뒤의 정답 위치를 함께 돌려준다.
  function shuffleChoices(q, rng = Math.random) {
    const order = shuffle(q.choices.map((_, i) => i), rng);
    return {
      ...q,
      choices: order.map(i => q.choices[i]),
      answer: order.indexOf(q.answer)
    };
  }

  // 힌트: 오답 보기 중 2개를 골라 지울 번호를 돌려준다(정답과 오답 1개가 남는다).
  function hintRemovals(q, rng = Math.random) {
    const wrongs = q.choices.map((_, i) => i).filter(i => i !== q.answer);
    return shuffle(wrongs, rng).slice(0, Math.max(0, wrongs.length - 1)).sort((a, b) => a - b);
  }

  // 한 문제의 점수. remaining은 스피드 퀴즈에서 남은 초.
  function questionPoints({ correct, hinted = false, speed = false, remaining = 0 }) {
    if (!correct) return 0;
    const base = hinted ? POINTS - HINT_COST : POINTS;
    const bonus = speed ? Math.floor(Math.max(0, Math.min(SPEED_LIMIT, remaining)) / SPEED_BONUS_STEP) : 0;
    return base + bonus;
  }

  // ───── 순위표 ─────
  // 모드·문제 수가 다르면 점수를 비교할 수 없으므로 순위표를 (모드, 문제 수)별로 나눈다.
  // mode·count가 없는 예전 기록은 도전 모드 10문제로 본다.
  const DEFAULT_COUNT = 10;
  const countOf = r => r.count || DEFAULT_COUNT;
  const modeOf = r => r.mode || "challenge";
  const boardOf = r => `${modeOf(r)}:${countOf(r)}`;

  // 점수 높은 순, 같으면 걸린 시간 짧은 순, 그래도 같으면 먼저 기록한 순. 순위표마다 상위 RANK_LIMIT개만 남긴다.
  function addRecord(records, record) {
    const kept = {};
    return records
      .concat(record)
      .map((r, i) => ({ r, i }))
      .sort((a, b) => b.r.score - a.r.score || a.r.seconds - b.r.seconds || a.i - b.i)
      .map(x => x.r)
      .filter(r => {
        const key = boardOf(r);
        kept[key] = (kept[key] || 0) + 1;
        return kept[key] <= RANK_LIMIT;
      });
  }

  // 한 순위표(모드, 문제 수)만 골라 낸다.
  function recordsFor(records, count, mode = "challenge") {
    return records.filter(r => countOf(r) === count && modeOf(r) === mode);
  }

  // ───── 플레이 기록 통계 (통계 대시보드, 선생님 모드에서 사용) ─────
  function summarizeHistory(entries) {
    const sum = {
      games: entries.length, questions: 0, correct: 0, seconds: 0, hints: 0, timeouts: 0,
      bestScore: 0, accuracy: 0, perCat: {}, perDiff: {}, wrongCounts: []
    };
    const wrong = {};
    const add = (bucket, key, s) => {
      const b = bucket[key] || (bucket[key] = { total: 0, correct: 0 });
      b.total += s.total;
      b.correct += s.correct;
    };
    for (const e of entries) {
      sum.questions += e.count || 0;
      sum.correct += e.correct || 0;
      sum.seconds += e.seconds || 0;
      sum.hints += e.hints || 0;
      sum.timeouts += e.timeouts || 0;
      sum.bestScore = Math.max(sum.bestScore, e.score || 0);
      for (const [k, s] of Object.entries(e.perCat || {})) add(sum.perCat, k, s);
      for (const [k, s] of Object.entries(e.perDiff || {})) add(sum.perDiff, k, s);
      for (const id of e.wrongIds || []) wrong[id] = (wrong[id] || 0) + 1;
    }
    sum.accuracy = sum.questions ? sum.correct / sum.questions : 0;
    sum.wrongCounts = Object.entries(wrong)
      .map(([id, n]) => ({ id, n }))
      .sort((a, b) => b.n - a.n || a.id.localeCompare(b.id));
    return sum;
  }

  // ───── 문제 은행 점검 (커스텀 명령어 /quiz-check, /quiz-validate, /quiz-range가 사용) ─────
  const norm = t => String(t || "").replace(/\s+/g, " ").trim();

  // 문제 문장과 코드가 같으면 중복으로 본다.
  function findDuplicates(questions) {
    const groups = {};
    for (const q of questions) {
      const key = norm(q.question) + "\u0000" + norm(q.code);
      (groups[key] || (groups[key] = [])).push(q.id);
    }
    return Object.values(groups).filter(ids => ids.length > 1);
  }

  // 최상급 표현은 측정 기준이 없으면 정답 논란이 생긴다(CLAUDE.md 가이드라인 2).
  const SUPERLATIVES = ["가장", "최초", "최대", "최소", "최고", "최저", "최악", "최선", "유일"];
  function findSuperlatives(questions, words = SUPERLATIVES) {
    const found = [];
    for (const q of questions) {
      const text = [q.question, ...q.choices, q.explanation].join(" ");
      const hits = words.filter(w => text.includes(w));
      if (hits.length) found.push({ id: q.id, words: hits, question: q.question });
    }
    return found;
  }

  // 정답 위치(원본 데이터 기준 1~4번) 분포
  function answerDistribution(questions) {
    const counts = [0, 0, 0, 0];
    questions.forEach(q => counts[q.answer]++);
    return counts;
  }

  // 난이도 평균·표준편차·분포
  function difficultyStats(questions) {
    const values = questions.map(q => q.difficulty).filter(Number.isFinite);
    const n = values.length;
    const mean = n ? values.reduce((a, b) => a + b, 0) / n : 0;
    const std = n ? Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / n) : 0;
    const counts = { 1: 0, 2: 0, 3: 0 };
    values.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    return { n, mean, std, counts };
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return m > 0 ? `${m}분 ${s}초` : `${s}초`;
  }

  return {
    RANK_LIMIT, POINTS, HINT_COST, SPEED_LIMIT, SPEED_BONUS_STEP, SUPERLATIVES,
    shuffle, pickQuestions, pickCategory, shuffleChoices, hintRemovals, questionPoints,
    addRecord, recordsFor, summarizeHistory,
    findDuplicates, findSuperlatives, answerDistribution, difficultyStats, formatTime
  };
})();

if (typeof module !== "undefined") module.exports = QuizCore;
