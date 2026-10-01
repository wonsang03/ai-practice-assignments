"""train_model.py가 남긴 학습 로그를 분석한다.

Created: 2026-09-17
사용법:
    python logs/analyze_log.py                          # logs/의 가장 최근 로그
    python logs/analyze_log.py logs/train_2026-09-17.log
    python logs/analyze_log.py --out logs/analysis_2026-09-17.md

로그 원문만 봐서는 알 수 없는 세 가지를 계산한다. 에폭 안에서 손실이 실제로
얼마나 빨리 떨어졌는지, 각 에폭이 남은 오차를 몇 퍼센트나 걷어냈는지, 그리고
한 에폭을 더 돌릴 값어치가 아직 남았는지.
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

LOGS_DIR = Path(__file__).resolve().parent

BATCH_PATTERN = re.compile(
    r"epoch\s+(\d+)\s*\|\s*batch\s+(\d+)\s*/\s*(\d+)\s*\|\s*loss\s+([\d.]+)"
)
EPOCH_PATTERN = re.compile(
    r"average loss\s+([\d.]+)\s*\|\s*test accuracy\s+([\d.]+)\s*%"
)
ELAPSED_PATTERN = re.compile(r"Training finished in\s+([\d.]+)\s*s")
DEVICE_PATTERN = re.compile(r"^Device:\s*(\S+)", re.MULTILINE)

# 에폭당 정확도 상승이 이 값보다 작으면, 더 돌려 봐야 시간만 쓰고 얻는 게 없다.
DIMINISHING_RETURN_GAIN = 0.30


@dataclass
class EpochRecord:
    """한 에폭의 기록. 중간 배치 손실, 평균 손실, 테스트 정확도를 담는다."""

    number: int
    average_loss: float
    accuracy: float
    batch_losses: list[tuple[int, float]] = field(default_factory=list)

    @property
    def error_rate(self) -> float:
        """오답률(%). 정확도가 99% 근처면 이쪽이 읽기 쉽다.
        99.15 -> 99.40은 미미해 보이지만 0.85 -> 0.60은 3분의 1이 줄어든 것이다."""
        return 100.0 - self.accuracy

    def segment_losses(self) -> list[tuple[int, int, float]]:
        """구간별 실제 손실을 복원한다.

        train_model.py가 찍는 손실은 에폭 처음부터의 누적 평균이라, 모델이 이미
        좋아진 뒤에도 초반의 큰 값에 끌려 높게 나온다. 평균을 되돌리면 두 체크
        포인트 사이에서 손실이 실제로 얼마였는지가 보인다.
        """
        segments: list[tuple[int, int, float]] = []
        previous_index, previous_sum = 0, 0.0

        for index, running_mean in self.batch_losses:
            total = running_mean * index
            span = index - previous_index
            if span > 0:
                segments.append(
                    (previous_index + 1, index, (total - previous_sum) / span)
                )
            previous_index, previous_sum = index, total

        return segments


def parse_log(text: str) -> tuple[list[EpochRecord], str | None, float | None]:
    """로그에서 에폭 기록, 사용한 디바이스, 총 학습 시간을 뽑아낸다."""
    epochs: list[EpochRecord] = []
    pending_batches: list[tuple[int, float]] = []
    epoch_number = 0

    for line in text.splitlines():
        batch_match = BATCH_PATTERN.search(line)
        if batch_match:
            epoch_number = int(batch_match.group(1))
            pending_batches.append(
                (int(batch_match.group(2)), float(batch_match.group(4)))
            )
            continue

        epoch_match = EPOCH_PATTERN.search(line)
        if epoch_match:
            epochs.append(
                EpochRecord(
                    number=epoch_number or len(epochs) + 1,
                    average_loss=float(epoch_match.group(1)),
                    accuracy=float(epoch_match.group(2)),
                    batch_losses=pending_batches,
                )
            )
            pending_batches = []

    device_match = DEVICE_PATTERN.search(text)
    elapsed_match = ELAPSED_PATTERN.search(text)
    return (
        epochs,
        device_match.group(1) if device_match else None,
        float(elapsed_match.group(1)) if elapsed_match else None,
    )


def build_report(
    source: Path,
    epochs: list[EpochRecord],
    device: str | None,
    elapsed: float | None,
) -> str:
    """분석 결과를 마크다운 문자열로 만든다."""
    first, last = epochs[0], epochs[-1]
    lines = [
        f"# 학습 로그 분석 - {source.name}",
        "",
        f"- 원본 로그: `{source.as_posix()}`",
        f"- 디바이스: {device or '알 수 없음'}",
        f"- 에폭 수: {len(epochs)}",
    ]
    if elapsed is not None:
        lines.append(
            f"- 학습 시간: {elapsed:.1f}초 (에폭당 {elapsed / len(epochs):.1f}초)"
        )

    lines += ["", "## 에폭별 진행", ""]
    lines.append("| 에폭 | 평균 손실 | 손실 감소 | 테스트 정확도 | 오답률 | 오차 제거율 |")
    lines.append("| --- | --- | --- | --- | --- | --- |")

    for index, epoch in enumerate(epochs):
        if index == 0:
            loss_drop = accuracy_gain = error_removed = "-"
        else:
            previous = epochs[index - 1]
            loss_drop = f"-{previous.average_loss - epoch.average_loss:.4f}"
            accuracy_gain = f"+{epoch.accuracy - previous.accuracy:.2f} pp"
            error_removed = (
                f"{(previous.error_rate - epoch.error_rate) / previous.error_rate * 100:.1f} %"
                if previous.error_rate
                else "-"
            )
        accuracy_cell = f"{epoch.accuracy:.2f} %"
        if index:
            accuracy_cell += f" ({accuracy_gain})"
        lines.append(
            f"| {epoch.number} | {epoch.average_loss:.4f} | {loss_drop} | "
            f"{accuracy_cell} | {epoch.error_rate:.2f} % | {error_removed} |"
        )

    lines += [
        "",
        "## 에폭 안에서의 손실 변화",
        "",
        "로그에 찍히는 손실은 누적 평균이라 실제보다 늦게 따라온다. 아래는 평균을",
        "되돌려 구간별 실제 손실을 복원한 값이다.",
        "",
    ]
    for epoch in epochs:
        segments = epoch.segment_losses()
        if not segments:
            continue
        rendered = "  ".join(
            f"{start}-{end}: {value:.4f}" for start, end, value in segments
        )
        lines.append(f"- 에폭 {epoch.number}: {rendered}")
        head, tail = segments[0][2], segments[-1][2]
        if head:
            lines.append(
                f"  (첫 구간 {head:.4f} -> 마지막 구간 {tail:.4f}, "
                f"에폭이 끝날 무렵 {(head - tail) / head * 100:.0f}% 낮아짐)"
            )

    lines += ["", "## 판정", ""]
    lines.append(
        f"- 최종 **{last.accuracy:.2f}%**. 테스트 1만 장 중 {last.error_rate:.2f}%"
        f"(약 {round(last.error_rate * 100)}장)를 아직 틀린다."
    )
    lines.append(
        f"- 학습 전체에서 오답률이 {first.error_rate:.2f}% -> {last.error_rate:.2f}%로 줄었다."
    )

    if len(epochs) >= 2:
        final_gain = last.accuracy - epochs[-2].accuracy
        if final_gain <= 0:
            lines.append(
                f"- 마지막 에폭이 얻은 것이 없다({final_gain:+.2f} pp). 수렴이 끝났고 "
                "에폭을 늘려도 시간만 쓴다."
            )
        elif final_gain < DIMINISHING_RETURN_GAIN:
            lines.append(
                f"- 마지막 에폭의 상승폭이 {final_gain:+.2f} pp에 그쳤다. 수확 체감 구간에"
                " 들어섰으므로 더 돌려도 얻는 폭은 작다."
            )
        else:
            lines.append(
                f"- 마지막 에폭도 {final_gain:+.2f} pp 올랐다. 아직 상승 여력이 있으니 "
                "`python train_model.py --epochs 8 --force`로 더 학습할 만하다."
            )

    # 손실은 계속 내려가는데 정확도 최고점이 마지막 에폭이 아니면 과적합 신호다.
    if last.average_loss < first.average_loss and last.accuracy < max(
        epoch.accuracy for epoch in epochs
    ):
        lines.append(
            "- 주의: 손실은 계속 줄었는데 마지막 에폭의 정확도가 최고점이 아니다. "
            "과적합 신호이므로 더 일찍 멈추거나 마지막 대신 최고 에폭의 가중치를 쓰는 편이 낫다."
        )

    lines += [
        "",
        "손실은 변형(회전·이동·확대·기울임)을 준 학습 이미지에서 재고, 정확도는 변형이",
        "없는 테스트 이미지에서 잰다. 그래서 손실 숫자가 정확도에 비해 나빠 보이는데,",
        "이는 정상이며 문제가 아니다.",
        "",
    ]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyse a train_model.py log.")
    parser.add_argument(
        "log", nargs="?", type=Path, help="log file (default: newest *.log in logs/)"
    )
    parser.add_argument("--out", type=Path, help="write the report to this file too")
    args = parser.parse_args()

    source = args.log
    if source is None:
        candidates = sorted(
            LOGS_DIR.glob("*.log"), key=lambda path: path.stat().st_mtime
        )
        if not candidates:
            sys.exit(f"No *.log file in '{LOGS_DIR}'. Run train_model.py first.")
        source = candidates[-1]

    if not source.exists():
        sys.exit(f"Log file not found: '{source}'. Check the path.")

    epochs, device, elapsed = parse_log(source.read_text(encoding="utf-8"))
    if not epochs:
        sys.exit(
            f"No epoch results found in '{source}'. "
            "Expected lines like '-> average loss 0.1451 | test accuracy 99.15%'."
        )

    report = build_report(source, epochs, device, elapsed)
    print(report)

    if args.out:
        args.out.write_text(report, encoding="utf-8")
        print(f"Saved the report to '{args.out}'.")


if __name__ == "__main__":
    main()
