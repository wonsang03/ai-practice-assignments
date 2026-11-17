---
description: (선생님 모드 1단계) data/results/의 학생 결과 파일을 수집·검사한다
allowed-tools: Bash(node tools/teacher.js:*), Bash(ls:*)
---

# 결과 수집

1. `node tools/teacher.js collect` 를 실행한다.
2. 보고: 파일 수, 유효한 플레이 기록 수, 학생 이름 목록, 건너뛴 파일과 이유.
3. 기록이 0건이면 실패로 보고하고 멈춘다. 학생이 퀴즈의 **📊 통계 → ⬇️ 기록 내보내기**로 받은 `quiz-results-*.json` 파일을 `data/results/`에 넣으라고 안내한다. 시연이 필요하면 `node tools/teacher.js demo`(가상 학생 8명, 실제 기록 아님)를 쓸 수 있다고 알린다.
4. `demo-class.json`이 들어 있으면 "시연용 가상 데이터가 포함됨"이라고 반드시 밝힌다.
