@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 서버 관리 (시작/종료)
node scripts/server-manager.js
pause
