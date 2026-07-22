@echo off
cd /d "%~dp0"
echo Starting MovieCreator Video Mixer ...
python scripts/video_mixer.py
if errorlevel 1 (
    echo.
    echo Application exited with error code %errorlevel%.
    pause
)
