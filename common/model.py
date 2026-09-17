"""CNN 모델 정의와 체크포인트 로딩.

Created: 2025-09-15
합성곱 블록 두 개짜리 작은 신경망으로, CPU에서 몇 에폭만 돌려도 MNIST 테스트
세트에서 99% 안팎의 정확도가 나온다.
"""

from __future__ import annotations

from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F

# 프로젝트 루트는 이 패키지의 부모 디렉터리다.
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# 학습된 가중치는 데스크톱 버전과 웹 버전이 함께 쓴다.
MODEL_PATH = PROJECT_ROOT / "model" / "mnist_cnn.pt"

# MNIST 정규화 상수(데이터세트의 평균과 표준편차).
MNIST_MEAN = 0.1307
MNIST_STD = 0.3081


class DigitCNN(nn.Module):
    """합성곱 블록 두 개 뒤에 작은 분류 헤드를 붙인 구조."""

    def __init__(self, num_classes: int = 10) -> None:
        super().__init__()

        # 블록 1: 28x28 -> 14x14, 특징 맵 32장.
        self.conv1 = nn.Conv2d(1, 32, kernel_size=3, padding=1)
        self.bn1 = nn.BatchNorm2d(32)
        self.conv2 = nn.Conv2d(32, 32, kernel_size=3, padding=1)
        self.bn2 = nn.BatchNorm2d(32)

        # 블록 2: 14x14 -> 7x7, 특징 맵 64장.
        self.conv3 = nn.Conv2d(32, 64, kernel_size=3, padding=1)
        self.bn3 = nn.BatchNorm2d(64)
        self.conv4 = nn.Conv2d(64, 64, kernel_size=3, padding=1)
        self.bn4 = nn.BatchNorm2d(64)

        self.dropout_conv = nn.Dropout(0.25)
        self.dropout_fc = nn.Dropout(0.5)

        self.fc1 = nn.Linear(64 * 7 * 7, 128)
        self.fc2 = nn.Linear(128, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """1x28x28 이미지 배치에 대한 가공 전 클래스 로짓을 돌려준다."""
        x = F.relu(self.bn1(self.conv1(x)))
        x = F.relu(self.bn2(self.conv2(x)))
        x = F.max_pool2d(x, 2)
        x = self.dropout_conv(x)

        x = F.relu(self.bn3(self.conv3(x)))
        x = F.relu(self.bn4(self.conv4(x)))
        x = F.max_pool2d(x, 2)
        x = self.dropout_conv(x)

        x = torch.flatten(x, 1)
        x = F.relu(self.fc1(x))
        x = self.dropout_fc(x)
        return self.fc2(x)


def load_model(model_path: Path | str = MODEL_PATH, device: str = "cpu") -> DigitCNN:
    """학습된 체크포인트를 읽어 평가 모드 상태의 모델을 돌려준다.

    Raises:
        FileNotFoundError: 체크포인트가 아직 없을 때. 호출하는 쪽에서
            `python train_model.py`를 먼저 실행하라고 안내해야 한다.
    """
    model_path = Path(model_path)
    if not model_path.exists():
        raise FileNotFoundError(
            f"Trained model not found at '{model_path}'.\n"
            "Run 'python train_model.py' first to train and save the model."
        )

    model = DigitCNN()
    state_dict = torch.load(model_path, map_location=device)
    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()
    return model
