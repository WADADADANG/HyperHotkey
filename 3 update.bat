@echo off
chcp 65001 > nul
echo ===================================================
echo   Updating HyperHotkey to the latest version...
echo ===================================================
echo.

where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [Notice] Git is not installed on your computer.
    echo.
    echo To update automatically, please install Git from: https://git-scm.com/
    echo Or download the latest ZIP file directly from:
    echo https://github.com/WADADADANG/HyperHotkey
    echo.
    echo ===================================================
    pause
    exit /b
)

echo [1/4] Pulling latest code from GitHub...
git stash >nul 2>&1
git pull
echo.
echo [2/4] Updating Node.js dependencies...
call npm install --ignore-scripts
echo.
echo [3/4] Injecting Prebuilt Mouse Engine...
if not exist "node_modules\global-mouse-events\build\Release" mkdir "node_modules\global-mouse-events\build\Release"
if exist "prebuilt\global_mouse_events.node" (
    copy /Y "prebuilt\global_mouse_events.node" "node_modules\global-mouse-events\build\Release\global_mouse_events.node" > nul
    echo [SUCCESS] Mouse Engine updated successfully!
)
echo.
echo [4/4] Updating Playwright browser files...
call npx playwright install
echo.
echo ===================================================
echo [SUCCESS] Update complete! You can now run 2 start.bat
echo ===================================================
pause
