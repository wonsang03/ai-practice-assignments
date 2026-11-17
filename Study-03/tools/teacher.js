#!/usr/bin/env node
/*
 * 선생님 모드 도구. 학생들이 통계 화면에서 내보낸 JSON 파일을 data/results/에 모아 두면
 * 반 전체 결과를 수집·분석해 보고서를 만든다. 설치 필요 없음.
 *
 *   node tools/teacher.js collect               data/results/*.json을 읽어 유효한 기록 수와 학생 목록 출력
 *   node tools/teacher.js report                teacher_report.html 생성 (상대평가 등급 포함)
 *   node tools/teacher.js csv                   report_detailed.csv 생성 (엑셀에서 바로 열림)
 *   node tools/teacher.js leaderboard [모드] [문제 수]   학생별 최고 점수 리더보드 (기본: challenge 10)
 *   node tools/teacher.js all                   collect → report → csv 한 번에
 *   node tools/teacher.js demo                  data/results/demo-class.json에 시연용 가상 데이터 생성
 */
const fs = require("node:fs");
const path = require("node:path");
const { QUESTIONS, CATEGORIES } = require("../js/questions.js");
const Core = require("../js/quiz-core.js");

const ROOT = path.join(__dirname, "..");
const RESULTS_DIR = path.join(ROOT, "data", "results");
const REPORT_HTML = path.join(ROOT, "teacher_report.html");
const REPORT_CSV = path.join(ROOT, "report_detailed.csv");
const KEYS = Object.keys(CATEGORIES);
const Q_BY_ID = Object.fromEntries(QUESTIONS.map(q => [q.id, q]));
const MODE_LABEL = { challenge: "도전", speed: "스피드", practice: "과목 연습", review: "오답 복습" };

// 상대평가: 정답률 순위 상위 30%는 A, 다음 40%는 B, 나머지는 C. 같은 정답률은 같은 등급.
const GRADE_CUTS = [{ grade: "A", upTo: 0.3 }, { grade: "B", upTo: 0.7 }, { grade: "C", upTo: 1 }];
const MIN_QUESTIONS = 10; // 이보다 적게 푼 학생은 등급 대신 '기록 부족'

// ───── 수집 ─────
function collect(dir = RESULTS_DIR) {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith(".json")).sort() : [];
  const seen = new Set();
  const entries = [];
  const skipped = [];
  for (const f of files) {
    let data;
    try { data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); }
    catch (e) { skipped.push({ file: f, reason: "JSON 형식 오류" }); continue; }
    if (!data || data.app !== "study03-quiz" || !Array.isArray(data.history)) {
      skipped.push({ file: f, reason: "퀴즈 앱에서 내보낸 파일이 아님" });
      continue;
    }
    for (const e of data.history) {
      const ok = e && typeof e.id === "string" && typeof e.name === "string" && e.name.trim()
        && Number.isFinite(e.count) && e.count > 0 && Number.isFinite(e.correct) && e.correct >= 0 && e.correct <= e.count;
      if (!ok) continue;
      if (seen.has(e.id)) continue; // 같은 기록을 두 번 내보낸 경우
      seen.add(e.id);
      entries.push({ ...e, name: e.name.trim(), source: f });
    }
  }
  return { files, entries, skipped };
}

// ───── 분석 ─────
function analyze(entries) {
  const byName = {};
  for (const e of entries) (byName[e.name] || (byName[e.name] = [])).push(e);
  const students = Object.entries(byName).map(([name, list]) => {
    const s = Core.summarizeHistory(list);
    const catRates = KEYS
      .filter(k => s.perCat[k] && s.perCat[k].total >= 2)
      .map(k => ({ key: k, rate: s.perCat[k].correct / s.perCat[k].total }));
    const weakest = catRates.sort((a, b) => a.rate - b.rate)[0];
    return { name, ...s, weakest: weakest ? CATEGORIES[weakest.key].name : "-" };
  });
  assignGrades(students);
  students.sort((a, b) => (a.rank || Infinity) - (b.rank || Infinity) || a.name.localeCompare(b.name, "ko"));
  return { students, class: Core.summarizeHistory(entries) };
}

// 정답률 내림차순(같으면 최고 점수) 공동 순위를 매기고, 순위 백분위로 등급을 준다.
function assignGrades(students) {
  const graded = students.filter(s => s.questions >= MIN_QUESTIONS)
    .sort((a, b) => b.accuracy - a.accuracy || b.bestScore - a.bestScore);
  graded.forEach((s, i) => {
    const prev = graded[i - 1];
    s.rank = prev && prev.accuracy === s.accuracy && prev.bestScore === s.bestScore ? prev.rank : i + 1;
    const position = (s.rank - 1) / graded.length; // 0 = 1등
    s.grade = GRADE_CUTS.find(c => position < c.upTo).grade;
  });
  students.filter(s => s.questions < MIN_QUESTIONS).forEach(s => { s.rank = null; s.grade = "기록 부족"; });
  return students;
}

// 학생별 최고 점수 리더보드 (순위표와 같은 기준: 점수 → 시간)
function leaderboard(entries, mode = "challenge", count = 10) {
  const best = {};
  for (const e of entries) {
    if ((e.mode || "challenge") !== mode || e.count !== count) continue;
    const b = best[e.name];
    if (!b || e.score > b.score || (e.score === b.score && e.seconds < b.seconds)) best[e.name] = e;
  }
  return Object.values(best).sort((a, b) => b.score - a.score || a.seconds - b.seconds);
}

// ───── 출력 ─────
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = r => `${Math.round(r * 100)}%`;

function renderHtml({ students, class: cls }, meta) {
  const catRows = KEYS.map(k => {
    const c = cls.perCat[k] || { total: 0, correct: 0 };
    const r = c.total ? c.correct / c.total : 0;
    return `<li><span>${esc(CATEGORIES[k].name)}</span><span class="muted">${c.correct}/${c.total} · ${pct(r)}</span><i class="bar"><b style="width:${(r * 100).toFixed(1)}%"></b></i></li>`;
  }).join("");
  const missed = cls.wrongCounts.filter(w => Q_BY_ID[w.id]).slice(0, 5).map(w => {
    const q = Q_BY_ID[w.id];
    return `<li><b>${esc(w.id)}</b> ${esc(q.question)}<small>${w.n}회 틀림 · 정답: ${esc(q.choices[q.answer])}</small></li>`;
  }).join("") || "<li>틀린 문제가 없습니다.</li>";
  const rows = students.map(s => `<tr>
      <td>${s.rank ?? "-"}</td><td>${esc(s.name)}</td><td><span class="g g-${esc(s.grade === "기록 부족" ? "none" : s.grade)}">${esc(s.grade)}</span></td>
      <td>${s.games}</td><td>${s.questions}</td><td>${pct(s.accuracy)}</td><td>${s.bestScore}</td>
      <td>${esc(Core.formatTime(s.seconds))}</td><td>${s.hints}</td><td>${esc(s.weakest)}</td></tr>`).join("");
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>선생님 모드 보고서</title>
<style>
  :root { --bg:#f4f6fb; --card:#fff; --text:#1c2333; --muted:#5d6679; --line:#d9deea; --accent:#2f5bea; }
  @media (prefers-color-scheme: dark) { :root { --bg:#12151d; --card:#1b2030; --text:#e8ebf4; --muted:#a0a8bd; --line:#32394f; --accent:#7b9bff; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font-family:"Malgun Gothic","Apple SD Gothic Neo",system-ui,sans-serif; line-height:1.6; }
  main { max-width:960px; margin:0 auto; padding:28px 16px 56px; }
  h1 { margin:0 0 4px; } h2 { margin:28px 0 10px; font-size:1.1rem; }
  .muted, small { color:var(--muted); }
  .card { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:20px; }
  .tiles { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; margin-top:16px; }
  .tile { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:14px; }
  .tile b { display:block; font-size:1.5rem; }
  ul { list-style:none; padding:0; margin:0; display:grid; gap:8px; }
  .cats li { display:flex; flex-wrap:wrap; justify-content:space-between; gap:4px 12px; }
  .bar { flex-basis:100%; height:6px; background:var(--line); border-radius:3px; overflow:hidden; display:block; }
  .bar b { display:block; height:100%; background:var(--accent); }
  .missed li small { display:block; }
  .table-wrap { overflow-x:auto; }
  table { width:100%; border-collapse:collapse; background:var(--card); font-variant-numeric:tabular-nums; }
  th, td { padding:9px 10px; border-bottom:1px solid var(--line); text-align:left; white-space:nowrap; }
  th { font-size:.85rem; color:var(--muted); }
  .g { display:inline-block; min-width:2.2em; text-align:center; padding:1px 8px; border-radius:999px; font-weight:700; border:1px solid var(--line); }
  .g-A { color:#17803d; border-color:#17803d; } .g-B { color:var(--accent); border-color:var(--accent); } .g-C { color:#b42318; border-color:#b42318; }
  .note { font-size:.9rem; color:var(--muted); }
</style>
</head>
<body>
<main>
  <h1>📋 선생님 모드 — 퀴즈 성적 종합 보고서</h1>
  <p class="muted">생성: ${esc(meta.generatedAt)} · 원본 파일 ${meta.files}개 · 플레이 기록 ${meta.entries}건${meta.demo ? " · ⚠ 시연용 가상 데이터 포함" : ""}</p>
  <div class="tiles">
    <div class="tile"><b>${students.length}명</b><span class="muted">학생</span></div>
    <div class="tile"><b>${cls.games}회</b><span class="muted">총 플레이</span></div>
    <div class="tile"><b>${cls.questions}</b><span class="muted">푼 문제</span></div>
    <div class="tile"><b>${pct(cls.accuracy)}</b><span class="muted">반 평균 정답률</span></div>
  </div>
  <h2>학생별 결과</h2>
  <div class="table-wrap"><table>
    <thead><tr><th>순위</th><th>이름</th><th>등급</th><th>플레이</th><th>푼 문제</th><th>정답률</th><th>최고 점수</th><th>학습 시간</th><th>힌트</th><th>약한 과목</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  <p class="note">등급은 <b>상대평가</b>입니다. 정답률 순위(같으면 최고 점수 순)로 상위 30% A, 다음 40% B, 나머지 C이며 같은 정답률은 같은 등급입니다. ${MIN_QUESTIONS}문제 미만으로 푼 학생은 '기록 부족'으로 표시합니다. 약한 과목은 2문제 이상 푼 과목 중 정답률이 가장 낮은 과목입니다.</p>
  <h2>반 전체 과목별 정답률</h2>
  <div class="card"><ul class="cats">${catRows}</ul></div>
  <h2>반 전체에서 자주 틀린 문제</h2>
  <div class="card"><ul class="missed">${missed}</ul></div>
</main>
</body>
</html>
`;
}

function renderCsv({ students }) {
  const header = ["순위", "이름", "등급", "플레이 수", "푼 문제", "정답 수", "정답률(%)", "최고 점수", "학습 시간(초)", "힌트 사용", "시간 초과", "약한 과목",
    ...KEYS.map(k => `${CATEGORIES[k].short} 정답률(%)`)];
  const cell = v => {
    const s = String(v ?? "");
    // 수식으로 해석될 수 있는 값(=, +, -, @로 시작)은 앞에 '를 붙여 엑셀 수식 주입을 막는다
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = [header, ...students.map(s => [
    s.rank ?? "", s.name, s.grade, s.games, s.questions, s.correct, Math.round(s.accuracy * 1000) / 10, s.bestScore, s.seconds, s.hints, s.timeouts, s.weakest,
    ...KEYS.map(k => (s.perCat[k] && s.perCat[k].total ? Math.round((s.perCat[k].correct / s.perCat[k].total) * 1000) / 10 : ""))
  ])].map(r => r.map(cell).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n"; // BOM: 엑셀에서 한글이 깨지지 않게
}

// ───── 시연용 가상 데이터 ─────
function demoData() {
  let seed = 20261117;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const students = [["데모학생01", 0.92], ["데모학생02", 0.85], ["데모학생03", 0.78], ["데모학생04", 0.72],
    ["데모학생05", 0.66], ["데모학생06", 0.6], ["데모학생07", 0.52], ["데모학생08", 0.45]];
  const history = [];
  const start = Date.UTC(2026, 10, 3);
  students.forEach(([name, skill], si) => {
    const games = 3 + Math.floor(rnd() * 3);
    for (let g = 0; g < games; g++) {
      const mode = g % 3 === 2 ? "speed" : "challenge";
      const qs = Core.pickQuestions(QUESTIONS, KEYS, 2, rnd);
      const perCat = {}, perDiff = {}, wrongIds = [];
      let correct = 0, score = 0, hints = 0, timeouts = 0;
      for (const q of qs) {
        const pc = perCat[q.category] || (perCat[q.category] = { total: 0, correct: 0 });
        const pd = perDiff[q.difficulty] || (perDiff[q.difficulty] = { total: 0, correct: 0 });
        pc.total++; pd.total++;
        const hinted = rnd() < 0.1;
        if (hinted) hints++;
        const ok = rnd() < skill - (q.difficulty - 1.5) * 0.12 + (hinted ? 0.2 : 0);
        if (ok) { correct++; pc.correct++; pd.correct++; }
        else { wrongIds.push(q.id); if (mode === "speed" && rnd() < 0.3) timeouts++; }
        score += Core.questionPoints({ correct: ok, hinted, speed: mode === "speed", remaining: 3 + rnd() * 10 });
      }
      const when = new Date(start + (si * 7 + g * 2) * 3600e3 * 6);
      history.push({
        id: `demo-${si + 1}-${g + 1}`, name, mode, category: null, count: qs.length, correct, score,
        seconds: 60 + Math.floor(rnd() * 120), hints, timeouts,
        date: when.toLocaleDateString("ko-KR"), playedAt: when.toISOString(), perCat, perDiff, wrongIds
      });
    }
  });
  return { app: "study03-quiz", version: 1, demo: true, exportedAt: new Date(start).toISOString(), profile: { name: "시연용 가상 학급" }, history };
}

// ───── 실행 ─────
function loadAll() {
  const c = collect();
  if (!c.entries.length) {
    console.error(`data/results/ 폴더에 읽을 수 있는 기록이 없습니다.\n- 퀴즈의 통계 화면에서 [기록 내보내기]로 받은 JSON을 이 폴더에 넣거나\n- 시연용 데이터가 필요하면 node tools/teacher.js demo 를 실행하세요.`);
    process.exit(1);
  }
  return c;
}
const meta = c => ({
  generatedAt: new Date().toLocaleString("ko-KR"), files: c.files.length, entries: c.entries.length,
  demo: c.entries.some(e => e.id.startsWith("demo-"))
});

const commands = {
  collect() {
    const c = collect();
    console.log(`파일 ${c.files.length}개 · 유효한 플레이 기록 ${c.entries.length}건`);
    c.skipped.forEach(s => console.log(`  건너뜀: ${s.file} (${s.reason})`));
    const names = [...new Set(c.entries.map(e => e.name))];
    console.log(`학생 ${names.length}명: ${names.join(", ") || "-"}`);
    if (!c.entries.length) process.exitCode = 1;
  },
  report() {
    const c = loadAll();
    fs.writeFileSync(REPORT_HTML, renderHtml(analyze(c.entries), meta(c)), "utf8");
    const { students } = analyze(c.entries);
    console.log(`보고서 생성: ${path.relative(ROOT, REPORT_HTML)}  (학생 ${students.length}명)`);
    students.forEach(s => console.log(`  ${String(s.rank ?? "-").padStart(2)}. ${s.name}  ${s.grade}  정답률 ${pct(s.accuracy)}  최고 ${s.bestScore}점  약한 과목: ${s.weakest}`));
  },
  csv() {
    const c = loadAll();
    fs.writeFileSync(REPORT_CSV, renderCsv(analyze(c.entries)), "utf8");
    console.log(`CSV 생성: ${path.relative(ROOT, REPORT_CSV)}`);
  },
  leaderboard(mode = "challenge", countArg = "10") {
    const c = loadAll();
    const list = leaderboard(c.entries, mode, Number(countArg));
    console.log(`리더보드 (${MODE_LABEL[mode] || mode} · ${countArg}문제, 학생별 최고 기록)`);
    if (!list.length) console.log("  해당 모드·문제 수의 기록이 없습니다.");
    list.slice(0, Core.RANK_LIMIT).forEach((e, i) => console.log(`  ${String(i + 1).padStart(2)}. ${e.name}  ${e.score}점  ${Core.formatTime(e.seconds)}  (${e.date})`));
  },
  all() { commands.collect(); commands.report(); commands.csv(); },
  demo() {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    const file = path.join(RESULTS_DIR, "demo-class.json");
    fs.writeFileSync(file, JSON.stringify(demoData(), null, 2), "utf8");
    console.log(`시연용 가상 데이터 생성: ${path.relative(ROOT, file)} (학생 8명, 실제 학생 기록 아님)`);
  }
};

if (require.main === module) {
  const [cmd, ...args] = process.argv.slice(2);
  if (!commands[cmd]) {
    console.log(fs.readFileSync(__filename, "utf8").split("*/")[0].replace(/^#!.*\n\/\*\n?/, "").replace(/^ \* ?/gm, ""));
    process.exit(cmd ? 2 : 0);
  }
  commands[cmd](...args);
}

module.exports = { collect, analyze, assignGrades, leaderboard, renderCsv, demoData };
