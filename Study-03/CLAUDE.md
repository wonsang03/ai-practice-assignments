# 정보처리기사 퀴즈 (Study-03)

정보처리기사 필기 5과목을 4지선다로 풀어 보는 퀴즈 게임. 순수 HTML·CSS·JS, 빌드 없음.
`index.html`을 브라우저로 열면 실행된다.

## 구조

- `js/questions.js` — 문제 은행(`QUESTIONS`), 과목(`CATEGORIES`), 난이도(`DIFFICULTIES`: 1 초급·2 중급·3 상급). 문제 내용은 여기서만 고친다.
- `js/quiz-core.js` — 화면과 무관한 로직(문제 뽑기, 보기 섞기, 점수·힌트, 순위 정렬, 기록 통계, 중복·최상급 점검). 테스트 대상.
- `js/app.js` — 화면 처리와 localStorage 저장(순위표 `study03.ranking.v1`, 플레이 기록 `study03.history.v1`, 프로필 `study03.profile.v1`).
- `tools/quiz.js` — 문제 은행 점검 CLI(stats, range, superlatives, dupes, list, next-id, backup).
- `tools/teacher.js` — 선생님 모드 CLI. `data/results/*.json`(앱에서 내보낸 기록)으로 `teacher_report.html`, `report_detailed.csv`를 만든다.
- `tests/run.js` — `node tests/run.js`. 문제 데이터 형식과 로직, 선생님 모드를 검사한다.
- `.claude/commands/` — 커스텀 명령어(아래 표).

## 커스텀 명령어

숫자(개수·평균·분포)는 **반드시 `tools/` 스크립트 결과를 쓰고** 직접 세거나 추측하지 않는다.

| 명령어 | 하는 일 |
| --- | --- |
| `/quiz-validate [과목]` | 최상급 표현 검증 (가이드라인 2) |
| `/quiz-range <시작> <끝>` | 구간 난이도 평균·편차, 정답 위치 분포 |
| `/quiz-add <과목> <난이도>` | 가이드라인을 지켜 새 문제 추가 |
| `/quiz-check` | 전체 형식·중복 검사 + 정답 교차 검증 |
| `/quiz-stats` | 문제 은행 통계 |
| `/quiz-leaderboard [모드] [문제 수]` | `data/results/` 기록으로 리더보드 |
| `/quiz-daily [개수]` | 일일 업데이트(분포 확인 → 백업 → 추가 → 검증 → 리포트), 실패 시 즉시 중단 |
| `/teacher-dashboard` | 선생님 모드: `/collect-results` → `/create-report` → `/export-report` |

체이닝 예: `/quiz-add 데이터베이스 상급 && /quiz-check && /quiz-stats` — 앞 단계가 실패하면 뒤 단계는 실행하지 않는다.
명령어 하나의 동작만 바꿀 때는 해당 `.md` 파일(과 그것이 부르는 스크립트 함수)만 고친다.

## 규칙

- 사용자 입력과 문제 텍스트는 `textContent`로만 화면에 넣는다(`innerHTML` 금지).
- 문제를 추가·수정한 뒤에는 `node tests/run.js`를 반드시 실행한다.
- 새 문제에는 `difficulty`(1~3)를 꼭 넣는다. id는 `node tools/quiz.js next-id <과목>`으로 정한다.
- 학생이 내보낸 실제 결과 파일(`data/results/*.json`)은 개인 기록이므로 커밋하지 않는다(.gitignore). 시연용 `demo-class.json`은 가상 데이터임을 보고서에 표시한다.

## 문제 검증 가이드라인 (할루시네이션 방지) — 중요

문제와 정답을 새로 만들거나 고칠 때 **반드시** 아래를 지킨다.

1. **출처 없는 내용은 만들지 않는다.** 정보처리기사 출제기준(한국산업인력공단 Q-net)과 표준 교재·공식 문서에서 확인되는 내용만 쓴다. 기억에 의존해 단정하지 않는다.
2. **정답은 하나로 명확해야 한다.** 학자·교재마다 다르게 말하는 내용(예: 용어 번역, 분류 기준)은 문제 문장에 기준을 명시하거나 출제하지 않는다.
3. **"~이 아닌 것" 문제의 오답 보기도 검증한다.** 오답 보기가 실제로는 정답이 될 수 있는지 확인한다(예: 정렬의 최악 시간 복잡도 문제에 힙 정렬을 함께 넣으면 정답이 둘이 된다).
4. **코드 출력 문제는 실제로 실행해 확인한다.** 정의되지 않은 동작(`a++ + ++a` 등)은 쓰지 않는다. C·Java·Python 코드는 직접 돌려 본 결과를 정답으로 한다.
5. **해설에 근거를 적는다.** `explanation`에는 정답인 이유와 핵심 개념을 쓴다. 해설을 쓸 수 없는 문제는 출제하지 않는다.
6. **모르면 모른다고 한다.** 확신이 없는 문제는 넣지 않고, 사용자에게 확인을 요청한다.
7. 새 문제를 추가한 뒤에는 과목별로 정답 위치가 한쪽에 몰리지 않았는지 확인한다(게임에서 보기를 섞지만 데이터도 균형 있게).
