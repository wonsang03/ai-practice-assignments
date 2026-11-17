---
description: 선생님 모드 통합 명령 — 결과 수집 → 상대평가 보고서 → CSV 내보내기를 순서대로 실행한다
allowed-tools: Bash(node tools/teacher.js:*), Bash(ls:*)
---

# 선생님 모드 대시보드

아래 명령어 파일의 지시를 **순서대로** 따른다. 한 단계가 실패하면 다음 단계로 가지 말고 멈춰서 보고한다.

1. `.claude/commands/collect-results.md` — 학생 결과 수집·검사
2. `.claude/commands/create-report.md` — 상대평가 등급과 `teacher_report.html` 생성
3. `.claude/commands/export-report.md` — `report_detailed.csv` 내보내기

## 마지막 보고
- 학생 수, 플레이 기록 수, 시연용 데이터 포함 여부
- 등급별 인원(A/B/C/기록 부족)과 상위 3명
- 반 전체 약한 과목, 자주 틀린 문제 1~3개
- 생성된 파일: `teacher_report.html`(브라우저로 열기), `report_detailed.csv`(엑셀로 열기)

각 기능은 위 명령어 파일과 `tools/teacher.js`에 나뉘어 있으므로, 등급 기준만 바꾸려면 `create-report.md`와 `GRADE_CUTS`만, 내보내기 형식만 바꾸려면 `export-report.md`와 `renderCsv`만 고친다.
