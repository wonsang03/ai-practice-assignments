#!/usr/bin/env node
/*
 * 문제 은행 점검 도구. 커스텀 명령어(.claude/commands/*.md)가 이 스크립트를 실행해
 * 숫자를 직접 세지 않고 정확한 값을 얻는다. 설치 필요 없음.
 *
 *   node tools/quiz.js stats                    전체 통계 (과목·난이도·정답 위치 분포)
 *   node tools/quiz.js range <시작> <끝>         n~m번째 문제의 난이도 평균·편차와 정답 분포
 *   node tools/quiz.js superlatives [과목]       최상급 표현('가장', '최초' 등)이 들어간 문제
 *   node tools/quiz.js dupes                    문제 문장·코드가 같은 중복 문제 (있으면 종료 코드 1)
 *   node tools/quiz.js list [과목]               id·난이도·정답·문제 한 줄 목록
 *   node tools/quiz.js next-id <과목>            새 문제에 쓸 다음 id
 *   node tools/quiz.js backup                   js/questions.js를 backups/에 시간 붙여 복사
 *
 * [과목]은 키(design), 이름(소프트웨어 설계), 줄임말(설계), 과목 번호(1~5) 모두 됩니다.
 */
const fs = require("node:fs");
const path = require("node:path");
const { QUESTIONS, CATEGORIES, DIFFICULTIES } = require("../js/questions.js");
const Core = require("../js/quiz-core.js");

const ROOT = path.join(__dirname, "..");
const KEYS = Object.keys(CATEGORIES);
const PREFIX = { design: "d", develop: "v", database: "b", language: "p", system: "s" };
const BIAS_LIMIT = 0.4; // 한 보기 위치가 40%를 넘으면 편향으로 본다 (tests/run.js와 같은 기준)

function resolveCategory(arg) {
  if (!arg) return null;
  const a = String(arg).trim();
  if (/^[1-5]$/.test(a)) return KEYS[Number(a) - 1];
  const key = KEYS.find(k => k === a || CATEGORIES[k].name === a || CATEGORIES[k].short === a
    || CATEGORIES[k].name.replace(/\s/g, "") === a.replace(/\s/g, ""));
  if (!key) {
    console.error(`알 수 없는 과목: "${a}". 사용 가능: ${KEYS.map((k, i) => `${i + 1}=${k}(${CATEGORIES[k].name})`).join(", ")}`);
    process.exit(2);
  }
  return key;
}

const fmt = n => (Math.round(n * 100) / 100).toFixed(2);
const share = (c, total) => (total ? `${Math.round((c / total) * 100)}%` : "-");

function printDistribution(label, qs) {
  const d = Core.answerDistribution(qs);
  const max = Math.max(...d);
  const biased = qs.length >= 4 && max / qs.length > BIAS_LIMIT;
  console.log(`  ${label.padEnd(12)} 1번 ${d[0]} · 2번 ${d[1]} · 3번 ${d[2]} · 4번 ${d[3]}` +
    (biased ? `  ⚠ ${d.indexOf(max) + 1}번에 ${share(max, qs.length)} 몰림` : ""));
  return biased;
}

function printDifficulty(label, qs) {
  const s = Core.difficultyStats(qs);
  console.log(`  ${label.padEnd(12)} 평균 ${fmt(s.mean)} · 표준편차 ${fmt(s.std)} · ` +
    Object.keys(DIFFICULTIES).map(k => `${DIFFICULTIES[k]} ${s.counts[k] || 0}`).join(" · ") +
    (s.n < qs.length ? `  ⚠ 난이도 없는 문제 ${qs.length - s.n}개` : ""));
}

const commands = {
  stats() {
    console.log(`문제 은행: 총 ${QUESTIONS.length}문제\n`);
    console.log("과목별 문제 수");
    KEYS.forEach((k, i) => console.log(`  ${i + 1}과목 ${CATEGORIES[k].name}: ${QUESTIONS.filter(q => q.category === k).length}문제`));
    console.log("\n난이도 (1=초급, 2=중급, 3=상급)");
    printDifficulty("전체", QUESTIONS);
    KEYS.forEach(k => printDifficulty(CATEGORIES[k].short, QUESTIONS.filter(q => q.category === k)));
    console.log("\n정답 위치 분포 (데이터 기준. 게임에서는 보기를 섞어서 보여 줌)");
    let biased = printDistribution("전체", QUESTIONS);
    KEYS.forEach(k => { biased = printDistribution(CATEGORIES[k].short, QUESTIONS.filter(q => q.category === k)) || biased; });
    console.log("\n코드 출력 문제: " + QUESTIONS.filter(q => q.code).map(q => q.id).join(", "));
    const dupes = Core.findDuplicates(QUESTIONS);
    console.log("중복 문제: " + (dupes.length ? dupes.map(g => g.join("=")).join(", ") : "없음"));
    if (biased) console.log("\n⚠ 정답 위치 편향이 있습니다. 해당 과목 문제의 보기 순서를 조정하세요.");
  },

  range(startArg, endArg) {
    const start = Number(startArg), end = Number(endArg);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
      console.error("사용법: node tools/quiz.js range <시작> <끝>   (1부터, 예: range 1 20)");
      process.exit(2);
    }
    const qs = QUESTIONS.slice(start - 1, end);
    if (!qs.length) { console.error(`범위에 문제가 없습니다. 문제는 1~${QUESTIONS.length}번까지 있습니다.`); process.exit(2); }
    console.log(`${start}~${start + qs.length - 1}번 문제 (${qs.length}개${end > QUESTIONS.length ? `, 전체가 ${QUESTIONS.length}번까지라 잘림` : ""})\n`);
    qs.forEach((q, i) => console.log(`  ${String(start + i).padStart(3)}. ${q.id} [${DIFFICULTIES[q.difficulty] || "?"}] 정답 ${q.answer + 1}번  ${q.question.slice(0, 50)}`));
    console.log("\n난이도");
    printDifficulty("이 구간", qs);
    printDifficulty("전체", QUESTIONS);
    console.log("\n정답 위치 분포");
    printDistribution("이 구간", qs);
    // 같은 난이도가 연속으로 몰려 있는지 (5문제 이상 연속)
    let run = 1, warned = false;
    for (let i = 1; i <= qs.length; i++) {
      if (i < qs.length && qs[i].difficulty === qs[i - 1].difficulty) { run++; continue; }
      if (run >= 5) { console.log(`  ⚠ ${start + i - run}~${start + i - 1}번에 ${DIFFICULTIES[qs[i - 1].difficulty]} 문제가 ${run}개 연속`); warned = true; }
      run = 1;
    }
    if (!warned) console.log("  난이도가 한 구간에 연속으로 몰린 곳은 없습니다(5개 이상 연속 기준).");
  },

  superlatives(catArg) {
    const key = resolveCategory(catArg);
    const qs = key ? QUESTIONS.filter(q => q.category === key) : QUESTIONS;
    const found = Core.findSuperlatives(qs);
    console.log(`${key ? CATEGORIES[key].name : "전체"} ${qs.length}문제 중 최상급 표현 ${found.length}개 (찾은 단어: ${Core.SUPERLATIVES.join(", ")})\n`);
    found.forEach(f => {
      const q = QUESTIONS.find(x => x.id === f.id);
      console.log(`- ${f.id} [${f.words.join(", ")}] ${q.question}`);
      console.log(`    정답: ${q.choices[q.answer]}`);
      console.log(`    해설: ${q.explanation}`);
    });
  },

  dupes() {
    const groups = Core.findDuplicates(QUESTIONS);
    if (!groups.length) { console.log("중복 문제 없음"); return; }
    groups.forEach(g => console.log("중복: " + g.join(", ")));
    process.exitCode = 1;
  },

  list(catArg) {
    const key = resolveCategory(catArg);
    QUESTIONS.forEach((q, i) => {
      if (key && q.category !== key) return;
      console.log(`${String(i + 1).padStart(3)}. ${q.id} [${CATEGORIES[q.category].short}/${DIFFICULTIES[q.difficulty] || "?"}] 정답 ${q.answer + 1}번 · ${q.question}`);
    });
  },

  "next-id"(catArg) {
    const key = resolveCategory(catArg);
    if (!key) { console.error("과목을 지정하세요. 예: node tools/quiz.js next-id 데이터베이스"); process.exit(2); }
    const nums = QUESTIONS.filter(q => q.category === key).map(q => Number(q.id.slice(1)));
    console.log(`${PREFIX[key]}${String(Math.max(0, ...nums) + 1).padStart(2, "0")}`);
  },

  backup() {
    const src = path.join(ROOT, "js", "questions.js");
    const dir = path.join(ROOT, "backups");
    fs.mkdirSync(dir, { recursive: true });
    const d = new Date();
    const p = n => String(n).padStart(2, "0");
    const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    const dest = path.join(dir, `questions-${stamp}.js`);
    fs.copyFileSync(src, dest);
    console.log(`백업 완료: ${path.relative(ROOT, dest)} (${QUESTIONS.length}문제)`);
  }
};

const [cmd, ...args] = process.argv.slice(2);
if (!commands[cmd]) {
  console.log(fs.readFileSync(__filename, "utf8").split("*/")[0].replace(/^#!.*\n\/\*\n?/, "").replace(/^ \* ?/gm, ""));
  process.exit(cmd ? 2 : 0);
}
commands[cmd](...args);
