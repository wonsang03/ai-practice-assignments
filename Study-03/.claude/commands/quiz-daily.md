---
description: 일일 업데이트 — 구조 파악, 분포·결손 확인, 중복 체크, 새 문제 추가·검증, 백업, 리포트를 한 번에 진행한다
argument-hint: "[추가할 문제 수 — 기본 1]"
allowed-tools: Bash(node tools/quiz.js:*), Bash(node tests/run.js), Bash(python:*), Bash(gcc:*), Bash(javac:*), Bash(java:*), Read, Edit
---

# 일일 업데이트

추가할 문제 수: **$ARGUMENTS** (비어 있으면 1문제, 한 번에 최대 3문제)

각 단계가 실패하면 **즉시 멈추고** 어느 단계에서 왜 실패했는지 보고한다. 다음 단계로 넘어가지 않는다.

1. **구조 파악** — `CLAUDE.md`(검증 가이드라인 포함)를 읽고, `js/questions.js`의 문제 형식(id, category, difficulty, question, choices, answer, explanation, code)을 확인한다.
2. **문항 수·분포 확인** — `node tools/quiz.js stats`.
3. **결손 파악** — 2의 결과에서 문항 수가 가장 적은 과목, 그 과목에서 부족한 난이도, 가장 적게 쓰인 정답 위치를 고른다. 고른 이유를 한 줄로 적는다.
4. **추가 전 백업** — `node tools/quiz.js backup`. 실패하면 문제를 추가하지 않는다.
5. **중복 체크** — `node tools/quiz.js list <과목>` 으로 기존 문제를 보고 겹치지 않는 주제를 정한다.
6. **새 문제 생성 후 검증** — `/quiz-add`의 규칙(템플릿, 가이드라인 1~7, 코드 문제는 실제 실행)대로 3에서 정한 과목·난이도로 작성해 추가한다. 그다음 `node tests/run.js` 와 `node tools/quiz.js dupes` 가 모두 통과해야 한다. 실패하면 4의 백업 파일 경로를 알려 주고 멈춘다.
7. **결과 리포트** — 다음을 출력한다.
   - 추가한 문제(id, 과목, 난이도, 문제, 정답, 근거)
   - 추가 전후 문항 수와 분포 변화(`node tools/quiz.js stats` 다시 실행)
   - 테스트 결과, 백업 파일 경로

확신이 없는 내용은 만들지 않는다. 새 문제를 하나도 확신할 수 없으면 "오늘은 추가하지 않음"으로 보고한다.
