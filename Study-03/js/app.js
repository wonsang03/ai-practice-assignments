(() => {
  const PER_CATEGORY = 2;
  const POINTS = 10;
  const RANK_KEY = "study03.ranking.v1";
  const CATEGORY_KEYS = Object.keys(CATEGORIES);

  const $ = id => document.getElementById(id);
  const screens = { start: $("screen-start"), quiz: $("screen-quiz"), result: $("screen-result") };

  let game = null; // { name, questions, index, correct, wrongs, perCat, startedAt, answered }

  // ───── 저장소 (막힌 환경에서는 이번 접속 동안만 메모리에 보관) ─────
  let memoryRanking = [];
  function loadRanking() {
    try {
      const data = JSON.parse(localStorage.getItem(RANK_KEY));
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return memoryRanking;
    }
  }
  function saveRanking(list) {
    memoryRanking = list;
    try { localStorage.setItem(RANK_KEY, JSON.stringify(list)); } catch (e) { /* 저장 불가 */ }
  }

  // ───── 화면 공통 ─────
  function show(name) {
    for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
    window.scrollTo(0, 0);
  }

  function renderRanking(listEl, highlight) {
    listEl.replaceChildren();
    const records = loadRanking();
    if (records.length === 0) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "아직 기록이 없습니다.";
      listEl.append(li);
      return;
    }
    records.forEach(r => {
      const li = document.createElement("li");
      if (r.id === highlight) li.className = "me";
      li.textContent = `${r.name} — ${r.score}점 `;
      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = `(${QuizCore.formatTime(r.seconds)}, ${r.date})`;
      li.append(meta);
      listEl.append(li);
    });
  }

  // ───── 시작 화면 ─────
  function renderStart() {
    const ul = $("cat-list");
    ul.replaceChildren();
    CATEGORY_KEYS.forEach((key, i) => {
      const li = document.createElement("li");
      const count = QUESTIONS.filter(q => q.category === key).length;
      li.append(`${i + 1}과목 ${CATEGORIES[key].name}`);
      const m = document.createElement("span");
      m.className = "muted";
      m.textContent = `문제 은행 ${count}문제`;
      li.append(m);
      ul.append(li);
    });
    renderRanking($("ranking-start"));
    show("start");
  }

  $("start-form").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("player-name").value.trim() || "익명";
    const questions = QuizCore.pickQuestions(QUESTIONS, CATEGORY_KEYS, PER_CATEGORY).map(q => QuizCore.shuffleChoices(q));
    const perCat = {};
    CATEGORY_KEYS.forEach(k => { perCat[k] = { total: 0, correct: 0 }; });
    questions.forEach(q => { perCat[q.category].total++; });
    game = { name, questions, index: 0, correct: 0, wrongs: [], perCat, startedAt: Date.now(), answered: false };
    show("quiz");
    renderQuestion();
  });

  // ───── 퀴즈 화면 ─────
  function renderQuestion() {
    const q = game.questions[game.index];
    game.answered = false;
    $("quiz-progress").textContent = `${game.index + 1} / ${game.questions.length}`;
    $("quiz-category").textContent = CATEGORIES[q.category].name;
    $("quiz-score").textContent = `${game.correct * POINTS}점`;
    $("quiz-bar").style.width = `${(game.index / game.questions.length) * 100}%`;
    $("quiz-question").textContent = q.question;

    const code = $("quiz-code");
    code.hidden = !q.code;
    code.textContent = q.code || "";

    const ul = $("quiz-choices");
    ul.replaceChildren();
    q.choices.forEach((text, i) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice";
      btn.dataset.index = i;
      const no = document.createElement("span");
      no.className = "no";
      no.textContent = `${i + 1}`;
      const label = document.createElement("span");
      label.textContent = text;
      btn.append(no, label);
      btn.addEventListener("click", () => answer(i));
      li.append(btn);
      ul.append(li);
    });

    $("quiz-feedback").hidden = true;
    $("btn-next").hidden = true;
  }

  function answer(picked) {
    if (game.answered) return;
    game.answered = true;
    const q = game.questions[game.index];
    const ok = picked === q.answer;

    if (ok) {
      game.correct++;
      game.perCat[q.category].correct++;
    } else {
      game.wrongs.push({ q, picked });
    }

    document.querySelectorAll(".choice").forEach(btn => {
      const i = Number(btn.dataset.index);
      btn.disabled = true;
      if (i === q.answer) btn.classList.add("correct");
      else if (i === picked) btn.classList.add("wrong");
    });

    const fb = $("quiz-feedback");
    fb.className = `feedback ${ok ? "ok" : "bad"}`;
    $("feedback-title").textContent = ok ? "정답입니다!" : `오답입니다. 정답은 ${q.answer + 1}번 “${q.choices[q.answer]}”`;
    $("feedback-text").textContent = q.explanation;
    fb.hidden = false;
    $("quiz-score").textContent = `${game.correct * POINTS}점`;

    const next = $("btn-next");
    next.textContent = game.index === game.questions.length - 1 ? "결과 보기" : "다음 문제";
    next.hidden = false;
    next.focus();
  }

  $("btn-next").addEventListener("click", () => {
    if (game.index === game.questions.length - 1) finish();
    else { game.index++; renderQuestion(); }
  });

  // 키보드: 1~4 보기 선택, Enter 다음 문제(버튼에 포커스가 있으면 기본 동작 사용)
  document.addEventListener("keydown", e => {
    if (screens.quiz.hidden || !game || e.ctrlKey || e.altKey || e.metaKey) return;
    const n = Number(e.key);
    if (!game.answered && n >= 1 && n <= 4) {
      const q = game.questions[game.index];
      if (n <= q.choices.length) answer(n - 1);
    }
  });

  // ───── 결과 화면 ─────
  function finish() {
    const total = game.questions.length;
    const score = game.correct * POINTS;
    const seconds = Math.round((Date.now() - game.startedAt) / 1000);
    const record = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: game.name,
      score,
      seconds,
      date: new Date().toLocaleDateString("ko-KR")
    };
    saveRanking(QuizCore.addRecord(loadRanking(), record));

    $("result-summary").textContent =
      `${game.name}님, ${total}문제 중 ${game.correct}문제 정답 · ${score}점 · ${QuizCore.formatTime(seconds)}`;

    const cats = $("result-cats");
    cats.replaceChildren();
    CATEGORY_KEYS.forEach(key => {
      const c = game.perCat[key];
      const li = document.createElement("li");
      li.append(CATEGORIES[key].name);
      const m = document.createElement("span");
      m.className = "muted";
      m.textContent = `${c.correct} / ${c.total}`;
      li.append(m);
      cats.append(li);
    });

    const wrong = $("result-wrong");
    wrong.replaceChildren();
    if (game.wrongs.length === 0) {
      const li = document.createElement("li");
      li.textContent = "모두 맞혔습니다. 만점!";
      wrong.append(li);
    }
    game.wrongs.forEach(({ q, picked }) => {
      const li = document.createElement("li");
      li.append(q.question);
      const a = document.createElement("small");
      a.append(`내 답: ${q.choices[picked]} → 정답: `);
      const b = document.createElement("span");
      b.className = "ans";
      b.textContent = q.choices[q.answer];
      a.append(b);
      const e = document.createElement("small");
      e.textContent = q.explanation;
      li.append(a, e);
      wrong.append(li);
    });

    renderRanking($("ranking-result"), record.id);
    $("quiz-bar").style.width = "100%";
    show("result");
  }

  $("btn-retry").addEventListener("click", renderStart);

  renderStart();
})();
