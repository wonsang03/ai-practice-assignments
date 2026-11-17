---
description: (선생님 모드 2단계) 학생별 성적을 분석하고 상대평가 등급을 매겨 teacher_report.html을 만든다
allowed-tools: Bash(node tools/teacher.js:*)
---

# 보고서 생성

1. `node tools/teacher.js report` 를 실행해 `teacher_report.html`을 만든다.
2. 등급은 **상대평가**다(`tools/teacher.js`의 `GRADE_CUTS`).
   - 정답률 순위(같으면 최고 점수 순)의 백분위로 상위 30% A, 다음 40% B, 나머지 C.
   - 같은 정답률·최고 점수는 같은 순위·등급.
   - 10문제(`MIN_QUESTIONS`) 미만으로 푼 학생은 "기록 부족".
   - 등급 기준을 바꾸려면 이 두 상수만 고치고 `node tests/run.js`로 확인한다.
3. 스크립트가 출력한 학생 목록을 표로 정리한다: `순위 | 이름 | 등급 | 정답률 | 최고 점수 | 약한 과목`.
4. 반 전체에서 정답률이 가장 낮은 과목과 자주 틀린 문제를 보고서에서 읽어 한두 줄로 요약하고, 지도 방향을 짧게 제안한다.
