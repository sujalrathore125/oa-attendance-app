@echo off
REM ════════════════════════════════════════════════════════════
REM  start_face_service.bat
REM  Run from: oa-attendance/python-face-service/
REM ════════════════════════════════════════════════════════════
title OA Attendance — Face Recognition Service
echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║   OA Attendance Face Recognition Service         ║
echo  ╚══════════════════════════════════════════════════╝
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Install Python 3.10+ from python.org
    pause & exit /b 1
)

cd /d "%~dp0"

if not exist "venv\Scripts\activate.bat" (
    echo [SETUP] Creating virtual environment...
    python -m venv venv
)

echo [SETUP] Activating virtual environment...
call venv\Scripts\activate.bat

echo [SETUP] Installing / verifying packages...
pip install -r requirements.txt --quiet

if not exist "models" mkdir models

echo.
echo [INFO]  Service starting on http://localhost:8000
echo [INFO]  First run downloads ~300 MB model weights (one time only)
echo [INFO]  Wait for "Face service ready" before using the app
echo [INFO]  Press Ctrl+C to stop
echo.
python app.py
pause
