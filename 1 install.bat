@echo off
chcp 65001 > nul
title Installing HyperHotkey Dependencies...
echo ===================================================
echo   Installing HyperHotkey Dependencies (Fast Mode)
echo ===================================================
echo.
echo Running npm install --ignore-scripts...
call npm install --ignore-scripts
echo.
if %errorlevel% equ 0 (
    echo [SUCCESS] Dependencies installed successfully!
) else (
    echo [ERROR] Installation failed. Please check your internet connection or Node.js installation.
)
echo.
pause