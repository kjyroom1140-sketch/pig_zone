# 양돈농장 관리 시스템 - Go API

백엔드 API 서버 (Go). DB는 PostgreSQL을 사용합니다. 프론트는 Next.js (frontend/)에서 http://localhost:3000 로 접속합니다.

## 요구 사항

- Go 1.21+
- PostgreSQL (기존 프로젝트와 동일 DB)

### Go 설치 직후

- **PATH 반영**: Go를 방금 설치했다면 **새 터미널**을 열거나 PC를 한 번 재시작한 뒤 `go version`으로 확인하세요.
- **빌드 스크립트**: `backend\build.bat`을 더블클릭하거나 터미널에서 실행하면 `go mod tidy` 후 `api.exe`를 빌드합니다. (`run.bat`으로 실행)

## 환경 변수

프로젝트 루트의 `.env`를 사용하거나 다음을 설정하세요.

| 변수 | 설명 | 기본값 |
|------|------|--------|
| PORT | API 서버 포트 | 8080 |
| POSTGRES_HOST | DB 호스트 | localhost |
| POSTGRES_PORT | DB 포트 | 5432 |
| POSTGRES_DB | DB 이름 | pig_farm_db |
| POSTGRES_USER | DB 사용자 | postgres |
| POSTGRES_PASSWORD | DB 비밀번호 | postgres |
| JWT_SECRET | JWT 서명 키 (프로덕션에서 반드시 변경) | your-jwt-secret-change-in-production |
| CORS_ORIGINS | CORS 허용 오리진 | http://localhost:3000 |

연결 설정 오버라이드 파일 경로(선택):

- `CONFIG_DIR`: 프로젝트 루트 디렉터리. 미설정 시 현재 작업 디렉터리 기준 `config/connection-override.json` 사용.

## 빌드 및 실행

```bash
# 프로젝트 루트에서 (config/ 경로 맞추기 위해)
cd backend
go mod tidy
go build -o api.exe ./cmd/api   # Windows
# go build -o api ./cmd/api     # Linux/macOS

# 실행 (.env는 프로젝트 루트에 있으면 상위에서 로드하거나 export 후)
./api.exe   # 또는 ../.env 로드 후
```

프로젝트 루트에서 실행하려면:

```bash
cd d:\webviewer
set POSTGRES_*=...   # 또는 .env 로드
backend\api.exe
```

## API 엔드포인트 (구현됨)

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| POST | /api/auth/login | 로그인 (JWT 쿠키 + JSON) | - |
| POST | /api/auth/logout | 로그아웃 | - |
| GET | /api/auth/me | 현재 사용자 정보 | JWT |
| GET | /api/admin/settings | 시스템 설정 | 슈퍼관리자 |
| GET | /api/admin/farms | 농장 목록 | 슈퍼관리자 |
| POST | /api/admin/users | 회원 추가 | 슈퍼관리자 |
| PUT | /api/admin/users/:userId | 회원 수정 | 슈퍼관리자 |
| PATCH | /api/admin/users/:userId/toggle-active | 활성/비활성 토글 | 슈퍼관리자 |
| DELETE | /api/admin/users/:userId | 회원 삭제 | 슈퍼관리자 |
| GET | /api/admin/settings/connection | 연결 설정 조회 | 슈퍼관리자 |
| PUT | /api/admin/settings/connection | 연결 설정 저장 | 슈퍼관리자 |
| GET | /api/breeds | 품종 목록 | 인증 |

JWT는 쿠키 `token` 또는 `Authorization: Bearer <token>` 헤더로 전달합니다.

## 디렉터리 구조

```
backend/
├── cmd/api/           # 진입점 main.go
├── internal/
│   ├── config/        # 환경 설정
│   ├── db/            # PostgreSQL 연결
│   ├── handlers/      # HTTP 핸들러 (auth, admin, me, user)
│   └── middleware/    # JWT 인증, 슈퍼관리자 체크
├── go.mod
└── README.md
```

## DB 테이블

기존 Sequelize 모델과 동일한 `users` 테이블을 사용합니다. 컬럼명은 Sequelize 기본(camelCase) 기준으로, PostgreSQL에서는 따옴표로 참조합니다.

