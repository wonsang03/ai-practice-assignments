@echo off
REM Created: 2025-09-15
REM 이 파일을 더블 클릭하면 (최초 1회) 모델을 학습하고, Flask 서버를 띄운 뒤
REM 브라우저로 웹 손글씨 숫자 인식기를 연다. echo 문구는 콘솔 코드페이지 문제로
REM 영어로 둔다.

setlocal
cd /d "%~dp0"
title Handwritten Digit Recognition - Web

echo ============================================================
echo   Handwritten Digit Recognition - Web Version
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
echo [2/2] Starting the Flask server. The browser opens once it is ready.
echo       Press Ctrl+C to stop it.
echo.
REM 브라우저는 서버가 직접 연다. 여기서 먼저 열면 모델 로딩을 앞질러서
REM 연결 거부 페이지가 뜬다.
python web_version\app.py --open-browser
if errorlevel 1 (
    echo.
    echo [ERROR] The server exited with an error.
    pause
    exit /b 1
)

endlocal
