@echo off
chcp 65001 > nul
title Installing HyperHotkey Dependencies (Full Mouse & Keyboard Support)...
echo ===================================================
echo   Installing HyperHotkey Dependencies
echo ===================================================
echo.
echo [1/2] Installing npm packages...
call npm install --ignore-scripts
echo.
echo [2/2] Injecting Prebuilt Mouse Engine (No Visual Studio Required)...
if not exist "node_modules\global-mouse-events\build\Release" mkdir "node_modules\global-mouse-events\build\Release"
if exist "prebuilt\global_mouse_events.node" (
    copy /Y "prebuilt\global_mouse_events.node" "node_modules\global-mouse-events\build\Release\global_mouse_events.node" > nul
    echo [SUCCESS] Mouse Engine injected successfully!
) else (
    echo [NOTE] Prebuilt Mouse Engine file not found.
)
echo.
echo Installation completed successfully!
pause