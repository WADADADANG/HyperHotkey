@echo off
echo ===================================================
echo 🚀 Updating HyperHotkey to the latest version...
echo ===================================================
echo.

where git >nul 2>nul
if %errorlevel% neq 0 (
    echo ⚠️  [Notice] Git is not installed on your computer.
    echo.
    echo 👉 To update automatically, please install Git from: https://git-scm.com/
    echo 👉 Or download the latest ZIP file directly from:
    echo    https://github.com/WADADADANG/HyperHotkey
    echo.
    echo ===================================================
    pause
    exit /b
)

echo [1/3] Pulling latest code from GitHub...
git stash >nul 2>&1
git pull
echo.
echo [2/3] Updating Node.js dependencies...
call npm install
echo.
echo [3/3] Updating Playwright browser files...
call npx playwright install
echo.
echo ===================================================
echo ✅ Update complete! You can now run 3 start.bat
echo ===================================================
pause
