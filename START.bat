@echo off
title Smart Syllabus Tutor
cd /d "%~dp0"

echo.
echo  Smart Syllabus Tutor
echo  Website: http://127.0.0.1:3000
echo.

if not exist "backend\venv\Scripts\python.exe" (
  echo ERROR: backend\venv not found.
  pause
  exit /b 1
)

if not exist "backend\.env" (
  echo.
  echo  No Gemini API key found — running setup...
  powershell -ExecutionPolicy Bypass -File "%~dp0setup-gemini.ps1"
  echo.
)

if exist "backend\.env" (
  echo  AI mode: Full Gemini roadmap ^(backend\.env loaded^)
) else (
  echo  AI mode: Local fallback only — add backend\.env for full AI
)

echo Stopping old servers...
if exist "%~dp0stop-servers.ps1" (
  powershell -ExecutionPolicy Bypass -File "%~dp0stop-servers.ps1"
)

echo Building latest website...
pushd frontend
if exist ".next" rmdir /s /q ".next"
call npm run build
if errorlevel 1 (
  echo Build failed.
  popd
  pause
  exit /b 1
)
popd

echo Starting backend...
start "Syllabus Backend" cmd /k "cd /d %~dp0backend & venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 4 /nobreak >nul

echo Starting website...
start "Syllabus Website" cmd /k "cd /d %~dp0frontend & npm run start"

timeout /t 8 /nobreak >nul
start "" "http://127.0.0.1:3000"

echo.
echo  Open: http://127.0.0.1:3000
echo  Keep BOTH terminal windows open.
echo  After upload, quizzes load instantly on this site.
echo.
pause
