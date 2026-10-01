"""데스크톱 손글씨 숫자 인식기 (Tkinter).

Created: 2025-09-15
마우스로 0~9 숫자를 그리고 [Recognize]를 누르면, 학습된 CNN이 예측한 숫자와
신뢰도를 함께 보여 준다.
"""

from __future__ import annotations

import sys
import tkinter as tk
from pathlib import Path
from tkinter import messagebox

from PIL import Image, ImageDraw

# desktop_version 폴더에서 이 파일을 직접 실행해도 동작하게 한다.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from common.model import MODEL_PATH, load_model  # noqa: E402
from common.preprocess import predict_digit  # noqa: E402

# 캔버스 크기와 그리기 설정.
CANVAS_SIZE = 280
BRUSH_RADIUS = 11

# 색상 팔레트.
BG_COLOR = "#1e1e2e"
PANEL_COLOR = "#282a36"
CANVAS_BG = "#ffffff"
INK_COLOR = "#000000"
TEXT_COLOR = "#f8f8f2"
ACCENT_COLOR = "#8be9fd"
MUTED_COLOR = "#6272a4"


class DigitRecognizerApp:
    """그리기 캔버스와 예측 패널을 담은 Tkinter 창."""

    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("Handwritten Digit Recognition - MNIST CNN")
        self.root.configure(bg=BG_COLOR)
        self.root.resizable(False, False)

        self.model = self._load_model_or_exit()

        # 캔버스에 그린 획을 그대로 따라 그리는 오프스크린 이미지.
        # Tk 캔버스 위젯에서 픽셀을 다시 읽어올 이식성 있는 방법이 없어서,
        # 모든 획을 두 번 그린다. 한 번은 사용자용, 한 번은 모델용이다.
        self.image = Image.new("L", (CANVAS_SIZE, CANVAS_SIZE), color=255)
        self.draw = ImageDraw.Draw(self.image)

        self.last_point: tuple[int, int] | None = None
        self.has_drawing = False

        self._build_widgets()

    # ------------------------------------------------------------------
    # 초기 설정
    # ------------------------------------------------------------------
    def _load_model_or_exit(self):
        """체크포인트를 읽는다. 없으면 오류 창을 띄우고 종료한다."""
        try:
            return load_model()
        except FileNotFoundError:
            messagebox.showerror(
                "Model not found",
                f"The trained model was not found at:\n{MODEL_PATH}\n\n"
                "Run train_model.py in the project root first, or start the app\n"
                "with run_desktop.bat, which trains the model for you.",
            )
            self.root.destroy()
            sys.exit(1)

    def _build_widgets(self) -> None:
        """창 안의 위젯을 모두 만든다."""
        title = tk.Label(
            self.root,
            text="Handwritten Digit Recognition",
            font=("Segoe UI", 18, "bold"),
            bg=BG_COLOR,
            fg=TEXT_COLOR,
        )
        title.grid(row=0, column=0, columnspan=2, pady=(18, 2))

        subtitle = tk.Label(
            self.root,
            text="Draw a digit (0-9) in the white box, then press Recognize",
            font=("Segoe UI", 10),
            bg=BG_COLOR,
            fg=MUTED_COLOR,
        )
        subtitle.grid(row=1, column=0, columnspan=2, pady=(0, 14))

        # 그리기 캔버스.
        self.canvas = tk.Canvas(
            self.root,
            width=CANVAS_SIZE,
            height=CANVAS_SIZE,
            bg=CANVAS_BG,
            highlightthickness=2,
            highlightbackground=ACCENT_COLOR,
            cursor="crosshair",
        )
        self.canvas.grid(row=2, column=0, padx=(22, 11), pady=6)

        self.canvas.bind("<Button-1>", self._on_press)
        self.canvas.bind("<B1-Motion>", self._on_drag)
        self.canvas.bind("<ButtonRelease-1>", self._on_release)

        # 오른쪽 결과 패널.
        panel = tk.Frame(self.root, bg=PANEL_COLOR, width=210, height=CANVAS_SIZE)
        panel.grid(row=2, column=1, padx=(11, 22), pady=6, sticky="nsew")
        panel.grid_propagate(False)

        tk.Label(
            panel,
            text="PREDICTION",
            font=("Segoe UI", 9, "bold"),
            bg=PANEL_COLOR,
            fg=MUTED_COLOR,
        ).pack(pady=(20, 4))

        self.result_label = tk.Label(
            panel,
            text="-",
            font=("Segoe UI", 76, "bold"),
            bg=PANEL_COLOR,
            fg=ACCENT_COLOR,
        )
        self.result_label.pack()

        self.confidence_label = tk.Label(
            panel,
            text="Confidence: -",
            font=("Segoe UI", 11),
            bg=PANEL_COLOR,
            fg=TEXT_COLOR,
        )
        self.confidence_label.pack(pady=(2, 12))

        tk.Label(
            panel,
            text="TOP 3",
            font=("Segoe UI", 9, "bold"),
            bg=PANEL_COLOR,
            fg=MUTED_COLOR,
        ).pack()

        self.top3_label = tk.Label(
            panel,
            text="-",
            font=("Consolas", 11),
            bg=PANEL_COLOR,
            fg=TEXT_COLOR,
            justify="left",
        )
        self.top3_label.pack(pady=(4, 0))

        # 버튼.
        button_row = tk.Frame(self.root, bg=BG_COLOR)
        button_row.grid(row=3, column=0, columnspan=2, pady=(12, 20))

        tk.Button(
            button_row,
            text="Clear",
            font=("Segoe UI", 12, "bold"),
            width=12,
            bg="#ff5555",
            fg="white",
            activebackground="#ff7777",
            activeforeground="white",
            relief="flat",
            cursor="hand2",
            command=self.clear_canvas,
        ).pack(side="left", padx=8)

        tk.Button(
            button_row,
            text="Recognize",
            font=("Segoe UI", 12, "bold"),
            width=12,
            bg="#50fa7b",
            fg="#1e1e2e",
            activebackground="#69ff94",
            activeforeground="#1e1e2e",
            relief="flat",
            cursor="hand2",
            command=self.recognize,
        ).pack(side="left", padx=8)

        # 단축키: Enter는 인식, Esc는 지우기.
        self.root.bind("<Return>", lambda event: self.recognize())
        self.root.bind("<Escape>", lambda event: self.clear_canvas())

    # ------------------------------------------------------------------
    # 그리기
    # ------------------------------------------------------------------
    def _on_press(self, event: tk.Event) -> None:
        self.last_point = (event.x, event.y)
        self._paint(event.x, event.y, event.x, event.y)

    def _on_drag(self, event: tk.Event) -> None:
        if self.last_point is None:
            self.last_point = (event.x, event.y)
        start_x, start_y = self.last_point
        self._paint(start_x, start_y, event.x, event.y)
        self.last_point = (event.x, event.y)

    def _on_release(self, event: tk.Event) -> None:
        self.last_point = None

    def _paint(self, x1: int, y1: int, x2: int, y2: int) -> None:
        """획 한 토막을 캔버스와 오프스크린 이미지에 똑같이 그린다."""
        self.canvas.create_line(
            x1,
            y1,
            x2,
            y2,
            fill=INK_COLOR,
            width=BRUSH_RADIUS * 2,
            capstyle=tk.ROUND,
            smooth=True,
        )
        self.draw.line([(x1, y1), (x2, y2)], fill=0, width=BRUSH_RADIUS * 2)

        # 이음새를 둥글게 메운다. 빠르게 그을 때 선이 마디져 보이지 않게 한다.
        self.draw.ellipse(
            [
                x2 - BRUSH_RADIUS,
                y2 - BRUSH_RADIUS,
                x2 + BRUSH_RADIUS,
                y2 + BRUSH_RADIUS,
            ],
            fill=0,
        )

        self.has_drawing = True

    # ------------------------------------------------------------------
    # 동작
    # ------------------------------------------------------------------
    def clear_canvas(self) -> None:
        """그림을 지우고 결과 패널을 초기화한다."""
        self.canvas.delete("all")
        self.draw.rectangle([0, 0, CANVAS_SIZE, CANVAS_SIZE], fill=255)
        self.has_drawing = False
        self.last_point = None

        self.result_label.config(text="-")
        self.confidence_label.config(text="Confidence: -")
        self.top3_label.config(text="-")

    def recognize(self) -> None:
        """지금 그려진 그림을 모델에 넣고 결과를 표시한다."""
        if not self.has_drawing:
            messagebox.showinfo("Empty canvas", "Draw a digit first.")
            return

        digit, confidence, scores, _ = predict_digit(self.model, self.image)

        self.result_label.config(text=str(digit))
        self.confidence_label.config(text=f"Confidence: {confidence:.1f}%")

        ranking = sorted(enumerate(scores), key=lambda item: item[1], reverse=True)
        self.top3_label.config(
            text="\n".join(
                f"{value:>5.1f}%  ->  {label}" for label, value in ranking[:3]
            )
        )


def main() -> None:
    root = tk.Tk()
    DigitRecognizerApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
