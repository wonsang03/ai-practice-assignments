"""전처리와 웹 API 테스트. 실행: python -m unittest discover -s tests -v (Study-01 폴더에서)

학습된 모델(model/mnist_cnn.pt)이 있어야 /predict 정상 경로를 검사한다.
"""

import base64
import io
import sys
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from common.model import MODEL_PATH  # noqa: E402
from common.preprocess import CANVAS_SIZE, has_ink, preprocess_image  # noqa: E402
from web_version.app import app  # noqa: E402


def blank(size=280):
    return Image.new("RGB", (size, size), "white")


def drawn_one():
    image = blank()
    ImageDraw.Draw(image).line([(140, 40), (140, 240)], fill="black", width=22)
    return image


def data_url(image):
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()


class PreprocessTest(unittest.TestCase):
    def test_blank_has_no_ink(self):
        self.assertFalse(has_ink(blank()))

    def test_drawing_has_ink(self):
        self.assertTrue(has_ink(drawn_one()))

    def test_output_is_28x28_white_on_black(self):
        out = preprocess_image(drawn_one())
        self.assertEqual(out.size, (CANVAS_SIZE, CANVAS_SIZE))
        self.assertEqual(out.getpixel((0, 0)), 0)
        self.assertGreater(out.getextrema()[1], 200)

    def test_blank_gives_empty_frame(self):
        self.assertEqual(preprocess_image(blank()).getextrema(), (0, 0))


class WebTest(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_index_page(self):
        self.assertEqual(self.client.get("/").status_code, 200)

    def test_health(self):
        body = self.client.get("/health").get_json()
        self.assertEqual(body["status"], "ok")

    def test_missing_image_is_400(self):
        self.assertEqual(self.client.post("/predict", json={}).status_code, 400)

    def test_bad_base64_is_400(self):
        response = self.client.post("/predict", json={"image": "data:image/png;base64,!!!"})
        self.assertEqual(response.status_code, 400)

    def test_blank_canvas_is_400(self):
        response = self.client.post("/predict", json={"image": data_url(blank())})
        self.assertEqual(response.status_code, 400)
        self.assertIn("empty", response.get_json()["error"])

    @unittest.skipUnless(MODEL_PATH.exists(), "학습된 모델이 없음")
    def test_predict_one(self):
        response = self.client.post("/predict", json={"image": data_url(drawn_one())})
        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["digit"], 1)
        self.assertEqual(len(body["scores"]), 10)
        self.assertAlmostEqual(sum(body["scores"]), 100, delta=0.5)
        self.assertTrue(body["preview"].startswith("data:image/png;base64,"))


if __name__ == "__main__":
    unittest.main()
