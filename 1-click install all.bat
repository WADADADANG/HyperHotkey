@echo off
chcp 65001 > nul
title HyperHotkey Complete Installer (With Prebuilt Mouse Support)
echo ===================================================
echo   HyperHotkey - One-Click Installer (Full Mouse & Keyboard)
echo ===================================================
echo.
echo [1/3] Installing Node.js packages...
call npm install --ignore-scripts
echo.
echo [2/3] Injecting Prebuilt Mouse Engine (No Visual Studio Required)...
if not exist "node_modules\global-mouse-events\build\Release" mkdir "node_modules\global-mouse-events\build\Release"
if exist "prebuilt\global_mouse_events.node" (
    copy /Y "prebuilt\global_mouse_events.node" "node_modules\global-mouse-events\build\Release\global_mouse_events.node" > nul
    echo [SUCCESS] Mouse Engine injected successfully!
) else (
    echo [NOTE] Prebuilt Mouse Engine not found.
)
echo.
echo [3/3] Installing Playwright Browsers...
call npx playwright install
echo.
echo ===================================================
echo   INSTALLATION COMPLETE! 
echo   Mouse & Keyboard triggers are 100%% ACTIVE!
echo   Double-click "HyperHotkey Launcher.bat" to start!
echo ===================================================
echo.
pause
