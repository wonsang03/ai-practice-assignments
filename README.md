# 인공지능활용실습 과제

2026년 2학기 인공지능활용실습 과제 모음입니다. 과제마다 하위 폴더로 나뉘어 있고, 폴더마다 자세한 사용 설명서(README)가 있습니다.

| 폴더 | 내용 |
| --- | --- |
| [`Study-01/`](Study-01/) | 03. 손글씨 인식 프로그램 (MNIST, 데스크톱 + 웹) |
| [`Study-02/`](Study-02/) | 04. 개인용 할 일 관리 애플리케이션 (순수 HTML·CSS·JS) |
| [`Study-03/`](Study-03/) | 07~09. 정보처리기사 퀴즈 게임 (할루시네이션 검증 가이드라인, 스피드 모드·힌트, 통계·프로필, 커스텀 명령어·선생님 모드) |
| [`Study-04/`](Study-04/) | 11~12. 냉장고를 부탁해 — BAZE API 게이트웨이로 냉장고 사진 재료 인식 + 레시피 추천 (Streamlit, 1·2단계 구현 · 3단계 PRD) |

## 빠르게 실행해 보기

| 과제 | 준비 | 실행 방법 | 자세한 설명 |
| --- | --- | --- | --- |
| Study-01 손글씨 인식 | 파이썬 | `run_desktop.bat` 또는 `run_web.bat` 더블 클릭 (처음 한 번은 학습 때문에 몇 분 걸림) | [Study-01/README.md](Study-01/README.md) |
| Study-02 할 일 관리 | 없음 | `index.html` 더블 클릭 | [Study-02/README.md](Study-02/README.md) |
| Study-03 퀴즈 게임 | 없음 | `index.html` 더블 클릭 | [Study-03/README.md](Study-03/README.md) |
| Study-04 냉장고를 부탁해 | 파이썬 + BAZE API 키 | `pip install -r requirements.txt` 한 번 → `.env`에 키 입력 → `run.bat` 더블 클릭 | [Study-04/README.md](Study-04/README.md) |

- Study-04의 API 키는 `Study-04/.env`에만 넣습니다. 이 파일은 `.gitignore`에 들어 있어 GitHub에 올라가지 않습니다.
- 테스트는 폴더마다 있습니다: Study-03 `node tests/run.js`, Study-04 `python -m unittest discover -s tests -v`.
