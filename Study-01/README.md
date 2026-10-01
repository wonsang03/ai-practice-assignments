# 손글씨 인식 프로그램 (MNIST Digit Recognition)

마우스로 그린 0~9 숫자를 CNN이 인식하는 프로그램입니다.
**데스크톱 버전(Tkinter)** 과 **웹 버전(Flask)** 두 가지로 만들었고, 두 버전은
같은 모델과 같은 전처리 코드를 공유합니다.

> 인공지능활용실습 — 03. 손글씨 인식 프로그램 만들기 (2025-09-15)

## 빠른 실행

윈도우 탐색기에서 아래 파일을 **더블 클릭**하면 됩니다.

| 파일 | 하는 일 |
| --- | --- |
| `run_desktop.bat` | 모델이 없으면 학습한 뒤 데스크톱 창을 띄웁니다 |
| `run_web.bat` | 모델이 없으면 학습한 뒤 브라우저에서 웹 버전을 엽니다 |

최초 1회는 MNIST 데이터(약 55MB)를 내려받고 모델을 학습하므로 몇 분 걸립니다.
두 번째 실행부터는 저장된 모델을 바로 불러와 즉시 실행됩니다.

## 터미널로 실행하기

```bash
cd Study-01                                   # 0. 프로젝트 폴더로 이동
pip install -r requirements.txt               # 1. 라이브러리 설치
python train_model.py                         # 2. 모델 학습
python desktop_version/digit_recognition.py   # 3-1. 데스크톱 버전
python web_version/app.py                     # 3-2. 웹 버전 (localhost:5000)
```

학습 옵션:

```bash
python train_model.py --epochs 8    # 더 오래 학습 (정확도 소폭 상승)
python train_model.py --force       # 기존 모델을 무시하고 다시 학습
```

## 사용법

1. 흰색 상자 안에 마우스로 숫자 하나를 그립니다.
2. **[Recognize]** 버튼을 누르면 인식 결과와 신뢰도가 나옵니다.
3. **[Clear]** 버튼으로 지우고 다시 그립니다.
4. 단축키: `Enter` = 인식, `Esc` = 지우기

잘 인식되게 그리는 요령: 상자 가운데에, 크게, 선이 끊기지 않게 그립니다.

## 프로젝트 구조

```
Study-01/
├── CLAUDE.md                  # 프로젝트 공통 규칙 (클로드 코드 설정 파일)
├── README.md
├── requirements.txt           # 필요한 라이브러리 목록
├── train_model.py             # MNIST 학습 스크립트
├── run_desktop.bat            # 데스크톱 버전 실행 (더블 클릭)
├── run_web.bat                # 웹 버전 실행 (더블 클릭)
│
├── common/                    # 두 버전이 공유하는 코드
│   ├── model.py               #   CNN 정의 + 모델 불러오기
│   └── preprocess.py          #   그림 -> 28x28 변환 + 추론
│
├── desktop_version/           # 데스크톱 버전
│   ├── CLAUDE.md              #   데스크톱 전용 규칙
│   └── digit_recognition.py   #   Tkinter GUI
│
├── web_version/               # 웹 버전
│   ├── CLAUDE.md              #   웹 전용 규칙
│   ├── app.py                 #   Flask 서버
│   ├── templates/index.html
│   └── static/css, static/js
│
├── logs/                      # 학습 기록
│   ├── analyze_log.py         #   로그 분석 스크립트
│   ├── train_2026-09-17.log   #   학습 실행 기록
│   └── analysis_2026-09-17.md #   분석 결과
│
├── model/                     # 학습된 가중치 (실행 시 생성)
└── data/                      # MNIST 원본 (최초 실행 시 자동 다운로드)
```

`model/`과 `data/`는 용량이 크고 다시 만들 수 있으므로 깃에 올리지 않습니다
(`.gitignore`). 내려받은 뒤 `run_desktop.bat`을 한 번 실행하면 자동 생성됩니다.

## 파일 출처 — 무엇을 어디서 가져왔나

| 대상 | 출처 | 어떻게 들어오나 |
| --- | --- | --- |
| MNIST 데이터 (`data/MNIST/`) | Yann LeCun 등이 공개한 MNIST 데이터베이스 (<http://yann.lecun.com/exdb/mnist/>), torchvision이 관리하는 미러에서 배포 | `train_model.py`의 `datasets.MNIST(..., download=True)`가 최초 실행 시 자동으로 내려받습니다 (약 55MB). 직접 받아 넣은 파일이 아닙니다. |
| 학습된 가중치 (`model/mnist_cnn.pt`) | 이 저장소에서 직접 학습 | `python train_model.py`가 학습을 마치고 `torch.save()`로 만듭니다. 외부에서 받은 사전학습 모델이 아닙니다. |
| 학습 기록 (`logs/train_*.log`) | 위 학습 실행의 콘솔 출력 | 학습을 돌린 터미널 출력을 그대로 옮기고 실행 환경 정보를 덧붙였습니다. |
| 분석 결과 (`logs/analysis_*.md`) | `logs/analyze_log.py`의 출력 | `python logs/analyze_log.py --out logs/analysis_<날짜>.md` |
| 라이브러리 (torch, torchvision, Pillow, numpy, flask) | PyPI | `pip install -r requirements.txt` |
| Tkinter | Python 표준 라이브러리 | 파이썬 설치에 포함 (별도 설치 없음) |
| 소스 코드 (`common/`, `desktop_version/`, `web_version/`, `train_model.py`) | 직접 작성 | 복사해 온 외부 코드는 없습니다. 모델 구조는 표준적인 2블록 CNN을 참고해 구현했습니다. |

정리하면 **외부에서 들어오는 것은 MNIST 데이터와 pip 라이브러리뿐**이고,
모델 가중치와 코드는 모두 이 저장소 안에서 만들어집니다.

## 어떻게 동작하나

### 1. 데이터 — MNIST

0~9 손글씨 숫자 이미지 7만 장(28x28 흑백). 1998년 공개된 이후 컴퓨터 비전의
표준 데이터세트로 쓰입니다. 학습 6만 장, 테스트 1만 장으로 나눠 씁니다.

### 2. 모델 — CNN

합성곱 블록 2개(32채널 → 64채널) + 완전연결층 2개로 구성했습니다.
배치 정규화와 드롭아웃으로 과적합을 줄였습니다.

**테스트 정확도 99.15%** (3 에폭, CPU 기준 약 2분 30초 / 2026-09-17 재학습 기준)

학습할 때는 이미지에 약간의 회전·이동·확대 변형을 무작위로 줍니다. 마우스로 그린
글씨는 MNIST 원본보다 거칠기 때문에, 변형을 섞어 학습해야 실제 입력에 잘
견딥니다.

학습 과정은 `logs/train_2026-09-17.log`에 남겨 두었고, 에폭별 손실·정확도 변화를
정리한 분석은 `logs/analysis_2026-09-17.md`에 있습니다. 다시 학습한 뒤에는

```bash
python logs/analyze_log.py --out logs/analysis_<날짜>.md
```

로 같은 형식의 분석을 새로 만들 수 있습니다.

### 3. 전처리 — 이 부분이 정확도를 좌우합니다

MNIST 숫자들은 단순히 28x28로 줄인 그림이 아닙니다. **20x20 안에 들어가게
크기를 맞추고, 무게중심을 28x28의 중앙에 놓은** 결과물입니다. 사용자가 그린
그림에도 같은 과정을 적용해야 학습 데이터와 모양이 맞습니다.

1. 흰 배경·검은 글씨 → 검은 배경·흰 글씨로 반전
2. 글씨가 있는 영역만 잘라내기
3. 긴 변을 20px에 맞춰 비율 유지하며 축소
4. 무게중심을 계산해 28x28 중앙에 배치
5. MNIST 평균/표준편차로 정규화

웹 버전에서는 모델이 실제로 본 28x28 이미지를 화면에 함께 보여 줍니다.

## 기술 스택

- Python 3.10 이상 (3.13에서 검증)
- PyTorch / torchvision — 모델 학습
- Pillow / NumPy — 이미지 전처리
- Tkinter — 데스크톱 GUI (표준 라이브러리)
- Flask — 웹 서버

## 문제가 생기면

| 증상 | 해결 |
| --- | --- |
| `Python was not found` | 파이썬 설치 시 "Add python.exe to PATH" 체크 |
| `No module named torch` | `pip install -r requirements.txt` 실행 |
| `Model not found` | `python train_model.py` 실행 (또는 .bat 사용) |
| 웹 포트 충돌 | `python web_version/app.py --port 8080` |
| 인식이 자꾸 틀림 | 상자 가운데에 크고 굵게 그리기 |

## 한계

- 한 번에 숫자 **한 글자만** 인식합니다.
- 알파벳·한글은 인식하지 않습니다(MNIST에 없는 데이터).
- 웹 버전은 개발용 서버이며 외부 공개용이 아닙니다.
