"""사용자가 그린 그림을 MNIST 규격의 28x28 텐서로 바꾸고 추론한다.

Created: 2025-09-15
MNIST 숫자는 28x28로 그냥 잘라낸 그림이 아니다. 모든 숫자를 20x20 상자에
들어가도록 크기를 맞춘 뒤, 무게중심을 기준으로 28x28 프레임 가운데에 놓은
결과물이다. 이 두 단계를 건너뛴 그림은 학습 데이터와 전혀 다르게 생겼으므로,
두 프런트엔드가 쓰도록 같은 정규화를 여기서 재현한다.
"""

from __future__ import annotations

from typing import List, Tuple

import numpy as np
import torch
from PIL import Image, ImageOps

from .model import MNIST_MEAN, MNIST_STD

# 획을 맞춰 넣을 상자 크기와 최종 프레임 크기.
DIGIT_BOX = 20
CANVAS_SIZE = 28

# 이 값(0-255 기준) 이하의 픽셀은 배경으로 본다.
INK_THRESHOLD = 20


def _to_white_on_black(image: Image.Image) -> Image.Image:
    """어두운 배경에 밝은 획이 있는 흑백 이미지를 돌려준다.

    사용자는 흰 캔버스에 검은 잉크로 그리는데 MNIST는 검은 배경에 흰 잉크로
    저장되어 있다. 그래서 테두리 픽셀이 밝으면 이미지를 반전한다.
    """
    gray = image.convert("L")
    pixels = np.asarray(gray, dtype=np.float32)

    # 네 변을 표본으로 본다. 흰 캔버스라면 테두리가 밝게 나온다.
    border = np.concatenate(
        [pixels[0, :], pixels[-1, :], pixels[:, 0], pixels[:, -1]]
    )
    if border.mean() > 127:
        gray = ImageOps.invert(gray)

    return gray


def _center_by_mass(digit: Image.Image) -> Image.Image:
    """숫자를 28x28 프레임에 붙이되 무게중심을 가운데에 맞춘다."""
    frame = Image.new("L", (CANVAS_SIZE, CANVAS_SIZE), color=0)

    pixels = np.asarray(digit, dtype=np.float32)
    total = pixels.sum()
    if total == 0:
        # 아무것도 그리지 않은 경우. 기하학적 중앙 정렬로 대신한다.
        offset_x = (CANVAS_SIZE - digit.width) // 2
        offset_y = (CANVAS_SIZE - digit.height) // 2
        frame.paste(digit, (offset_x, offset_y))
        return frame

    rows = np.arange(pixels.shape[0], dtype=np.float32)
    cols = np.arange(pixels.shape[1], dtype=np.float32)
    center_y = float((pixels.sum(axis=1) * rows).sum() / total)
    center_x = float((pixels.sum(axis=0) * cols).sum() / total)

    # 무게중심이 프레임 한가운데에 오도록 이동량을 구한다.
    offset_x = int(round(CANVAS_SIZE / 2.0 - center_x))
    offset_y = int(round(CANVAS_SIZE / 2.0 - center_y))

    # 숫자가 프레임 밖으로 잘려 나가지 않게 가둔다.
    offset_x = max(0, min(offset_x, CANVAS_SIZE - digit.width))
    offset_y = max(0, min(offset_y, CANVAS_SIZE - digit.height))

    frame.paste(digit, (offset_x, offset_y))
    return frame


def has_ink(image: Image.Image) -> bool:
    """이미지에 실제로 획이 있으면 True를 돌려준다.

    빈 캔버스도 그럴듯하게 확신에 찬 예측을 내놓는다. 그래서 호출하는 쪽은 이걸
    먼저 확인해, 엉뚱한 숫자 대신 "뭐라도 그리라"고 알려 준다.
    """
    gray = _to_white_on_black(image)
    cleaned = gray.point(lambda value: value if value > INK_THRESHOLD else 0)
    return cleaned.getbbox() is not None


def preprocess_image(image: Image.Image) -> Image.Image:
    """임의의 그림을 28x28 MNIST 규격 이미지로 바꾼다.

    순서: 검은 배경·흰 글씨로 반전 -> 잉크 영역만 잘라내기 -> 긴 변을 20px로
    축소 -> 무게중심 기준으로 가운데 정렬.
    """
    gray = _to_white_on_black(image)

    # 경계 부근의 옅은 안티앨리어싱 잡음을 먼저 지우고 bounding box를 잰다.
    cleaned = gray.point(lambda value: value if value > INK_THRESHOLD else 0)

    bbox = cleaned.getbbox()
    if bbox is None:
        # 빈 캔버스. 예외를 던지는 대신 빈 프레임을 돌려주어, 호출하는 쪽이
        # 낮은 신뢰도로 처리할 수 있게 한다.
        return Image.new("L", (CANVAS_SIZE, CANVAS_SIZE), color=0)

    digit = cleaned.crop(bbox)

    # 긴 변을 20픽셀에 맞추고 가로세로 비율은 유지한다.
    width, height = digit.size
    scale = DIGIT_BOX / float(max(width, height))
    new_width = max(1, int(round(width * scale)))
    new_height = max(1, int(round(height * scale)))
    digit = digit.resize((new_width, new_height), Image.LANCZOS)

    return _center_by_mass(digit)


def canvas_to_tensor(image: Image.Image) -> Tuple[torch.Tensor, Image.Image]:
    """정규화된 1x1x28x28 텐서와 28x28 미리보기 이미지를 함께 돌려준다."""
    processed = preprocess_image(image)

    pixels = np.asarray(processed, dtype=np.float32) / 255.0
    normalized = (pixels - MNIST_MEAN) / MNIST_STD

    tensor = torch.from_numpy(normalized).unsqueeze(0).unsqueeze(0)
    return tensor, processed


def predict_digit(
    model: torch.nn.Module, image: Image.Image
) -> Tuple[int, float, List[float], Image.Image]:
    """`image`에 그려진 숫자를 예측한다.

    Returns:
        (예측한 숫자, 신뢰도(%), 클래스별 확률(%) 목록, 28x28 미리보기 이미지).
    """
    tensor, processed = canvas_to_tensor(image)

    with torch.no_grad():
        logits = model(tensor)
        probabilities = torch.softmax(logits, dim=1)[0]

    digit = int(torch.argmax(probabilities).item())
    confidence = float(probabilities[digit].item()) * 100.0
    all_scores = [float(value) * 100.0 for value in probabilities]

    return digit, confidence, all_scores, processed
