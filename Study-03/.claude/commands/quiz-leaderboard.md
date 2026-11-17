---
description: data/results/에 모은 플레이 기록으로 학생별 최고 점수 리더보드를 집계한다
argument-hint: "[모드: challenge|speed] [문제 수]  (기본: challenge 10)"
allowed-tools: Bash(node tools/teacher.js:*)
---

# 리더보드 집계

플레이어 점수는 각자의 브라우저(localStorage)에 저장되므로, 학생들이 퀴즈의 **통계 → 기록 내보내기**로 받은 JSON 파일을 `data/results/`에 모아야 집계할 수 있다.

1. `node tools/teacher.js collect` 로 읽을 수 있는 파일과 기록 수를 확인한다. 기록이 없으면 내보내기 방법을 안내하고 멈춘다(시연이 필요하면 `node tools/teacher.js demo`를 제안만 한다).
2. `node tools/teacher.js leaderboard $1 $2` 를 실행한다(인수가 없으면 도전 모드 10문제).
3. 스크립트 결과를 그대로 표로 보여 준다: `순위 | 이름 | 점수 | 시간 | 날짜`. 순위 기준은 앱 순위표와 같다(점수 높은 순, 같으면 시간 짧은 순, 학생별 최고 기록 하나).
4. 다른 모드·문제 수의 기록도 있으면 무엇이 있는지 한 줄로 알린다.
