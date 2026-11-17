@echo off
REM 이 파일을 더블 클릭하면 Streamlit 서버를 띄우고 브라우저로 "냉장고를 부탁해"를 연다.
REM echo 문구는 콘솔 코드페이지 문제로 영어로 둔다.

setlocal
cd /d "%~dp0"
title Fridge Recipe - Streamlit

where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python was not found.
    echo Install Python 3.10 or newer and tick "Add python.exe to PATH".
    pause
    exit /b 1
)

if not exist ".env" (
    echo [WARN] .env not found. Copy .env.example to .env and paste your BAZE API key.
    echo        The app will start, but image recognition stays disabled.
    echo.
)

python -c "import streamlit" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Streamlit is not installed. Run:
    echo         pip install -r requirements.txt
    pause
    exit /b 1
)

echo Starting Streamlit. Press Ctrl+C to stop it.
python -m streamlit run app.py
if errorlevel 1 pause

endlocal
