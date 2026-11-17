"""vision.py 테스트 — 네트워크는 쓰지 않는다(HTTP 호출은 가짜 세션으로 대체).

실행: python -m unittest discover -s tests -v   (Study-04 폴더에서)
"""
import base64
import io
import json
import sys
import unittest
from pathlib import Path

import requests
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import vision  # noqa: E402

FAKE_KEY = "sk-or-v1-TEST-ONLY-not-a-real-key"


def png_bytes(size=(4, 4)):
    buf = io.BytesIO()
    Image.new("RGB", size, (200, 30, 30)).save(buf, format="PNG")
    return buf.getvalue()


class FakeResponse:
    def __init__(self, status, body):
        self.status_code = status
        self._body = body

    def json(self):
        if isinstance(self._body, Exception):
            raise self._body
        return self._body


class FakeSession:
    """requests 대신 넘기는 가짜 세션. 받은 인자를 기록해 둔다."""

    def __init__(self, response=None, error=None):
        self.response, self.error, self.calls = response, error, []

    def post(self, url, **kwargs):
        self.calls.append((url, kwargs))
        if self.error:
            raise self.error
        return self.response


def ok_body(content):
    return {"choices": [{"message": {"role": "assistant", "content": content}}]}


CONFIG = vision.Config(api_key=FAKE_KEY, vision_model="google/gemma-3-27b-it", text_model="x")


class BuildRequestTest(unittest.TestCase):
    def test_model_url_and_data_url(self):
        data = png_bytes()
        url, headers, payload = vision.build_request(data, "image/png", "test/model", FAKE_KEY)
        self.assertEqual(url, "https://api.baze.co/v1/gateway/chat/completions/")
        self.assertEqual(payload["model"], "test/model")
        parts = payload["messages"][0]["content"]
        image_url = next(p for p in parts if p["type"] == "image_url")["image_url"]["url"]
        self.assertTrue(image_url.startswith("data:image/png;base64,"))
        self.assertEqual(base64.b64decode(image_url.split(",", 1)[1]), data)
        self.assertTrue(any(p["type"] == "text" and "JSON" in p["text"] for p in parts))

    def test_custom_base_url(self):
        url, _, _ = vision.build_request(png_bytes(), "image/png", "m", FAKE_KEY, "https://other.example/v1/gateway/")
        self.assertEqual(url, "https://other.example/v1/gateway/chat/completions/")

    def test_key_only_in_auth_header(self):
        _, headers, payload = vision.build_request(png_bytes(), "image/png", "m", FAKE_KEY)
        self.assertEqual(headers["Authorization"], f"Bearer {FAKE_KEY}")
        self.assertNotIn(FAKE_KEY, json.dumps(payload))
        for name, value in headers.items():
            if name != "Authorization":
                self.assertNotIn(FAKE_KEY, value)
            value.encode("latin-1")  # requests는 헤더를 latin-1로 보낸다(한글 금지)

    def test_config_repr_hides_key(self):
        self.assertNotIn(FAKE_KEY, repr(CONFIG))


class PrepareImageTest(unittest.TestCase):
    def test_small_image_unchanged(self):
        data = png_bytes()
        self.assertEqual(vision.prepare_image(data, "image/png"), (data, "image/png"))

    def test_large_image_downscaled(self):
        out, mime = vision.prepare_image(png_bytes((3000, 1000)), "image/png", max_side=500)
        self.assertEqual(mime, "image/jpeg")
        self.assertEqual(max(Image.open(io.BytesIO(out)).size), 500)

    def test_broken_image(self):
        with self.assertRaises(vision.VisionError):
            vision.prepare_image(b"not an image", "image/png")


class ParseTest(unittest.TestCase):
    def names(self, text):
        return [it["name"] for it in vision.parse_ingredients(text)]

    def test_plain_json(self):
        text = '{"ingredients": [{"name": "계란", "quantity": "6개", "state": "신선"}, {"name": "우유"}]}'
        items = vision.parse_ingredients(text)
        self.assertEqual(items[0], {"name": "계란", "quantity": "6개", "state": "신선"})
        self.assertEqual(items[1], {"name": "우유", "quantity": "", "state": ""})

    def test_json_in_fence_with_chatter(self):
        text = '사진을 분석했습니다.\n```json\n{"ingredients": [{"name": "당근"}, {"name": "양파"}]}\n```\n도움이 되길!'
        self.assertEqual(self.names(text), ["당근", "양파"])

    def test_json_list_of_strings(self):
        self.assertEqual(self.names('["김치", "두부"]'), ["김치", "두부"])

    def test_bullet_list_fallback(self):
        self.assertEqual(self.names("- 계란\n- 우유\n1. 치즈\n2) 대파"), ["계란", "우유", "치즈", "대파"])

    def test_comma_fallback(self):
        self.assertEqual(self.names("계란, 우유, 버터"), ["계란", "우유", "버터"])

    def test_dedupe_and_empty(self):
        text = '{"ingredients": [{"name": "계란"}, {"name": " 계 란 "}, {"name": ""}, {"name": "Milk"}, {"name": "milk"}]}'
        self.assertEqual(self.names(text), ["계란", "Milk"])

    def test_empty(self):
        self.assertEqual(vision.parse_ingredients('{"ingredients": []}'), [])
        self.assertEqual(vision.parse_ingredients(""), [])


class RecognizeTest(unittest.TestCase):
    def test_success(self):
        session = FakeSession(FakeResponse(200, ok_body('{"ingredients": [{"name": "사과"}]}')))
        items = vision.recognize_ingredients(png_bytes(), "image/png", CONFIG, session=session)
        self.assertEqual([it["name"] for it in items], ["사과"])
        url, kwargs = session.calls[0]
        self.assertEqual(kwargs["json"]["model"], CONFIG.vision_model)
        self.assertIn("timeout", kwargs)

    def test_content_as_parts(self):
        body = ok_body([{"type": "text", "text": '["배추"]'}])
        items = vision.recognize_ingredients(png_bytes(), "image/png", CONFIG, session=FakeSession(FakeResponse(200, body)))
        self.assertEqual(items[0]["name"], "배추")

    def test_missing_key(self):
        cfg = vision.Config(api_key="", vision_model="m", text_model="t")
        session = FakeSession(FakeResponse(200, ok_body("[]")))
        with self.assertRaises(vision.VisionError):
            vision.recognize_ingredients(png_bytes(), "image/png", cfg, session=session)
        self.assertEqual(session.calls, [])  # 키가 없으면 요청을 보내지 않는다

    def assert_error(self, session, expect):
        with self.assertRaises(vision.VisionError) as ctx:
            vision.recognize_ingredients(png_bytes(), "image/png", CONFIG, session=session)
        self.assertIn(expect, str(ctx.exception))
        self.assertNotIn(FAKE_KEY, str(ctx.exception))
        self.assertIsNone(ctx.exception.__cause__)  # 원래 예외(헤더 포함 가능)를 끌고 다니지 않는다

    def test_http_errors(self):
        for status, expect in [(401, "API 키"), (404, "VISION_MODEL"), (429, "한도"), (503, "서버")]:
            with self.subTest(status=status):
                self.assert_error(FakeSession(FakeResponse(status, {"error": {"code": status, "message": FAKE_KEY}})), expect)

    def test_error_inside_200(self):
        self.assert_error(FakeSession(FakeResponse(200, {"error": {"code": 429, "message": "rate"}})), "한도")

    def test_non_json_error_body(self):
        self.assert_error(FakeSession(FakeResponse(502, ValueError("html"))), "서버")

    def test_timeout_and_network(self):
        self.assert_error(FakeSession(error=requests.Timeout(f"Bearer {FAKE_KEY}")), "시간")
        self.assert_error(FakeSession(error=requests.ConnectionError(f"Bearer {FAKE_KEY}")), "연결")

    def test_bad_shape(self):
        self.assert_error(FakeSession(FakeResponse(200, {"choices": []})), "형식")


class LoadConfigTest(unittest.TestCase):
    def test_defaults_and_override(self):
        import os
        from unittest import mock

        missing = Path(__file__).with_name("no-such.env")
        with mock.patch.dict(os.environ, {"BAZE_API_KEY": " k ", "VISION_MODEL": "", "TEXT_MODEL": "a/b"}, clear=True):
            cfg = vision.load_config(missing)
        self.assertEqual(cfg.api_key, "k")
        self.assertEqual(cfg.vision_model, vision.DEFAULT_VISION_MODEL)
        self.assertEqual(cfg.text_model, "a/b")
        self.assertEqual(cfg.base_url, vision.DEFAULT_BASE_URL)

    def test_openrouter_key_is_not_used(self):
        import os
        from unittest import mock

        missing = Path(__file__).with_name("no-such.env")
        with mock.patch.dict(os.environ, {"OPENROUTER_API_KEY": "old", "BAZE_BASE_URL": "https://x.example/gw/"}, clear=True):
            cfg = vision.load_config(missing)
        self.assertEqual(cfg.api_key, "")
        self.assertEqual(cfg.base_url, "https://x.example/gw")

    def test_request_goes_to_configured_base_url(self):
        session = FakeSession(FakeResponse(200, ok_body('{"ingredients": []}')))
        cfg = vision.Config(api_key=FAKE_KEY, vision_model="m", text_model="t", base_url="https://x.example/gw")
        vision.recognize_ingredients(png_bytes(), "image/png", cfg, session=session)
        self.assertEqual(session.calls[0][0], "https://x.example/gw/chat/completions/")


if __name__ == "__main__":
    unittest.main()
