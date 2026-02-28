@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

where go >nul 2>&1
if errorlevel 1 (
    echo [오류] 'go' 명령을 찾을 수 없습니다.
    echo Go를 방금 설치했다면 터미널을 새로 열거나 PC를 한 번 재시작한 뒤 다시 실행하세요.
    echo 또는 Go 설치 경로를 PATH에 추가했는지 확인하세요. 예: C:\Program Files\Go\bin
    exit /b 1
)

echo Go 버전:
go version
echo.

echo 모듈 정리 중...
go mod tidy
if errorlevel 1 exit /b 1

echo 빌드 중...
go build -o api.exe ./cmd/api
if errorlevel 1 (
    echo 빌드 실패.
    exit /b 1
)

echo.
echo 빌드 완료: backend\api.exe
echo 실행: backend\api.exe
exit /b 0
