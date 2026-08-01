@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ===================================================
echo   MovieCreator 自動セットアップ (Automated Setup)
echo ===================================================
echo.

echo [1/2] Node.js 依存ライブラリのインストール (npm install)...
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [エラー] Node.js (npm) が見つかりません。
    echo https://nodejs.org/ から Node.js をインストールしてください。
    echo.
    pause
    exit /b 1
)

call npm install
if %errorlevel% neq 0 (
    echo [警告] npm install 中にエラーが発生しました。
) else (
    echo [成功] Node.js 依存ライブラリのセットアップが完了しました。
)
echo.

echo [2/2] Python 依存ライブラリのインストール (pip install)...
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [注意] Python が見つかりません。Pythonツールを使用する場合は Python をインストールしてください。
) else (
    pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo [警告] pip install 中にエラーが発生しました。
    ) else (
        echo [成功] Python 依存ライブラリのセットアップが完了しました。
    )
)
echo.

echo ===================================================
echo   セットアップが完了しました！
echo   ・メインアプリ起動: run_app.bat
echo   ・パイプラインGUI起動: run_pipeline_gui.bat
echo   ・Sprite Studio起動: open_sprite_studio.bat
echo ===================================================
echo.
pause
