"""웹 손글씨 숫자 인식기 (Flask).

Created: 2025-09-15
브라우저 캔버스 페이지를 서비스하고, 데스크톱 버전과 완전히 같은 CNN·전처리
파이프라인을 재사용하는 JSON 예측 엔드포인트를 제공한다.

실행:
    python web_version/app.py
그다음 터미널에 찍힌 주소를 연다(기본값: http://localhost:5000).
"""

from __future__ import annotations

import argparse
import base64
import binascii
import io
import os
import sys
import threading
import webbrowser
from pathlib import Path

from flask import Flask, jsonify, render_template, request
from PIL import Image, UnidentifiedImageError

# web_version 폴더에서 이 파일을 직접 실행해도 동작하게 한다.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from common.model import MODEL_PATH, load_model  # noqa: E402
from common.preprocess import has_ink, predict_digit  # noqa: E402

app = Flask(__name__)

# 지나치게 큰 업로드는 거른다. 280x280 PNG 데이터 URL은 고작 몇 킬로바이트다.
app.config["MAX_CONTENT_LENGTH"] = 4 * 1024 * 1024

# 모델은 시작할 때 한 번만 읽고 모든 요청에서 재사용한다.
model = None


def get_model():
    """캐시된 모델을 돌려준다. 첫 호출 때만 실제로 읽는다."""
    global model
    if model is None:
        model = load_model()
    return model


def decode_data_url(data_url: str) -> Image.Image:
    """'data:image/png;base64,...' 문자열을 PIL 이미지로 바꾼다."""
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    raw = base64.b64decode(data_url)
    return Image.open(io.BytesIO(raw))


@app.route("/")
def index():
    """그리기 페이지를 렌더링한다."""
    return render_template("index.html")


@app.route("/predict", methods=["POST"])
def predict():
    """base64 PNG 데이터 URL로 받은 숫자를 인식한다."""
    payload = request.get_json(silent=True) or {}
    data_url = payload.get("image")

    if not data_url:
        return jsonify({"error": "No image was sent."}), 400

    try:
        image = decode_data_url(data_url)
    except (binascii.Error, ValueError, UnidentifiedImageError):
        return jsonify({"error": "The image could not be decoded."}), 400

    # 브라우저 캔버스는 그리지 않은 영역이 투명하다. 데스크톱 입력과 모양을
    # 맞추기 위해 흰 배경 위에 먼저 합성한다.
    if image.mode in ("RGBA", "LA", "P"):
        image = image.convert("RGBA")
        white = Image.new("RGBA", image.size, (255, 255, 255, 255))
        image = Image.alpha_composite(white, image)

    # 빈 캔버스도 그럴듯한 확신을 내놓는다. 숫자로 보고하지 않고 여기서 막는다.
    if not has_ink(image):
        return jsonify({"error": "The canvas is empty. Draw a digit first."}), 400

    try:
        digit, confidence, scores, processed = predict_digit(get_model(), image)
    except FileNotFoundError as error:
        return jsonify({"error": str(error)}), 503

    # 모델이 실제로 본 28x28 입력을 함께 돌려줘 화면에 보여 줄 수 있게 한다.
    buffer = io.BytesIO()
    processed.save(buffer, format="PNG")
    preview = base64.b64encode(buffer.getvalue()).decode("ascii")

    return jsonify(
        {
            "digit": digit,
            "confidence": round(confidence, 2),
            "scores": [round(value, 2) for value in scores],
            "preview": f"data:image/png;base64,{preview}",
        }
    )


@app.route("/health")
def health():
    """모델을 쓸 수 있는 상태인지 알려 주는 간단한 상태 엔드포인트."""
    return jsonify({"status": "ok", "model_ready": MODEL_PATH.exists()})


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the web digit recognizer.")
    parser.add_argument("--host", default="127.0.0.1", help="host to bind to")
    parser.add_argument("--port", type=int, default=5000, help="port to bind to")
    parser.add_argument("--debug", action="store_true", help="enable debug mode")
    parser.add_argument(
        "--open-browser",
        action="store_true",
        help="open the page in the default browser once the server is listening",
    )
    args = parser.parse_args()

    if not MODEL_PATH.exists():
        print(f"Trained model not found at '{MODEL_PATH}'.")
        print("Run 'python train_model.py' in the project root first.")
        sys.exit(1)

    # 첫 요청 때가 아니라 시작 시점에 바로 실패하도록 미리 읽어 둔다.
    get_model()

    print("=" * 58)
    print("  Handwritten Digit Recognition - Web Version")
    print(f"  Open http://localhost:{args.port} in your browser")
    print("  Press Ctrl+C to stop the server")
    print("=" * 58)

    # 브라우저는 실행 스크립트가 아니라 여기서 연다. 위의 모델 로딩에 몇 초가
    # 걸리는데, 그전에 열린 브라우저는 연결 거부 페이지를 보게 되기 때문이다.
    if args.open_browser and not os.environ.get("WERKZEUG_RUN_MAIN"):
        url = f"http://localhost:{args.port}"
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()

    app.run(host=args.host, port=args.port, debug=args.debug)


if __name__ == "__main__":
    main()
