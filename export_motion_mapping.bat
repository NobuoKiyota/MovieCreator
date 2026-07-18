@echo off
title Export Motion Mapping from Excel
echo Running motion mapping export...
python "%~dp0export_motion_mapping.py"
echo Done.
pause
