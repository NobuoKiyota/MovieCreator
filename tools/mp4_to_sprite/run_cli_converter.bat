@echo off
title MP4 to SpriteSheet Converter CLI

echo Checking and installing required Python libraries...
pip install -r "%~dp0requirements.txt"
if %errorlevel% neq 0 (
    echo Error: Failed to install Python dependencies. Please make sure Python is added to PATH.
    pause
    exit /b %errorlevel%
)

echo.
echo Displaying script usage and available options:
echo --------------------------------------------------
python "%~dp0mp4_to_sprite.py" --help
echo --------------------------------------------------
echo.
echo Example usage:
echo python mp4_to_sprite.py -i input.mp4 -o sprite_sheet.png --start 0.0 --end 2.0 --fps 15 --plist --json
echo.
pause
