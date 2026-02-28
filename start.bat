@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 서버 시작 중...
echo.
echo   모든 서버를 새 창에서 시작합니다.
echo   (Go API :8080, Next.js :3000)
echo.
node scripts/server-manager.js start-window
timeout /t 2 >nul
exit
