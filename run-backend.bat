@echo off
chcp 65001 >nul
cd /d "%~dp0backend"
title Go API :8080
echo.
echo  Backend starting: http://localhost:8080
echo  Stop: Ctrl+C in this window
echo  Need: PostgreSQL running, .env POSTGRES_* correct
echo.
set PORT=8080
go run ./cmd/api
echo.
echo  [Backend ended. Exit code: %ERRORLEVEL%]
pause
