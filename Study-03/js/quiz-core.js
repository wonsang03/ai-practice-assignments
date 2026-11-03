/* 화면과 무관한 퀴즈 로직 (브라우저와 Node 테스트에서 함께 사용) */
const QuizCore = (() => {
  const RANK_LIMIT = 10;

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

  // 문제 수가 다르면 점수를 비교할 수 없으므로 순위표는 문제 수별로 나눈다.
  // count가 없는 예전 기록은 기본 10문제로 본다.
  const DEFAULT_COUNT = 10;
  const countOf = r => r.count || DEFAULT_COUNT;

  // 점수 높은 순, 같으면 걸린 시간 짧은 순, 그래도 같으면 먼저 기록한 순. 문제 수별로 상위 RANK_LIMIT개만 남긴다.
  function addRecord(records, record) {
    const kept = {};
    return records
      .concat(record)
      .map((r, i) => ({ r, i }))
      .sort((a, b) => b.r.score - a.r.score || a.r.seconds - b.r.seconds || a.i - b.i)
      .map(x => x.r)
      .filter(r => {
        const n = countOf(r);
        kept[n] = (kept[n] || 0) + 1;
        return kept[n] <= RANK_LIMIT;
      });
  }

  // 한 문제 수의 순위표만 골라 낸다.
  function recordsFor(records, count) {
    return records.filter(r => countOf(r) === count);
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return m > 0 ? `${m}분 ${s}초` : `${s}초`;
  }

  return { RANK_LIMIT, shuffle, pickQuestions, pickCategory, shuffleChoices, addRecord, recordsFor, formatTime };
})();

if (typeof module !== "undefined") module.exports = QuizCore;
