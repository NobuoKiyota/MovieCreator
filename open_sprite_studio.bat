@echo off
echo Opening MP4 to SpriteSheet Studio from MovieCreator tools...
cd /d "%~dp0"

netstat -ano | findstr :5173 >nul
if %errorlevel% neq 0 (
    echo Starting MovieCreator API Server in background...
    start /b "" npm run dev >nul 2>&1
    timeout /t 2 /nobreak >nul
)

start "" "http://localhost:5173/tools/mp4_to_sprite/index.html"

