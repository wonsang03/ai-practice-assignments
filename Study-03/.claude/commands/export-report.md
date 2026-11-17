---
description: (선생님 모드 3단계) 보고서 데이터를 엑셀에서 열 수 있는 report_detailed.csv로 내보낸다
allowed-tools: Bash(node tools/teacher.js:*)
---

# 보고서 내보내기 (CSV)

1. `node tools/teacher.js csv` 를 실행해 `report_detailed.csv`를 만든다.
   - 열: 순위, 이름, 등급, 플레이 수, 푼 문제, 정답 수, 정답률(%), 최고 점수, 학습 시간(초), 힌트 사용, 시간 초과, 약한 과목, 과목별 정답률(%).
   - UTF-8 BOM이 붙어 있어 엑셀에서 더블 클릭해도 한글이 깨지지 않는다.
   - `=`, `+`, `-`, `@`로 시작하는 값은 앞에 `'`를 붙여 엑셀 수식으로 실행되지 않게 한다.
2. 생성된 파일 경로와 행 수(학생 수)를 보고한다.
3. PDF가 필요하면 `teacher_report.html`을 브라우저로 열고 인쇄 → "PDF로 저장"을 쓰도록 안내한다.
