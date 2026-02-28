@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 서버 종료
echo.
node scripts/server-manager.js stop
echo.
pause
