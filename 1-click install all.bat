@echo off
chcp 65001 > nul
title HyperHotkey Complete Installer
echo ===================================================
echo   HyperHotkey - One-Click Installer
echo ===================================================
echo.
echo [1/2] Installing Node.js packages (Bypassing C++ compiler)...
call npm install --ignore-scripts
echo.
echo [2/2] Installing Playwright Browsers...
call npx playwright install
echo.
echo ===================================================
echo   INSTALLATION COMPLETE! 
echo   Double-click "HyperHotkey Launcher.bat" to start!
echo ===================================================
echo.
pause
