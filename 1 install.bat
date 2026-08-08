@echo off
chcp 65001 > nul
title HyperHotkey Complete Installer
echo ===================================================
echo   HyperHotkey - One-Click Installer (Full Setup)
echo ===================================================
echo.
echo [1/3] Installing Node.js packages...
call npm install --ignore-scripts
echo.
echo [2/3] Injecting Prebuilt Mouse Engine...
if not exist "node_modules\global-mouse-events\build\Release" mkdir "node_modules\global-mouse-events\build\Release"
if exist "prebuilt\global_mouse_events.node" (
    copy /Y "prebuilt\global_mouse_events.node" "node_modules\global-mouse-events\build\Release\global_mouse_events.node" > nul
    echo [SUCCESS] Mouse Engine injected successfully!
)
echo.
echo [3/3] Installing Playwright Browsers...
call npx playwright install
echo.
echo ===================================================
echo [SUCCESS] INSTALLATION COMPLETE!
echo You can now run "HyperHotkey Launcher.bat" or "3 start.bat"
echo ===================================================
pause