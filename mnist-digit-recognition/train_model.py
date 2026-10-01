"""두 프런트엔드가 함께 쓰는 MNIST 숫자 분류기를 학습한다.

Created: 2025-09-15
사용법:
    python train_model.py                # 기본 설정으로 학습
    python train_model.py --epochs 5     # 더 오래 학습해 정확도를 올린다
    python train_model.py --force        # 체크포인트가 있어도 다시 학습

학습한 가중치는 model/mnist_cnn.pt에 저장되고, 데스크톱 버전과 웹 버전이
시작할 때 이 파일을 읽는다.
"""

from __future__ import annotations

import argparse
import time
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms

from common.model import MNIST_MEAN, MNIST_STD, MODEL_PATH, DigitCNN

PROJECT_ROOT = Path(__file__).resolve().parent
DATA_DIR = PROJECT_ROOT / "data"


def build_dataloaders(batch_size: int) -> tuple[DataLoader, DataLoader]:
    """필요하면 MNIST를 내려받고 학습·테스트 로더를 만든다.

    약한 랜덤 affine 변형은 학습 split에만 준다. 마우스로 그린 숫자는 MNIST
    샘플만큼 단정한 경우가 드물어서, 변형을 섞어 학습해야 실제 입력에 눈에 띄게
    너그러워진다.
    """
    train_transform = transforms.Compose(
        [
            transforms.RandomAffine(
                degrees=10, translate=(0.1, 0.1), scale=(0.9, 1.1), shear=5
            ),
            transforms.ToTensor(),
            transforms.Normalize((MNIST_MEAN,), (MNIST_STD,)),
        ]
    )
    test_transform = transforms.Compose(
        [
            transforms.ToTensor(),
            transforms.Normalize((MNIST_MEAN,), (MNIST_STD,)),
        ]
    )

    train_set = datasets.MNIST(
        root=str(DATA_DIR), train=True, download=True, transform=train_transform
    )
    test_set = datasets.MNIST(
        root=str(DATA_DIR), train=False, download=True, transform=test_transform
    )

    train_loader = DataLoader(train_set, batch_size=batch_size, shuffle=True)
    test_loader = DataLoader(test_set, batch_size=1000, shuffle=False)
    return train_loader, test_loader


def train_one_epoch(
    model: nn.Module,
    loader: DataLoader,
    optimizer: torch.optim.Optimizer,
    criterion: nn.Module,
    device: torch.device,
    epoch: int,
) -> float:
    """한 에폭을 학습하고 평균 손실을 돌려준다."""
    model.train()
    running_loss = 0.0
    batches = len(loader)

    for index, (images, labels) in enumerate(loader, start=1):
        images, labels = images.to(device), labels.to(device)

        optimizer.zero_grad()
        loss = criterion(model(images), labels)
        loss.backward()
        optimizer.step()

        running_loss += loss.item()

        # 여기서 찍는 값은 에폭 처음부터의 누적 평균이다. 구간별 실제 손실이
        # 궁금하면 logs/analyze_log.py가 평균을 되돌려 계산해 준다.
        if index % 100 == 0 or index == batches:
            print(
                f"  epoch {epoch} | batch {index:>4}/{batches} | "
                f"loss {running_loss / index:.4f}",
                flush=True,
            )

    return running_loss / batches


def evaluate(model: nn.Module, loader: DataLoader, device: torch.device) -> float:
    """테스트 split에 대한 정확도를 퍼센트로 돌려준다."""
    model.eval()
    correct = 0
    total = 0

    with torch.no_grad():
        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)
            predictions = model(images).argmax(dim=1)
            correct += int((predictions == labels).sum().item())
            total += labels.size(0)

    return 100.0 * correct / total


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the MNIST digit classifier.")
    parser.add_argument("--epochs", type=int, default=3, help="number of epochs")
    parser.add_argument("--batch-size", type=int, default=128, help="batch size")
    parser.add_argument("--lr", type=float, default=1e-3, help="learning rate")
    parser.add_argument(
        "--force", action="store_true", help="retrain even if a checkpoint exists"
    )
    args = parser.parse_args()

    # .bat 실행 파일이 매번 이 스크립트를 부르므로, 모델이 이미 있으면 건너뛴다.
    if MODEL_PATH.exists() and not args.force:
        print(f"Model already exists at '{MODEL_PATH}'. Use --force to retrain.")
        return

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")
    print("Loading the MNIST dataset (it is downloaded on the first run)...")

    train_loader, test_loader = build_dataloaders(args.batch_size)
    print(
        f"Train samples: {len(train_loader.dataset):,} | "
        f"Test samples: {len(test_loader.dataset):,}"
    )

    model = DigitCNN().to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)
    # 에폭마다 학습률을 0.7배로 줄여, 뒤로 갈수록 미세 조정만 하게 한다.
    scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=1, gamma=0.7)

    started = time.time()
    for epoch in range(1, args.epochs + 1):
        print(f"\nEpoch {epoch}/{args.epochs}")
        average_loss = train_one_epoch(
            model, train_loader, optimizer, criterion, device, epoch
        )
        accuracy = evaluate(model, test_loader, device)
        scheduler.step()
        print(f"  -> average loss {average_loss:.4f} | test accuracy {accuracy:.2f}%")

    elapsed = time.time() - started
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), MODEL_PATH)

    print(f"\nTraining finished in {elapsed:.1f}s.")
    print(f"Saved the trained model to '{MODEL_PATH}'.")


if __name__ == "__main__":
    main()
