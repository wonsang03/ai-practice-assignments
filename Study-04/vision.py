"""냉장고 사진에서 식재료를 인식하는 로직 (화면과 무관, 테스트 대상)

BAZE API 게이트웨이의 OpenAI 호환 chat completions API에 이미지를 base64 data URL로 보내고,
모델이 돌려준 답에서 재료 목록을 뽑아낸다.
API 키는 .env에서만 읽고, 오류 메시지·로그에 절대 넣지 않는다.
"""
import base64
import io
import json
import os
import re
from dataclasses import dataclass
from pathlib import Path

import requests
from dotenv import load_dotenv

# BAZE 게이트웨이 (https://docs.factchat.kr). 키는 발급한 배포(호스트)에서만 동작하므로 주소도 .env로 바꿀 수 있게 둔다.
DEFAULT_BASE_URL = "https://api.baze.co/v1/gateway"
CHAT_PATH = "/chat/completions/"
DEFAULT_VISION_MODEL = "google/gemma-4-31B-it"
DEFAULT_TEXT_MODEL = "gpt-6-luna"
TIMEOUT_SECONDS = 60
MAX_SIDE = 1568  # 이보다 큰 사진은 줄여서 보낸다(전송량·처리 시간 절약)

PROMPT = """이 사진은 냉장고 내부 사진입니다. 사진에 보이는 식재료를 모두 찾아 주세요.
반드시 아래 JSON 형식으로만 답하고, 다른 설명은 붙이지 마세요.
{"ingredients": [{"name": "재료 이름(한국어)", "quantity": "대략적인 양(모르면 빈 문자열)", "state": "상태(모르면 빈 문자열)"}]}
확실히 보이지 않는 재료는 넣지 마세요. 식재료가 하나도 없으면 {"ingredients": []}로 답하세요."""


class VisionError(Exception):
    """사용자에게 그대로 보여 줘도 되는 오류 (API 키를 포함하지 않는다)."""


@dataclass
class Config:
    api_key: str
    vision_model: str
    text_model: str
    base_url: str = DEFAULT_BASE_URL

    def __repr__(self):  # 실수로 출력해도 키가 드러나지 않게
        return (f"Config(api_key={'설정됨' if self.api_key else '없음'}, vision_model={self.vision_model!r}, "
                f"text_model={self.text_model!r}, base_url={self.base_url!r})")


def load_config(env_path=None):
    """Study-04/.env를 읽어 설정을 만든다. 이미 있는 환경 변수가 우선한다."""
    load_dotenv(env_path or Path(__file__).with_name(".env"), override=False)
    return Config(
        api_key=os.getenv("BAZE_API_KEY", "").strip(),
        vision_model=os.getenv("VISION_MODEL", "").strip() or DEFAULT_VISION_MODEL,
        text_model=os.getenv("TEXT_MODEL", "").strip() or DEFAULT_TEXT_MODEL,
        base_url=(os.getenv("BAZE_BASE_URL", "").strip() or DEFAULT_BASE_URL).rstrip("/"),
    )


# ───── 이미지 준비 ─────
def prepare_image(data, mime, max_side=MAX_SIDE):
    """긴 변이 max_side보다 크면 JPEG로 줄인다. (bytes, mime)을 돌려준다."""
    from PIL import Image

    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except Exception as e:
        raise VisionError("이미지 파일을 열 수 없습니다. JPG·PNG·WEBP 사진인지 확인해 주세요.") from e
    if max(img.size) <= max_side:
        return data, mime
    img.thumbnail((max_side, max_side))
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="JPEG", quality=85)
    return buf.getvalue(), "image/jpeg"


def to_data_url(data, mime):
    return f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}"


# ───── 요청 만들기 ─────
def build_request(image_bytes, mime, model, api_key, base_url=DEFAULT_BASE_URL):
    """(url, headers, payload)를 돌려준다. 네트워크는 쓰지 않는다."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": PROMPT},
                {"type": "image_url", "image_url": {"url": to_data_url(image_bytes, mime)}},
            ],
        }],
        "temperature": 0.2,
    }
    return base_url.rstrip("/") + CHAT_PATH, headers, payload


# ───── 답 해석 ─────
_FENCE = re.compile(r"```(?:json)?\s*(.*?)```", re.S | re.I)
_BULLET = re.compile(r"^\s*(?:[-*•·]|\d+[.)])\s*")


def _load_json(text):
    candidates = [m.group(1) for m in _FENCE.finditer(text)] + [text]
    for c in candidates:
        c = c.strip()
        for start, end in (("{", "}"), ("[", "]")):
            i, j = c.find(start), c.rfind(end)
            if i != -1 and j > i:
                try:
                    return json.loads(c[i:j + 1])
                except ValueError:
                    pass
    return None


def _item(raw):
    if isinstance(raw, str):
        return {"name": raw.strip(), "quantity": "", "state": ""}
    if isinstance(raw, dict):
        name = raw.get("name") or raw.get("이름") or raw.get("ingredient") or ""
        return {
            "name": str(name).strip(),
            "quantity": str(raw.get("quantity") or raw.get("수량") or "").strip(),
            "state": str(raw.get("state") or raw.get("상태") or "").strip(),
        }
    return None


def parse_ingredients(text):
    """모델의 답에서 재료 목록을 뽑는다. JSON(코드 블록 포함) → 목록 형태 순으로 시도하고 중복은 뺀다."""
    data = _load_json(text or "")
    if isinstance(data, dict):
        data = data.get("ingredients", data.get("재료"))
    if isinstance(data, list):
        items = [_item(x) for x in data]
    else:  # JSON이 아니면 "- 계란", "1. 우유", "계란, 우유" 같은 목록으로 본다
        lines = [_BULLET.sub("", ln) for ln in _FENCE.sub("", text or "").splitlines()]
        parts = [p for ln in lines for p in re.split(r"[,、]", ln)]
        items = [_item(p) for p in parts if p.strip() and len(p.strip()) <= 30]

    seen, result = set(), []
    for it in items:
        if not it or not it["name"]:
            continue
        key = it["name"].replace(" ", "").lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(it)
    return result


def _message_text(body):
    content = body["choices"][0]["message"]["content"]
    if isinstance(content, list):  # 일부 모델은 조각 배열로 돌려준다
        content = "".join(p.get("text", "") for p in content if isinstance(p, dict))
    return content or ""


# ───── API 호출 (1단계 재료 인식·2단계 레시피 생성 공용) ─────
# {model_var}에는 문제가 된 설정 이름(VISION_MODEL / TEXT_MODEL)이 들어간다.
_STATUS_MESSAGES = {
    400: "요청이 거부되었습니다. 이 모델이 요청 형식(이미지 입력 등)을 지원하는지 확인해 주세요. "
         "지원하지 않으면 .env의 {model_var}를 다른 모델로 바꿔 주세요.",
    401: "API 키가 올바르지 않습니다. .env의 BAZE_API_KEY를 확인해 주세요. (키는 발급한 BAZE 배포 주소에서만 동작합니다)",
    402: "BAZE 크레딧(사용 한도)이 부족합니다. BAZE 대시보드에서 사용량을 확인해 주세요.",
    403: "이 모델은 API로 쓸 수 없거나, 이 키(조직·그룹)에 허용되지 않은 모델입니다. .env의 {model_var}를 바꿔 주세요.",
    404: "모델을 찾을 수 없습니다. .env의 {model_var}가 BAZE 모델 목록(/models/)에 있는 모델 ID인지 확인해 주세요.",
    408: "모델 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.",
    429: "요청 한도를 넘었습니다. 잠시 후 다시 시도해 주세요.",
}


def _scrub(message, api_key):
    return message.replace(api_key, "***") if api_key else message


def chat(payload, config, model_var="VISION_MODEL", session=requests):
    """chat completions를 호출해 모델이 쓴 글자를 돌려준다. 실패하면 VisionError(키 미포함)를 던진다."""
    if not config.api_key:
        raise VisionError("API 키가 없습니다. .env 파일에 BAZE_API_KEY를 넣어 주세요.")
    url = config.base_url.rstrip("/") + CHAT_PATH
    headers = {"Authorization": f"Bearer {config.api_key}", "Content-Type": "application/json"}

    try:
        res = session.post(url, headers=headers, json=payload, timeout=TIMEOUT_SECONDS)
    except requests.Timeout:
        raise VisionError("응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.") from None
    except requests.RequestException:
        raise VisionError("BAZE API에 연결하지 못했습니다. 인터넷 연결과 .env의 BAZE_BASE_URL을 확인해 주세요.") from None

    try:
        body = res.json()
    except ValueError:
        body = {}
    if not isinstance(body, dict):
        body = {}
    # 게이트웨이가 200 응답 안에 error를 담아 보내는 경우도 처리한다
    if res.status_code != 200 or "error" in body:
        err = body.get("error")
        code = res.status_code if res.status_code != 200 else (err.get("code", 0) if isinstance(err, dict) else 0)
        msg = _STATUS_MESSAGES.get(code)
        if msg:
            msg = msg.format(model_var=model_var)
        else:
            msg = "BAZE 서버에 문제가 있습니다. 잠시 후 다시 시도해 주세요." if isinstance(code, int) and code >= 500                 else f"요청에 실패했습니다(코드 {code})."
        raise VisionError(_scrub(msg, config.api_key))

    try:
        return _message_text(body)
    except (KeyError, IndexError, TypeError, AttributeError):
        raise VisionError("모델의 응답 형식을 이해하지 못했습니다. 다시 시도해 주세요.") from None


def recognize_ingredients(image_bytes, mime, config, session=requests):
    """사진에서 재료 목록을 인식한다. 실패하면 VisionError를 던진다."""
    if not config.api_key:
        raise VisionError("API 키가 없습니다. .env 파일에 BAZE_API_KEY를 넣어 주세요.")
    image_bytes, mime = prepare_image(image_bytes, mime)
    _, _, payload = build_request(image_bytes, mime, config.vision_model, config.api_key, config.base_url)
    return parse_ingredients(chat(payload, config, "VISION_MODEL", session))


# ───── 화면 표시용 ─────
_MD_SPECIAL = re.compile(r"([\\`*_{}\[\]()#+\-.!|>~<$:])")


def escape_markdown(text):
    """모델이 만든 글자를 마크다운·링크·수식으로 해석되지 않게 그대로 보이도록 이스케이프한다."""
    return _MD_SPECIAL.sub(r"\\\1", str(text)).replace("\n", "  \n")
