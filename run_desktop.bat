@echo off
REM Created: 2025-09-15
REM 이 파일을 더블 클릭하면 (최초 1회) 모델을 학습한 뒤 데스크톱 손글씨 숫자
REM 인식기를 띄운다. echo로 찍는 문구는 콘솔 코드페이지 문제로 영어로 둔다.

setlocal
cd /d "%~dp0"
title Handwritten Digit Recognition - Desktop

echo ============================================================
echo   Handwritten Digit Recognition - Desktop Version
echo ============================================================
echo.

where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python was not found.
    echo Install Python 3.10 or newer and tick "Add python.exe to PATH".
    echo.
    pause
    exit /b 1
)

if not exist "model\mnist_cnn.pt" (
    echo [1/2] No trained model found. Training on MNIST now.
    echo       The first run downloads the dataset and takes a few minutes.
    echo.
    python train_model.py
    if errorlevel 1 (
        echo.
        echo [ERROR] Training failed. Install the requirements first:
        echo         pip install -r requirements.txt
        echo.
        pause
        exit /b 1
    )
) else (
    echo [1/2] Trained model found. Skipping training.
)

echo.
echo [2/2] Starting the application window...
echo.
python desktop_version\digit_recognition.py
if errorlevel 1 (
    echo.
    echo [ERROR] The application exited with an error.
    pause
    exit /b 1
)

endlocal
