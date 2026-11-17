# 냉장고를 부탁해 (Study-04)

냉장고 사진을 올리면 식재료를 인식하고(1단계), 그 재료로 레시피를 추천하고(2단계), 레시피를 저장하는(3단계) Streamlit 앱.
AI 모델은 BAZE API 게이트웨이(OpenAI 호환, `https://api.baze.co/v1/gateway`)로 호출한다. 이미지 인식은 Gemma 4(`google/gemma-4-31B-it`), 레시피 생성은 GPT(`gpt-6-luna`, 가볍고 저렴한 모델).
(강의는 OpenRouter를 썼지만 사용자 요청으로 BAZE로 바꿨다. 이 앱의 API만 바꾼 것이고 Claude Code 설정과는 무관하다.)

## 구조

- `PRD_step1.md` ~ `PRD_step3.md` — 단계별 요구사항. 구현은 이 문서를 기준으로 하고, 끝나면 완료 기준 체크박스를 갱신한다.
- `vision.py` — 설정 읽기, BAZE 게이트웨이 호출(`chat`, 1·2단계 공용 오류 처리), 재료 인식, 답 해석, `escape_markdown`. 화면과 무관하며 테스트 대상.
- `recipe.py` — 2단계 레시피 요청 만들기와 답 검증(가진 재료가 아닌 것은 '추가'로 옮김). 테스트 대상.
- `app.py` — Streamlit 화면.
- `tests/test_vision.py`, `tests/test_recipe.py` — `python -m unittest discover -s tests -v`. HTTP 호출은 가짜 세션으로 대체하므로 네트워크·API 키 없이 돈다.

## 실행

```
pip install -r requirements.txt
python -m streamlit run app.py     # 또는 run.bat
```

## 규칙

- **API 키는 `.env`의 `BAZE_API_KEY`에서만 읽는다**(주소는 `BAZE_BASE_URL`, 키는 발급한 배포에서만 동작). 코드·테스트·문서에 실제 키를 쓰지 않고, 출력·로그·오류 메시지에 넣지 않는다.
- `.env`는 `.gitignore`에 있다. 새 설정이 생기면 `.env.example`에 빈 값으로 추가한다.
- 모델 ID는 하드코딩하지 않고 `.env`의 `VISION_MODEL` / `TEXT_MODEL`로 바꿀 수 있게 한다(조직·그룹마다 쓸 수 있는 모델이 다르다).
- 모델이 만든 글자는 `unsafe_allow_html`로 넣지 않는다. 표(`st.dataframe`)·코드(`st.code`)로 보여 주거나, 마크다운 위젯에 넣을 때는 반드시 `escape_markdown()`을 거친다. `unsafe_allow_html`은 고정된 디자인 CSS·문구에만 쓴다.
- 아이콘은 이모지 대신 Material 아이콘(`:material/이름:`)을 쓴다. 글꼴·색은 `.streamlit/config.toml`의 `[theme]`에서 정한다.
- 화면과 무관한 로직은 `app.py` 밖 모듈로 빼고 테스트를 붙인다. 테스트에서 실제 API를 호출하지 않는다.
- 요청마다 BAZE 크레딧이 쓰인다. 자동 재시도 루프를 만들지 않는다.
