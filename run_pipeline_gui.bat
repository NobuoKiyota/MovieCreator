@echo off
chcp 65001 > NUL
title MovieCreator Pipeline GUI Launcher
echo 🎬 Starting MovieCreator Pipeline Control Center...
python "%~dp0scripts\pipeline_gui.py"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ エラーが発生しました。キーを押して終了してください...
    pause > NUL
)
