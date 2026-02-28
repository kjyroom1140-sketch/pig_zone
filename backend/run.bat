@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

if not exist api.exe (
    echo api.exe가 없습니다. build.bat을 먼저 실행하세요.
    exit /b 1
)

echo Go API 서버 시작 (종료: Ctrl+C)
echo 포트 8080, DB는 .env 또는 상위 폴더 .env 사용
echo.
call api.exe
exit /b 0
