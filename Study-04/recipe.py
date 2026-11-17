"""2단계: 인식한 재료로 레시피를 생성하는 로직 (화면과 무관, 테스트 대상)

BAZE 게이트웨이의 텍스트 모델(.env의 TEXT_MODEL)에 재료와 조건을 보내고,
JSON으로 받은 레시피를 검증·정리해서 돌려준다.
"""
import re
from dataclasses import dataclass

import requests

from vision import VisionError, _load_json, chat

CUISINES = ["상관없음", "한식", "양식", "중식", "일식"]
DIFFICULTIES = ["쉬움", "보통", "어려움"]
MAX_RECIPES = 3
MAX_SERVINGS = 4

SYSTEM_PROMPT = """당신은 집에 있는 재료로 만들 수 있는 요리를 추천하는 한국어 요리 도우미입니다.
규칙:
- 사용자가 가진 재료를 최대한 활용하고, 없는 재료는 최소한으로 씁니다.
- 소금·후추·식용유·간장·설탕 같은 기본 양념도 사용자 목록에 없으면 "need"에 넣습니다.
- 사용자가 가진 재료만 "have"에 넣고, 그 밖의 재료는 모두 "need"에 넣습니다.
- 재료는 사용자가 쓴 이름 그대로 앞에 쓰고, 양은 뒤에 붙입니다(예: "계란 2개", "대파 1/2대").
- 여러 개를 추천할 때는 요리명과 조리법이 서로 다른 요리를 고릅니다.
- 조리 순서는 실제로 따라 할 수 있게 구체적으로, 한 단계에 한 동작씩 씁니다.
- 반드시 아래 JSON 형식으로만 답하고, 다른 설명은 붙이지 않습니다.
{"recipes": [{"name": "요리명", "summary": "한 줄 소개", "ingredients": {"have": ["가진 재료"], "need": ["추가로 필요한 재료"]}, "steps": ["1단계 설명", "2단계 설명"], "minutes": 15, "difficulty": "쉬움|보통|어려움"}]}"""


class RecipeParseError(VisionError):
    """모델 답을 레시피로 해석하지 못함. 화면에서 원문을 접어서 보여 줄 수 있게 raw를 담는다."""

    def __init__(self, raw):
        super().__init__("레시피 형식을 이해하지 못했습니다. 다시 생성해 주세요.")
        self.raw = raw


@dataclass
class RecipeOptions:
    cuisine: str = "상관없음"
    difficulty: str = "쉬움"
    servings: int = 2
    count: int = 2

    def normalized(self):
        """범위를 벗어난 값을 기본값·한계값으로 맞춘다."""
        return RecipeOptions(
            cuisine=self.cuisine if self.cuisine in CUISINES else "상관없음",
            difficulty=self.difficulty if self.difficulty in DIFFICULTIES else "쉬움",
            servings=min(MAX_SERVINGS, max(1, int(self.servings))),
            count=min(MAX_RECIPES, max(1, int(self.count))),
        )


def _key(name):
    return str(name).replace(" ", "").lower()


_PAREN = re.compile(r"\(.*?\)|\[.*?\]")
_AMOUNT_WORDS = re.compile(r"\s+(약간|조금|적당량|적당히|소량|한\s?줌|한\s?꼬집|취향껏)$")


def _base_key(item):
    """'계란 2개', '대파(1/2대)', '소금 약간' → 재료 이름만 남긴 비교용 키."""
    s = _PAREN.sub(" ", str(item))
    s = re.split(r"\d", s, maxsplit=1)[0]  # 첫 숫자부터는 양으로 본다
    s = _AMOUNT_WORDS.sub("", s.strip())
    return _key(s) or _key(item)


def clean_ingredients(names):
    """빈 값·중복(띄어쓰기·대소문자 무시)을 뺀 재료 이름 목록."""
    seen, result = set(), []
    for n in names:
        n = str(n).strip()
        if n and _key(n) not in seen:
            seen.add(_key(n))
            result.append(n)
    return result


def build_messages(ingredients, options):
    opt = options.normalized()
    cuisine = "종류는 상관없음" if opt.cuisine == "상관없음" else f"{opt.cuisine} 요리"
    user = (
        f"가진 재료: {', '.join(ingredients)}\n"
        f"조건: {cuisine}, 난이도 {opt.difficulty}, {opt.servings}인분\n"
        f"서로 다른 레시피 {opt.count}개를 추천해 주세요."
    )
    return [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user}]


def build_payload(ingredients, options, model):
    return {"model": model, "messages": build_messages(ingredients, options), "temperature": 0.7}


def _as_list(value):
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    if isinstance(value, str) and value.strip():
        return [p.strip() for p in value.replace("\n", ",").split(",") if p.strip()]
    return []


def _minutes(value):
    try:
        m = int(round(float(str(value).replace("분", "").strip())))
    except (TypeError, ValueError):
        return None
    return m if 0 < m <= 24 * 60 else None


def parse_recipes(text, have, limit=MAX_RECIPES):
    """모델 답에서 레시피를 뽑는다. name이나 steps가 없는 레시피는 버리고,
    가진 재료 목록에 없는데 'have'로 적힌 재료는 'need'로 옮긴다. 하나도 못 뽑으면 RecipeParseError."""
    data = _load_json(text or "")
    if isinstance(data, dict):
        data = data.get("recipes", data.get("레시피"))
    if not isinstance(data, list):
        raise RecipeParseError(text or "")

    owned = {_key(h) for h in have}
    is_owned = lambda item: _base_key(item) in owned  # noqa: E731 — 양("2개")을 떼고 비교
    recipes, names_seen = [], set()
    for r in data:
        if not isinstance(r, dict):
            continue
        name = str(r.get("name") or "").strip()
        steps = _as_list(r.get("steps"))
        if not name or not steps or _key(name) in names_seen:  # 같은 요리가 두 번 오면 하나만
            continue
        names_seen.add(_key(name))
        ing = r.get("ingredients") if isinstance(r.get("ingredients"), dict) else {}
        listed = _as_list(ing.get("have")) + _as_list(ing.get("need"))
        # 모델이 어느 쪽에 적었든, 가진 재료 목록과 비교해서 다시 나눈다
        really_have = [i for i in listed if is_owned(i)]
        need = [i for i in listed if not is_owned(i)]
        need = clean_ingredients(need)
        difficulty = str(r.get("difficulty") or "").strip()
        recipes.append({
            "name": name,
            "summary": str(r.get("summary") or "").strip(),
            "have": clean_ingredients(really_have),
            "need": need,
            "steps": steps,
            "minutes": _minutes(r.get("minutes")),
            "difficulty": difficulty if difficulty in DIFFICULTIES else "",
        })
        if len(recipes) >= limit:
            break
    if not recipes:
        raise RecipeParseError(text or "")
    return recipes


def generate_recipes(ingredients, options, config, session=requests):
    """재료와 조건으로 레시피를 만든다. 실패하면 VisionError(또는 RecipeParseError)를 던진다."""
    names = clean_ingredients(ingredients)
    if not names:
        raise VisionError("재료를 하나 이상 입력해 주세요.")
    opt = options.normalized()
    text = chat(build_payload(names, opt, config.text_model), config, "TEXT_MODEL", session)
    return parse_recipes(text, names, limit=opt.count)
