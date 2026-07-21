@echo off
setlocal
cd /d "%~dp0"
echo Starting MovieCreator Pipeline GUI...
python scripts\pipeline_gui.py
if errorlevel 1 (
    echo.
    echo [ERROR] Pipeline GUI exited with an error. Press any key to exit...
    pause > nul
)
