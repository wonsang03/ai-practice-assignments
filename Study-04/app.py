"""냉장고를 부탁해 — 1단계 재료 인식 + 2단계 레시피 추천 (Streamlit)

실행: python -m streamlit run app.py
"""
import streamlit as st

from recipe import CUISINES, DIFFICULTIES, MAX_RECIPES, MAX_SERVINGS, RecipeOptions, RecipeParseError, generate_recipes
from recipe import clean_ingredients
from vision import VisionError, escape_markdown, load_config, recognize_ingredients

st.set_page_config(page_title="냉장고를 부탁해", page_icon=":material/kitchen:", layout="centered")

PAGE_SCAN = ":material/photo_camera: 재료 인식"
PAGE_RECIPE = ":material/restaurant_menu: 레시피 추천"

# 디자인용 CSS만 넣는다. 모델이 만든 글자는 절대 HTML로 넣지 않는다(escape_markdown 사용).
# .st-key-<key> 는 st.container(key=...)에 Streamlit이 붙여 주는 클래스다.
st.markdown(
    """
<style>
  .block-container { padding-top: 3.2rem; }
  .st-key-hero {
    padding: 1.3rem 1.5rem 1.1rem; border-radius: 1rem;
    background: linear-gradient(125deg, rgba(249,115,22,.14), rgba(244,63,94,.08) 55%, rgba(14,165,233,.08));
    border: 1px solid rgba(249,115,22,.22);
  }
  .st-key-hero h2 { padding: 0 0 .1rem; letter-spacing: -.02em; }
  .st-key-hero h2 span[role="img"] { color: #f97316; }
  [class*="st-key-empty"] { padding: 1.4rem .5rem 1rem; }
  [class*="st-key-empty"] [data-testid="stMarkdownContainer"] { text-align: center; }
  [class*="st-key-empty"] span[role="img"] {
    font-size: 2.4rem; color: #f97316; width: 4.2rem; height: 4.2rem; line-height: 4.2rem;
    border-radius: 50%; background: rgba(249,115,22,.10);
  }
  [class*="st-key-empty"] p { opacity: .75; }
  /* 소제목 아이콘은 주황색으로 통일 */
  [data-testid="stMarkdownContainer"] h4 span[role="img"] { color: #f97316; }
  [data-testid="stSidebar"] h3 span[role="img"] { color: #f97316; }
</style>
""",
    unsafe_allow_html=True,
)

config = load_config()
ss = st.session_state
ss.setdefault("nav", PAGE_SCAN)
# 위젯 기본값은 여기서 한 번만 정한다(위젯에 default까지 주면 Streamlit이 경고를 띄움).
# 다른 화면으로 갔다 와도 지워지지 않게 매번 다시 저장해 둔다(Streamlit은 안 그려진 위젯 값을 버림).
for _k, _default in (("opt_cuisine", "상관없음"), ("opt_diff", "쉬움"), ("opt_servings", 2), ("opt_count", 2)):
    ss[_k] = ss.get(_k, _default)
if "pantry" in ss:
    ss["pantry"] = ss["pantry"]


def go_to_recipes():
    """1단계 결과를 2단계 재료 목록으로 넘기고 레시피 화면으로 이동한다."""
    names = [it["name"] for it in ss.get("ingredients") or []]
    ss["pantry"] = clean_ingredients(ss.get("pantry", []) + names)
    ss["nav"] = PAGE_RECIPE


def hero(icon, title, subtitle, step):
    with st.container(key="hero"):
        st.markdown(f"## :material/{icon}: {title}")
        st.caption(subtitle)
        labels = [("looks_one", "재료 인식"), ("looks_two", "레시피 추천"), ("looks_3", "레시피 저장 · 예정")]
        with st.container(horizontal=True, gap="small"):
            for i, (ic, text) in enumerate(labels):
                st.badge(text, icon=f":material/{ic}:", color="orange" if i == step else "gray")


def empty_state(key, icon, text):
    with st.container(key=f"empty_{key}"):
        st.markdown(f":material/{icon}:")
        st.markdown(text)


def badges(names, color):
    if not names:
        st.caption("없음")
        return
    with st.container(horizontal=True, gap="small"):
        for n in names:
            st.badge(escape_markdown(n), color=color)


# ───── 사이드바 ─────
with st.sidebar:
    st.markdown("### :material/kitchen: 냉장고를 부탁해")
    st.caption("사진 한 장으로 재료를 찾고, 오늘 뭐 해 먹을지 추천받아요.")
    st.radio("메뉴", [PAGE_SCAN, PAGE_RECIPE], key="nav", label_visibility="collapsed")
    st.divider()
    counts = st.empty()  # 화면을 다 그린 뒤 채운다(이번 실행에서 생긴 결과까지 반영)
    with st.expander("연결 설정", icon=":material/settings:"):
        st.write("BAZE API 키:", "설정됨" if config.api_key else "없음")
        st.caption("이미지 인식 모델")
        st.code(config.vision_model, language=None)
        st.caption("레시피 생성 모델")
        st.code(config.text_model, language=None)
        st.caption(".env의 VISION_MODEL / TEXT_MODEL로 바꿀 수 있습니다.")

if not config.api_key:
    st.warning("BAZE API 키가 없습니다. `.env` 파일의 `BAZE_API_KEY=` 뒤에 키를 붙여 넣은 뒤 앱을 다시 실행해 주세요.",
               icon=":material/key_off:")


# ───── 1단계: 재료 인식 ─────
def page_scan():
    hero("kitchen", "냉장고를 부탁해", "냉장고 속 사진을 올리면 AI가 식재료를 찾아 줍니다.", 0)

    with st.container(border=True):
        st.markdown("#### :material/add_a_photo: 냉장고 사진")
        uploaded = st.file_uploader("냉장고 사진 (JPG · PNG · WEBP)", type=["jpg", "jpeg", "png", "webp"])
        if uploaded is not None:
            st.image(uploaded, width="stretch")
            # 다른 사진으로 바꾸면 이전 결과는 지운다
            if ss.get("photo") != uploaded.file_id:
                ss["photo"] = uploaded.file_id
                ss.pop("ingredients", None)
        start = st.button("재료 인식 시작", icon=":material/search:", type="primary", width="stretch",
                          disabled=uploaded is None or not config.api_key)

    if start and uploaded is not None:
        with st.spinner("AI가 사진을 살펴보는 중입니다... (보통 10초 안팎)"):
            try:
                ss["ingredients"] = recognize_ingredients(uploaded.getvalue(), uploaded.type or "image/jpeg", config)
            except VisionError as e:
                st.error(str(e), icon=":material/error:")

    with st.container(border=True):
        st.markdown("#### :material/nutrition: 인식한 재료")
        items = ss.get("ingredients")
        if items is None:
            empty_state("scan", "image_search", "사진을 올리고 **재료 인식 시작**을 눌러 주세요.")
        elif not items:
            st.info("사진에서 식재료를 찾지 못했습니다. 냉장고 안이 잘 보이는 사진으로 다시 시도해 주세요.", icon=":material/info:")
        else:
            st.success(f"재료 {len(items)}가지를 찾았습니다.", icon=":material/check_circle:")
            badges([it["name"] for it in items], "green")
            # 모델이 만든 글자는 마크다운으로 해석하지 않도록 표로 보여 준다
            st.dataframe([{"재료": it["name"], "양": it["quantity"], "상태": it["state"]} for it in items],
                         hide_index=True, width="stretch")
            st.caption("AI 인식 결과는 틀릴 수 있습니다. 다음 화면에서 재료를 고칠 수 있어요.")
            st.button("이 재료로 레시피 추천받기", icon=":material/arrow_forward:", type="primary", width="stretch",
                      on_click=go_to_recipes)


# ───── 2단계: 레시피 추천 ─────
def recipe_card(r, servings):
    with st.container(border=True):
        st.markdown(f"#### {escape_markdown(r['name'])}")
        if r["summary"]:
            st.caption(escape_markdown(r["summary"]))
        with st.container(horizontal=True, gap="small"):
            if r["minutes"]:
                st.badge(f"{r['minutes']}분", icon=":material/schedule:", color="blue")
            if r["difficulty"]:
                st.badge(r["difficulty"], icon=":material/signal_cellular_alt:", color="violet")
            st.badge(f"{servings}인분", icon=":material/group:", color="gray")
        st.markdown("**:material/check_circle: 가진 재료**")
        badges(r["have"], "green")
        st.markdown("**:material/shopping_cart: 추가로 필요**")
        badges(r["need"], "orange")
        st.markdown("**:material/format_list_numbered: 조리 순서**")
        for i, step in enumerate(r["steps"], 1):
            st.markdown(f"**{i}.** {escape_markdown(step)}")


def page_recipe():
    hero("restaurant_menu", "레시피 추천", "가진 재료 위주로, 부족한 재료는 최소한으로 쓰는 요리를 추천해 드려요.", 1)
    recognized = [it["name"] for it in ss.get("ingredients") or []]
    ss.setdefault("pantry", recognized)

    with st.container(border=True):
        st.markdown("#### :material/shopping_basket: 재료")
        pantry = st.multiselect(
            "재료", clean_ingredients(recognized + ss.get("pantry", [])), key="pantry",
            accept_new_options=True, placeholder="재료 이름을 입력하고 Enter", label_visibility="collapsed",
        )
        st.caption("✕로 빼고, 입력해서 추가하세요. 사진 없이 직접 입력해도 됩니다.")

    with st.container(border=True):
        st.markdown("#### :material/tune: 조건")
        cuisine = st.pills("요리 종류", CUISINES, required=True, key="opt_cuisine")
        difficulty = st.pills("난이도", DIFFICULTIES, required=True, key="opt_diff")
        count = st.pills("레시피 개수", list(range(1, MAX_RECIPES + 1)), required=True,
                         format_func=lambda n: f"{n}개", key="opt_count")
        servings = st.select_slider("인원", options=list(range(1, MAX_SERVINGS + 1)),
                                    format_func=lambda n: f"{n}명", key="opt_servings")

    go = st.button("레시피 추천받기", icon=":material/auto_awesome:", type="primary", width="stretch",
                   disabled=not clean_ingredients(pantry) or not config.api_key)

    if go:
        opts = RecipeOptions(cuisine or "상관없음", difficulty or "쉬움", servings, count or 2)
        with st.spinner("AI가 레시피를 고민하는 중입니다..."):
            try:
                ss["recipes"] = generate_recipes(pantry, opts, config)
                ss["recipe_servings"] = opts.normalized().servings
                ss.pop("recipe_raw", None)
            except RecipeParseError as e:
                ss["recipes"], ss["recipe_raw"] = [], e.raw
                st.error(str(e), icon=":material/error:")
            except VisionError as e:
                st.error(str(e), icon=":material/error:")

    recipes = ss.get("recipes")
    if ss.get("recipe_raw"):
        with st.expander("모델이 보낸 원문 보기", icon=":material/code:"):
            st.code(ss["recipe_raw"], language=None)
    if recipes:
        st.markdown(f"#### :material/menu_book: 추천 레시피 {len(recipes)}개")
        for r in recipes:
            recipe_card(r, ss.get("recipe_servings", servings))
        st.caption("AI가 만든 레시피입니다. 알레르기 재료와 익힘 정도는 직접 확인해 주세요.")
    elif recipes is None and not go:
        with st.container(border=True):
            empty_state("recipe", "skillet", "재료와 조건을 고르고 **레시피 추천받기**를 눌러 주세요.")


if ss["nav"] == PAGE_RECIPE:
    page_recipe()
else:
    page_scan()

counts.markdown(f":material/nutrition: 인식한 재료 **{len(ss.get('ingredients') or [])}**개  \n"
                f":material/menu_book: 추천 레시피 **{len(ss.get('recipes') or [])}**개")
