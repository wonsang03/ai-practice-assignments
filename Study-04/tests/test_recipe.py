"""recipe.py(2단계) 테스트 — 네트워크는 쓰지 않는다.

실행: python -m unittest discover -s tests -v   (Study-04 폴더에서)
"""
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import recipe  # noqa: E402
import vision  # noqa: E402
from test_vision import FAKE_KEY, FakeResponse, FakeSession, ok_body  # noqa: E402

CONFIG = vision.Config(api_key=FAKE_KEY, vision_model="v", text_model="deepseek-v4.1-flash")

GOOD = {"recipes": [{
    "name": "대파 계란말이", "summary": "간단한 반찬",
    "ingredients": {"have": ["계란", "대파"], "need": ["소금"]},
    "steps": ["계란을 푼다", "대파를 썬다", "말아 가며 굽는다"], "minutes": 15, "difficulty": "쉬움",
}]}


def user_message(payload):
    return next(m["content"] for m in payload["messages"] if m["role"] == "user")


class PromptTest(unittest.TestCase):
    def test_edited_ingredients_go_into_request(self):
        """F2-2: 편집한 재료 목록(추가·삭제·중복 제거)이 그대로 요청에 들어간다."""
        session = FakeSession(FakeResponse(200, ok_body(json.dumps(GOOD))))
        edited = ["계란", "대파", " ", "계란 ", "두부"]  # 빈 값·중복은 빠져야 함
        recipe.generate_recipes(edited, recipe.RecipeOptions(), CONFIG, session=session)
        url, kwargs = session.calls[0]
        self.assertTrue(url.endswith("/chat/completions/"))
        payload = kwargs["json"]
        self.assertEqual(payload["model"], "deepseek-v4.1-flash")
        self.assertIn("가진 재료: 계란, 대파, 두부", user_message(payload))
        self.assertNotIn(FAKE_KEY, json.dumps(payload, ensure_ascii=False))

    def test_options_in_prompt(self):
        """F2-3: 종류·난이도·인원·개수가 프롬프트에 반영된다."""
        msg = user_message(recipe.build_payload(["계란"], recipe.RecipeOptions("일식", "보통", 3, 1), "m"))
        for part in ("일식 요리", "난이도 보통", "3인분", "레시피 1개"):
            self.assertIn(part, msg)
        any_cuisine = user_message(recipe.build_payload(["계란"], recipe.RecipeOptions("상관없음"), "m"))
        self.assertIn("종류는 상관없음", any_cuisine)

    def test_options_are_clamped(self):
        opt = recipe.RecipeOptions("프랑스식", "지옥", 99, 0).normalized()
        self.assertEqual((opt.cuisine, opt.difficulty, opt.servings, opt.count), ("상관없음", "쉬움", 4, 1))

    def test_system_prompt_asks_for_json_and_minimal_extra(self):
        """F2-4: 가진 재료 위주, 추가 재료는 따로 표시, JSON만."""
        system = recipe.build_messages(["계란"], recipe.RecipeOptions())[0]["content"]
        self.assertIn("최소한", system)
        self.assertIn('"need"', system)
        self.assertIn("JSON", system)


class ParseTest(unittest.TestCase):
    def test_plain_json(self):
        r = recipe.parse_recipes(json.dumps(GOOD, ensure_ascii=False), ["계란", "대파"])
        self.assertEqual(len(r), 1)
        self.assertEqual(r[0]["name"], "대파 계란말이")
        self.assertEqual(r[0]["have"], ["계란", "대파"])
        self.assertEqual(r[0]["need"], ["소금"])
        self.assertEqual(r[0]["minutes"], 15)
        self.assertEqual(len(r[0]["steps"]), 3)

    def test_fenced_json_with_chatter(self):
        text = "추천드릴게요!\n```json\n" + json.dumps(GOOD, ensure_ascii=False) + "\n```\n맛있게 드세요."
        self.assertEqual(recipe.parse_recipes(text, ["계란", "대파"])[0]["name"], "대파 계란말이")

    def test_broken_json_raises_with_raw(self):
        with self.assertRaises(recipe.RecipeParseError) as ctx:
            recipe.parse_recipes('{"recipes": [{"name": "계란', ["계란"])
        self.assertIn("계란", ctx.exception.raw)
        self.assertIn("다시 생성", str(ctx.exception))

    def test_not_owned_moves_to_need(self):
        """6장: 가지지 않은 재료를 '보유'로 적으면 '추가'로 옮긴다."""
        body = {"recipes": [{"name": "볶음밥", "steps": ["볶는다"],
                             "ingredients": {"have": ["밥", "햄", "계란"], "need": ["간장", "계란"]}}]}
        r = recipe.parse_recipes(json.dumps(body, ensure_ascii=False), ["밥", "계란"])[0]
        self.assertEqual(r["have"], ["밥", "계란"])
        self.assertEqual(r["need"], ["햄", "간장"])  # 가진 '계란'은 need에서도 빠짐

    def test_quantities_do_not_break_owned_check(self):
        """GPT가 '계란 2개'처럼 양을 붙여도 가진 재료로 인식한다(실제 응답에서 발견)."""
        body = {"recipes": [{"name": "두부계란국", "steps": ["끓인다"], "ingredients": {
            "have": [], "need": ["두부 1모", "계란 2개", "대파(1/2대)", "소금 약간", "양파 1/4개"]}}]}
        r = recipe.parse_recipes(json.dumps(body, ensure_ascii=False), ["계란", "대파", "두부", "파"])[0]
        self.assertEqual(r["have"], ["두부 1모", "계란 2개", "대파(1/2대)"])  # 양은 표시용으로 남김
        self.assertEqual(r["need"], ["소금 약간", "양파 1/4개"])  # '파'를 가졌다고 '양파'가 보유가 되진 않음

    def test_duplicate_recipe_names_are_dropped(self):
        same = {"name": "두부 계란국", "steps": ["a"]}
        body = {"recipes": [same, {**same, "name": "두부계란국"}, {"name": "계란말이", "steps": ["b"]}]}
        r = recipe.parse_recipes(json.dumps(body, ensure_ascii=False), [])
        self.assertEqual([x["name"] for x in r], ["두부 계란국", "계란말이"])

    def test_drops_recipes_without_name_or_steps(self):
        body = {"recipes": [{"name": "", "steps": ["a"]}, {"name": "빈 순서", "steps": []}, {"name": "좋음", "steps": "썬다, 굽는다"}]}
        r = recipe.parse_recipes(json.dumps(body, ensure_ascii=False), [])
        self.assertEqual([x["name"] for x in r], ["좋음"])
        self.assertEqual(r[0]["steps"], ["썬다", "굽는다"])

    def test_all_invalid_raises(self):
        with self.assertRaises(recipe.RecipeParseError):
            recipe.parse_recipes(json.dumps({"recipes": [{"name": "x"}]}), [])

    def test_limit_and_field_cleanup(self):
        many = {"recipes": [{"name": f"요리{i}", "steps": ["a"], "minutes": "20분", "difficulty": "초고수"} for i in range(5)]}
        r = recipe.parse_recipes(json.dumps(many, ensure_ascii=False), [], limit=2)
        self.assertEqual(len(r), 2)
        self.assertEqual(r[0]["minutes"], 20)
        self.assertEqual(r[0]["difficulty"], "")  # 정해진 값이 아니면 비움


class GenerateErrorTest(unittest.TestCase):
    def test_no_ingredients(self):
        session = FakeSession(FakeResponse(200, ok_body("{}")))
        with self.assertRaises(vision.VisionError):
            recipe.generate_recipes([" ", ""], recipe.RecipeOptions(), CONFIG, session=session)
        self.assertEqual(session.calls, [])  # 요청을 보내지 않음

    def test_404_points_to_text_model(self):
        session = FakeSession(FakeResponse(404, {"error": {"message": "no model"}}))
        with self.assertRaises(vision.VisionError) as ctx:
            recipe.generate_recipes(["계란"], recipe.RecipeOptions(), CONFIG, session=session)
        self.assertIn("TEXT_MODEL", str(ctx.exception))
        self.assertNotIn(FAKE_KEY, str(ctx.exception))


class EscapeMarkdownTest(unittest.TestCase):
    def test_markdown_is_not_interpreted(self):
        out = vision.escape_markdown("**굵게** [링크](http://x) $1 :red[빨강] a_b")
        for raw in ("**", "](", ":red[", "a_b"):
            self.assertNotIn(raw, out)
        for escaped in (r"\*\*굵게\*\*", r"\$1", r"\:red\[", r"a\_b"):
            self.assertIn(escaped, out)


if __name__ == "__main__":
    unittest.main()
