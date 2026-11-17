(() => {
  const COUNTS = [5, 10, 15, 25, 50]; // 5과목에서 똑같이 뽑으므로 5의 배수
  const DEFAULT_COUNT = 10;
  const HISTORY_LIMIT = 500;
  const KEYS = {
    ranking: "study03.ranking.v1",
    history: "study03.history.v1",
    profile: "study03.profile.v1",
    oldName: "study03.name" // 예전 버전에서 이름만 저장하던 키
  };
  const AVATARS = ["🙂", "😎", "🤓", "🦊", "🐱", "🐶", "🐼", "🚀"];
  const MODE_LABEL = { challenge: "도전", speed: "스피드", practice: "과목 연습", review: "오답 복습" };
  const CATEGORY_KEYS = Object.keys(CATEGORIES);
  const Q_BY_ID = Object.fromEntries(QUESTIONS.map(q => [q.id, q]));

  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const pct = r => `${Math.round(r * 100)}%`;
  const screens = {};
  for (const name of ["start", "quiz", "result", "ranking", "stats", "profile"]) screens[name] = $(`screen-${name}`);

  let game = null;
  let lastRecord = null; // 방금 끝낸 게임의 순위 기록 (순위표에서 강조)

  // ───── 저장소 (막힌 환경에서는 이번 접속 동안만 메모리에 보관) ─────
  const memory = {};
  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      return key in memory ? memory[key] : fallback;
    }
  }
  function save(key, value) {
    memory[key] = value;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 저장 불가 */ }
  }
  const loadRanking = () => { const d = load(KEYS.ranking, []); return Array.isArray(d) ? d : []; };
  const loadHistory = () => { const d = load(KEYS.history, []); return Array.isArray(d) ? d : []; };

  function loadProfile() {
    const p = load(KEYS.profile, null);
    if (p && typeof p === "object") return { name: "", avatar: AVATARS[0], goal: 60, ...p };
    let oldName = "";
    try { oldName = localStorage.getItem(KEYS.oldName) || ""; } catch (e) { /* 없음 */ }
    return { name: oldName, avatar: AVATARS[0], goal: 60 };
  }
  function saveProfile(p) {
    save(KEYS.profile, p);
    renderNav();
  }

  // ───── 화면 공통 ─────
  function show(name) {
    for (const [key, s] of Object.entries(screens)) s.hidden = key !== name;
    $("topbar").hidden = name === "quiz";
    document.querySelectorAll(".nav-btn, .brand").forEach(b => b.classList.toggle("active", b.dataset.go === name));
    window.scrollTo(0, 0);
  }

  function go(name) {
    if (name === "start") renderStart();
    else if (name === "ranking") renderRankingScreen();
    else if (name === "stats") renderStats();
    else if (name === "profile") renderProfile();
  }
  document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => go(b.dataset.go)));

  function renderNav() {
    const p = loadProfile();
    $("nav-avatar").textContent = p.avatar;
    $("nav-name").textContent = p.name || "프로필";
  }

  function renderRanking(listEl, highlight, count, mode) {
    listEl.replaceChildren();
    const records = QuizCore.recordsFor(loadRanking(), count, mode);
    if (records.length === 0) {
      listEl.append(el("li", "empty", "아직 기록이 없습니다."));
      return;
    }
    records.forEach(r => {
      const li = el("li", r.id === highlight ? "me" : "");
      li.append(
        el("span", "name", r.name),
        el("span", "score", `${r.score}점`),
        el("span", "meta", `${QuizCore.formatTime(r.seconds)} · ${r.date}`)
      );
      listEl.append(li);
    });
  }

  // 누적 정답률 막대 목록 (결과·통계 화면 공용)
  function renderBars(ul, rows) {
    ul.replaceChildren();
    rows.forEach(({ label, correct, total }) => {
      const li = el("li");
      li.append(label, el("span", "muted", total ? `${correct} / ${total} · ${pct(correct / total)}` : "기록 없음"));
      const bar = el("i", "mini-bar");
      bar.style.setProperty("--pct", `${total ? (correct / total) * 100 : 0}%`);
      li.append(bar);
      ul.append(li);
    });
  }

  // ───── 시작 화면 ─────
  function renderStart() {
    const ul = $("cat-list");
    ul.replaceChildren();
    CATEGORY_KEYS.forEach((key, i) => {
      const li = el("li");
      const count = QUESTIONS.filter(q => q.category === key).length;
      li.append(`${i + 1}과목 ${CATEGORIES[key].name}`, el("span", "muted", `문제 은행 ${count}문제`));
      ul.append(li);
    });
    const mode = $("mode");
    if (!mode.options.length) {
      mode.append(new Option("도전 모드 — 문제 수 선택, 순위표 기록", "challenge"));
      mode.append(new Option(`스피드 퀴즈 — 문제당 ${QuizCore.SPEED_LIMIT}초, 빨리 맞히면 보너스`, "speed"));
      CATEGORY_KEYS.forEach((key, i) => mode.append(new Option(`${i + 1}과목 연습 — ${CATEGORIES[key].name}`, key)));
      const count = $("count");
      COUNTS.forEach(n => count.append(new Option(`${n}문제`, String(n))));
      count.value = String(DEFAULT_COUNT);
    }
    updateModeHint();
    $("player-name").value = loadProfile().name;
    show("start");
  }

  const selectedCount = () => Number($("count").value) || DEFAULT_COUNT;
  const isRankedMode = m => m === "challenge" || m === "speed";

  function updateModeHint() {
    const m = $("mode").value;
    const ranked = isRankedMode(m);
    $("count").hidden = !ranked;
    $("count-label").hidden = !ranked;
    const per = selectedCount() / CATEGORY_KEYS.length;
    $("mode-hint").textContent =
      m === "challenge" ? `과목별 ${per}문제씩 무작위로 뽑아 풉니다. 문제당 10점, 점수와 시간이 순위표에 기록됩니다.`
      : m === "speed" ? `과목별 ${per}문제씩, 문제당 ${QuizCore.SPEED_LIMIT}초 안에 답해야 합니다. 시간이 지나면 오답 처리되고, 남은 시간 ${QuizCore.SPEED_BONUS_STEP}초마다 보너스 1점을 더 줍니다.`
      : "고른 과목의 문제를 전부 풀어 봅니다. 연습이라 순위표에는 기록되지 않지만 통계에는 남습니다.";
  }
  $("mode").addEventListener("change", updateModeHint);
  $("count").addEventListener("change", updateModeHint);

  $("start-form").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("player-name").value.trim() || "익명";
    const profile = loadProfile();
    if (name !== "익명" && name !== profile.name) saveProfile({ ...profile, name });
    const m = $("mode").value;
    if (isRankedMode(m)) {
      const picked = QuizCore.pickQuestions(QUESTIONS, CATEGORY_KEYS, selectedCount() / CATEGORY_KEYS.length);
      startGame({ name, picked, mode: m });
    } else {
      startGame({ name, picked: QuizCore.pickCategory(QUESTIONS, m), mode: "practice", category: m });
    }
  });

  function startGame({ name, picked, mode, category = null }) {
    stopTimers();
    const questions = picked.map(q => QuizCore.shuffleChoices(q));
    const perCat = {};
    const perDiff = {};
    questions.forEach(q => {
      (perCat[q.category] || (perCat[q.category] = { total: 0, correct: 0 })).total++;
      (perDiff[q.difficulty] || (perDiff[q.difficulty] = { total: 0, correct: 0 })).total++;
    });
    game = {
      name, mode, category, questions, perCat, perDiff,
      index: 0, score: 0, correct: 0, wrongs: [], hints: 0, timeouts: 0,
      startedAt: Date.now(), answered: false, hinted: false,
      ranked: isRankedMode(mode), timer: null, speedTimer: null, qStartedAt: 0
    };
    game.timer = setInterval(tick, 1000);
    tick();
    show("quiz");
    renderQuestion();
  }

  function stopTimers() {
    if (!game) return;
    clearInterval(game.timer);
    clearInterval(game.speedTimer);
  }

  function tick() {
    $("quiz-time").textContent = QuizCore.formatTime(Math.round((Date.now() - game.startedAt) / 1000));
  }

  // ───── 퀴즈 화면 ─────
  function renderQuestion() {
    const q = game.questions[game.index];
    game.answered = false;
    game.hinted = false;
    $("quiz-progress").textContent = `${game.index + 1} / ${game.questions.length}`;
    $("quiz-category").textContent = CATEGORIES[q.category].name;
    const level = $("quiz-difficulty");
    level.textContent = DIFFICULTIES[q.difficulty] || "";
    level.dataset.level = q.difficulty;
    $("quiz-score").textContent = `${game.score}점`;
    $("quiz-bar").style.width = `${(game.index / game.questions.length) * 100}%`;
    $("quiz-question").textContent = q.question;

    const code = $("quiz-code");
    code.hidden = !q.code;
    code.textContent = q.code || "";

    const ul = $("quiz-choices");
    ul.replaceChildren();
    q.choices.forEach((text, i) => {
      const li = el("li");
      const btn = el("button", "choice");
      btn.type = "button";
      btn.dataset.index = i;
      btn.append(el("span", "no", `${i + 1}`), el("span", "", text));
      btn.addEventListener("click", () => answer(i));
      li.append(btn);
      ul.append(li);
    });

    const hint = $("btn-hint");
    hint.hidden = false;
    hint.disabled = false;
    $("quiz-feedback").hidden = true;
    $("btn-next").hidden = true;

    $("speed-wrap").hidden = game.mode !== "speed";
    if (game.mode === "speed") {
      game.qStartedAt = Date.now();
      clearInterval(game.speedTimer);
      game.speedTimer = setInterval(speedTick, 100);
      speedTick();
    }
  }

  const remainingSeconds = () => Math.max(0, QuizCore.SPEED_LIMIT - (Date.now() - game.qStartedAt) / 1000);

  function speedTick() {
    const left = remainingSeconds();
    $("speed-bar").style.width = `${(left / QuizCore.SPEED_LIMIT) * 100}%`;
    $("speed-left").textContent = `${Math.ceil(left)}초`;
    $("speed-wrap").classList.toggle("urgent", left <= 5);
    if (left <= 0) answer(-1); // 시간 초과
  }

  function useHint() {
    if (!game || game.answered || game.hinted) return;
    const q = game.questions[game.index];
    game.hinted = true;
    game.hints++;
    const removed = QuizCore.hintRemovals(q);
    document.querySelectorAll(".choice").forEach(btn => {
      if (removed.includes(Number(btn.dataset.index))) {
        btn.disabled = true;
        btn.classList.add("removed");
      }
    });
    $("btn-hint").disabled = true;
  }
  $("btn-hint").addEventListener("click", useHint);

  function answer(picked) {
    if (game.answered) return;
    const q = game.questions[game.index];
    if (picked >= 0 && document.querySelector(`.choice[data-index="${picked}"]`)?.classList.contains("removed")) return;
    game.answered = true;
    clearInterval(game.speedTimer);
    const timeout = picked < 0;
    const ok = picked === q.answer;
    const remaining = game.mode === "speed" ? remainingSeconds() : 0;
    const points = QuizCore.questionPoints({ correct: ok, hinted: game.hinted, speed: game.mode === "speed", remaining });
    game.score += points;

    if (ok) {
      game.correct++;
      game.perCat[q.category].correct++;
      game.perDiff[q.difficulty].correct++;
    } else {
      game.wrongs.push({ q, picked });
      if (timeout) game.timeouts++;
    }

    document.querySelectorAll(".choice").forEach(btn => {
      const i = Number(btn.dataset.index);
      btn.disabled = true;
      if (i === q.answer) btn.classList.add("correct");
      else if (i === picked) btn.classList.add("wrong");
    });
    $("btn-hint").hidden = true;

    const fb = $("quiz-feedback");
    fb.className = `feedback ${ok ? "ok" : "bad"}`;
    const correctText = `정답은 ${q.answer + 1}번 “${q.choices[q.answer]}”`;
    let title;
    if (ok) {
      const parts = [];
      if (game.hinted) parts.push("힌트 사용");
      if (game.mode === "speed" && points > (game.hinted ? QuizCore.POINTS - QuizCore.HINT_COST : QuizCore.POINTS)) parts.push("속도 보너스");
      title = `정답입니다! +${points}점` + (parts.length ? ` (${parts.join(", ")})` : "");
    } else {
      title = timeout ? `⏰ 시간 초과! ${correctText}` : `오답입니다. ${correctText}`;
    }
    $("feedback-title").textContent = title;
    $("feedback-text").textContent = q.explanation;
    fb.hidden = false;
    $("quiz-score").textContent = `${game.score}점`;

    const next = $("btn-next");
    next.textContent = game.index === game.questions.length - 1 ? "결과 보기" : "다음 문제";
    next.hidden = false;
    next.focus();
  }

  $("btn-next").addEventListener("click", () => {
    if (game.index === game.questions.length - 1) finish();
    else { game.index++; renderQuestion(); }
  });

  // 키보드: 1~4 보기 선택, H 힌트, Enter 다음 문제(버튼에 포커스가 있으면 기본 동작 사용)
  document.addEventListener("keydown", e => {
    if (screens.quiz.hidden || !game || e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.target.matches?.("input, select, textarea")) return;
    if (!game.answered && (e.key === "h" || e.key === "H")) { useHint(); return; }
    const n = Number(e.key);
    if (!game.answered && n >= 1 && n <= 4) {
      const q = game.questions[game.index];
      if (n <= q.choices.length) answer(n - 1);
    }
  });

  // ───── 결과 화면 ─────
  function finish() {
    stopTimers();
    const total = game.questions.length;
    const seconds = Math.round((Date.now() - game.startedAt) / 1000);
    const now = new Date();
    const id = `${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`;
    const date = now.toLocaleDateString("ko-KR");

    lastRecord = null;
    if (game.ranked) {
      lastRecord = { id, name: game.name, mode: game.mode, score: game.score, count: total, seconds, date };
      save(KEYS.ranking, QuizCore.addRecord(loadRanking(), lastRecord));
      // 상단 🏆 메뉴로 들어가도 방금 푼 순위표가 먼저 보이게
      ensureRankCounts();
      $("rank-mode").value = game.mode;
      $("rank-count").value = String(total);
    }
    const history = loadHistory();
    history.push({
      id, name: game.name, mode: game.mode, category: game.category,
      count: total, correct: game.correct, score: game.score, seconds,
      hints: game.hints, timeouts: game.timeouts,
      date, playedAt: now.toISOString(),
      perCat: game.perCat, perDiff: game.perDiff,
      wrongIds: game.wrongs.map(w => w.q.id)
    });
    save(KEYS.history, history.slice(-HISTORY_LIMIT));

    const acc = game.correct / total;
    $("result-title").textContent = acc === 1 ? "🏆 만점!" : acc >= 0.6 ? "🎉 합격권!" : "💪 조금만 더!";
    $("result-summary").textContent =
      `${game.name}님, ${total}문제 중 ${game.correct}문제 정답 · ${game.score}점 · ${QuizCore.formatTime(seconds)}`;

    const chips = $("result-chips");
    chips.replaceChildren();
    const chipTexts = [`${MODE_LABEL[game.mode]} 모드`, `정답률 ${pct(acc)}`, `힌트 ${game.hints}회`];
    if (game.mode === "speed") chipTexts.push(`시간 초과 ${game.timeouts}회`);
    chipTexts.forEach(t => chips.append(el("li", "chip", t)));

    renderBars($("result-cats"), CATEGORY_KEYS
      .filter(k => game.perCat[k])
      .map(k => ({ label: CATEGORIES[k].name, ...game.perCat[k] })));

    const wrong = $("result-wrong");
    wrong.replaceChildren();
    if (game.wrongs.length === 0) wrong.append(el("li", "", "모두 맞혔습니다. 만점!"));
    game.wrongs.forEach(({ q, picked }) => {
      const li = el("li");
      li.append(q.question);
      const a = el("small");
      a.append(picked < 0 ? "시간 초과 → 정답: " : `내 답: ${q.choices[picked]} → 정답: `, el("span", "ans", q.choices[q.answer]));
      li.append(a, el("small", "", q.explanation));
      wrong.append(li);
    });

    $("ranking-section").hidden = !game.ranked;
    if (game.ranked) {
      $("ranking-result-title").textContent = `순위표 (${MODE_LABEL[game.mode]} · ${total}문제)`;
      renderRanking($("ranking-result"), id, total, game.mode);
    }
    $("btn-retry-wrong").hidden = game.wrongs.length === 0;
    $("quiz-bar").style.width = "100%";
    show("result");
  }

  $("btn-retry-wrong").addEventListener("click", () => {
    startGame({ name: game.name, picked: game.wrongs.map(w => w.q), mode: "review" });
  });
  $("btn-retry").addEventListener("click", renderStart);
  $("btn-show-ranking").addEventListener("click", renderRankingScreen);
  $("btn-show-stats").addEventListener("click", renderStats);

  // ───── 순위표 화면 ─────
  function ensureRankCounts() {
    const count = $("rank-count");
    if (count.options.length) return;
    COUNTS.forEach(n => count.append(new Option(`${n}문제`, String(n))));
    count.value = String(DEFAULT_COUNT);
  }

  function renderRankingScreen() {
    ensureRankCounts();
    renderRanking($("ranking-board"), lastRecord?.id, Number($("rank-count").value), $("rank-mode").value);
    show("ranking");
  }
  $("rank-mode").addEventListener("change", renderRankingScreen);
  $("rank-count").addEventListener("change", renderRankingScreen);

  $("btn-reset-rank").addEventListener("click", () => {
    if (loadRanking().length === 0) return;
    if (!confirm("모든 모드·문제 수의 순위표 기록을 지울까요? 되돌릴 수 없습니다.")) return;
    save(KEYS.ranking, []);
    renderRankingScreen();
  });

  // ───── 통계 대시보드 ─────
  function myHistory() {
    const name = loadProfile().name || "익명";
    return { name, entries: loadHistory().filter(e => e.name === name) };
  }

  function renderStats() {
    const profile = loadProfile();
    const { name, entries } = myHistory();
    $("stats-title").textContent = `${profile.avatar} ${name}님의 통계`;
    $("stats-lead").textContent = `이 브라우저에서 '${name}' 이름으로 푼 기록 ${entries.length}회를 모았습니다.`;
    $("stats-empty").hidden = entries.length > 0;
    $("stats-body").hidden = entries.length === 0;
    $("btn-clear-history").disabled = entries.length === 0;
    show("stats");
    if (!entries.length) return;

    const s = QuizCore.summarizeHistory(entries);
    const tiles = $("stats-tiles");
    tiles.replaceChildren();
    [
      ["플레이", `${s.games}회`],
      ["누적 정답률", pct(s.accuracy)],
      ["최고 점수", `${s.bestScore}점`],
      ["푼 문제", `${s.questions}문제`],
      ["학습 시간", QuizCore.formatTime(s.seconds)],
      ["힌트 사용", `${s.hints}회`]
    ].forEach(([label, value]) => {
      const t = el("div", "tile");
      t.append(el("span", "tile-value", value), el("span", "tile-label", label));
      tiles.append(t);
    });

    const goal = profile.goal / 100;
    $("stats-goal").textContent = s.accuracy >= goal
      ? `🎯 목표 정답률 ${profile.goal}% 달성! 현재 ${pct(s.accuracy)}`
      : `🎯 목표 정답률 ${profile.goal}%까지 ${Math.ceil((goal - s.accuracy) * 100)}%p 남았습니다. (현재 ${pct(s.accuracy)})`;

    renderBars($("stats-cats"), CATEGORY_KEYS.map(k => ({ label: CATEGORIES[k].name, total: 0, correct: 0, ...s.perCat[k] })));
    renderBars($("stats-diff"), Object.keys(DIFFICULTIES).map(k => ({ label: DIFFICULTIES[k], total: 0, correct: 0, ...s.perDiff[k] })));

    const wrong = $("stats-wrong");
    wrong.replaceChildren();
    const top = s.wrongCounts.filter(w => Q_BY_ID[w.id]).slice(0, 5);
    if (!top.length) wrong.append(el("li", "", "틀린 문제가 없습니다."));
    top.forEach(({ id, n }) => {
      const q = Q_BY_ID[id];
      const li = el("li");
      li.append(q.question);
      const a = el("small");
      a.append(`${n}회 틀림 · 정답: `, el("span", "ans", q.choices[q.answer]));
      li.append(a, el("small", "", q.explanation));
      wrong.append(li);
    });

    const recent = $("stats-recent");
    recent.replaceChildren();
    entries.slice(-10).reverse().forEach(e => {
      const li = el("li");
      const label = e.mode === "practice" && CATEGORIES[e.category] ? `${CATEGORIES[e.category].short} 연습` : MODE_LABEL[e.mode] || e.mode;
      li.append(
        el("span", "recent-mode", label),
        el("span", "", `${e.correct}/${e.count} 정답 · ${e.score}점`),
        el("span", "muted", `${QuizCore.formatTime(e.seconds)} · ${e.date}`)
      );
      recent.append(li);
    });
  }

  $("btn-export").addEventListener("click", () => {
    const history = loadHistory();
    if (!history.length) { alert("내보낼 기록이 없습니다."); return; }
    const profile = loadProfile();
    const data = { app: "study03-quiz", version: 1, exportedAt: new Date().toISOString(), profile: { name: profile.name }, history };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const safe = (profile.name || "player").replace(/[\\/:*?"<>|\s]+/g, "_");
    a.href = URL.createObjectURL(blob);
    a.download = `quiz-results-${safe}-${stamp}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $("btn-clear-history").addEventListener("click", () => {
    const { name, entries } = myHistory();
    if (!entries.length) return;
    if (!confirm(`'${name}' 이름의 플레이 기록 ${entries.length}회를 지울까요? 순위표는 그대로 남고, 되돌릴 수 없습니다.`)) return;
    save(KEYS.history, loadHistory().filter(e => e.name !== name));
    renderStats();
  });

  // ───── 프로필 ─────
  function renderProfile() {
    const p = loadProfile();
    $("profile-name").value = p.name;
    $("profile-goal").value = String(p.goal);
    const list = $("avatar-list");
    list.replaceChildren();
    AVATARS.forEach((a, i) => {
      const label = el("label", "avatar");
      const input = el("input");
      input.type = "radio";
      input.name = "avatar";
      input.value = a;
      input.id = `avatar-${i}`;
      input.checked = a === p.avatar;
      label.append(input, el("span", "", a));
      list.append(label);
    });
    $("profile-saved").textContent = "";
    show("profile");
  }

  $("profile-form").addEventListener("submit", e => {
    e.preventDefault();
    const old = loadProfile();
    const name = $("profile-name").value.trim();
    const avatar = document.querySelector('input[name="avatar"]:checked')?.value || old.avatar;
    const goal = Number($("profile-goal").value) || 60;
    let msg = "저장했습니다.";
    if (old.name && name && name !== old.name) {
      const mine = loadHistory().filter(h => h.name === old.name).length;
      if (mine && confirm(`'${old.name}' 이름으로 저장된 플레이 기록 ${mine}회를 '${name}' 이름으로 옮길까요?`)) {
        save(KEYS.history, loadHistory().map(h => (h.name === old.name ? { ...h, name } : h)));
        msg = `저장했습니다. 기록 ${mine}회를 새 이름으로 옮겼습니다.`;
      }
    }
    saveProfile({ ...old, name, avatar, goal });
    $("profile-saved").textContent = msg;
  });

  renderNav();
  renderStart();
})();
