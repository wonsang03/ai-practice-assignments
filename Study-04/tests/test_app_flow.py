"""app.py 화면 흐름 테스트 — Streamlit AppTest로 브라우저 없이 실행한다. API는 호출하지 않는다.

실행: python -m unittest discover -s tests -v   (Study-04 폴더에서)
"""
import os
import unittest
from pathlib import Path
from unittest import mock

from streamlit.testing.v1 import AppTest

APP = str(Path(__file__).resolve().parents[1] / "app.py")
ENV = {"BAZE_API_KEY": "test-only-key", "VISION_MODEL": "v", "TEXT_MODEL": "t"}
RECOGNIZED = [
    {"name": "계란", "quantity": "6개", "state": "신선"},
    {"name": "대파", "quantity": "1대", "state": ""},
    {"name": "두부", "quantity": "", "state": ""},
]


def run_app(**state):
    at = AppTest.from_file(APP, default_timeout=30)
    for k, v in state.items():
        at.session_state[k] = v
    return at.run()


class HandoffTest(unittest.TestCase):
    """1단계에서 인식한 재료를 2단계 레시피 추천으로 넘길 수 있는지."""

    def setUp(self):
        patcher = mock.patch.dict(os.environ, ENV)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_recognized_ingredients_move_to_recipe_page(self):
        at = run_app(ingredients=RECOGNIZED)
        self.assertFalse(at.exception)
        go = next(b for b in at.button if b.label == "이 재료로 레시피 추천받기")
        at = go.click().run()
        self.assertFalse(at.exception)
        self.assertIn("레시피 추천", at.session_state["nav"])
        pantry = at.multiselect[0]
        self.assertEqual(pantry.value, ["계란", "대파", "두부"])
        rec = next(b for b in at.button if b.label == "레시피 추천받기")
        self.assertFalse(rec.disabled)

    def test_handoff_keeps_manually_added_ingredients(self):
        at = run_app(ingredients=RECOGNIZED, pantry=["버터"])
        at = next(b for b in at.button if b.label == "이 재료로 레시피 추천받기").click().run()
        self.assertEqual(at.multiselect[0].value, ["버터", "계란", "대파", "두부"])

    def test_recipe_page_without_photo_disables_button_until_ingredients(self):
        at = run_app(nav=":material/restaurant_menu: 레시피 추천")
        self.assertFalse(at.exception)
        rec = next(b for b in at.button if b.label == "레시피 추천받기")
        self.assertTrue(rec.disabled)  # F2-6: 재료가 없으면 비활성화
        at = at.multiselect[0].set_value(["감자"]).run()
        rec = next(b for b in at.button if b.label == "레시피 추천받기")
        self.assertFalse(rec.disabled)

    def test_ingredients_survive_page_switch(self):
        at = run_app(nav=":material/restaurant_menu: 레시피 추천")
        at = at.multiselect[0].set_value(["감자", "양파"]).run()
        at = at.radio[0].set_value(":material/photo_camera: 재료 인식").run()
        at = at.radio[0].set_value(":material/restaurant_menu: 레시피 추천").run()
        self.assertEqual(at.multiselect[0].value, ["감자", "양파"])
        self.assertEqual(len(at.warning), 0)  # 기본값·세션 값이 겹친다는 Streamlit 경고가 없어야 함


if __name__ == "__main__":
    unittest.main()
