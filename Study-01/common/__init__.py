"""손글씨 숫자 인식 프로젝트의 공용 패키지.

Created: 2025-09-15
데스크톱 버전과 웹 버전이 모델 정의와 이미지 전처리 헬퍼를 모두 이 패키지에서
가져다 쓴다. 그래서 두 프런트엔드의 추론 파이프라인은 항상 완전히 같다.
"""

from .model import DigitCNN, MODEL_PATH, load_model
from .preprocess import canvas_to_tensor, has_ink, predict_digit, preprocess_image

__all__ = [
    "DigitCNN",
    "MODEL_PATH",
    "load_model",
    "canvas_to_tensor",
    "has_ink",
    "preprocess_image",
    "predict_digit",
]
