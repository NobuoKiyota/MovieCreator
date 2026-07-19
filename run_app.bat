@echo off
cd /d "%~dp0"
echo ===================================================
echo   Starting Movie Creator (Neon Video Maker) ...
echo ===================================================
echo.

REM Force Vite's dev-server auto-open to launch Chrome specifically instead of the OS default
REM browser. Transparent WebM export needs WebCodecs VP9-alpha encoding, which some Chromium
REM builds (e.g. some Edge versions) don't support - see TASKLOG 2026-07-19 23:35. If Chrome
REM isn't installed, Vite just logs an error and keeps running; open the printed URL manually.
set BROWSER=chrome

npm run dev
pause
