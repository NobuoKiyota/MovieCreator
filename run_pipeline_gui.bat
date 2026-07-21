@echo off
chcp 65001 > NUL
title MovieCreator Pipeline GUI Launcher
echo 🎬 Starting MovieCreator Pipeline Control Center...
start "" python "%~dp0scripts\pipeline_gui.py"
