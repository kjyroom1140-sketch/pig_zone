# 실행 가이드

현재 스택: **Go API (8080)** + **Next.js (3000)**. 브라우저 접속은 Next에서만 합니다.

## 1. 서버 시작

### 방법 A: 서버 관리 (권장)
1. 프로젝트 루트에서 **start-servers.bat** 더블클릭
2. **1** 입력 → Go API + Next 시작 (HTTP) / **2** 입력 → HTTPS로 시작
3. 브라우저에서 **http://localhost:3000** 또는 **https://localhost:3000** 접속

### 방법 B: 터미널에서 직접
```bash
# 터미널 1: Go API
cd backend
api.exe

# 터미널 2: Next.js
cd frontend
npm install   # 최초 1회
npm run dev   # 포트 3000 (package.json scripts 확인)
```
→ **http://localhost:3000** 접속

## 2. 접속 주소

| 용도 | 주소 |
|------|------|
| 사용자 접속 | http://localhost:3000 |
| API (내부) | http://localhost:8080 |

## 2-1. HTTPS로 로컬 개발하기

사이트를 **https://localhost:3000** 으로 띄워서 개발하려면:

1. **서버 관리에서 HTTPS로 시작**
   - **start-servers.bat** 실행 후 메뉴에서 **2. 시작 (HTTPS)** 선택  
   - 또는 터미널: `node scripts/server-manager.js start-https`
   - 브라우저는 **https://localhost:3000** 으로 열립니다 (자체 서명 인증서라 첫 접속 시 경고가 나올 수 있음 → “고급” → “접속” 등으로 진행).

2. **API가 동일 오리진으로 가도록 설정 (필수)**
   - HTTPS 페이지에서 `http://localhost:8080` 호출은 브라우저가 **혼합 콘텐츠**로 차단합니다.
   - `frontend/.env.local` 에 아래 한 줄을 넣어 API를 Next 프록시(`/api`)로 보내세요.
     ```bash
     NEXT_PUBLIC_API_URL=
     ```
   - 이렇게 하면 프론트는 `https://localhost:3000/api/...` 로만 요청하고, Next가 `http://localhost:8080/api/...` 로 넘겨줍니다.

3. **프론트만 HTTPS로 띄우기**
   ```bash
   cd frontend
   npm run dev:https
   ```
   - 접속: **https://localhost:3000** (Go API는 별도로 8080에서 실행해야 함).

## 3. 종료

- 서버 관리 메뉴에서 **3. 종료** 선택, 또는 **stop.bat** 더블클릭 → 8080, 3000 포트 프로세스 종료
- 또는 각 서버 창에서 Ctrl+C

## 4. 환경

- PostgreSQL 실행 필요. 연결 정보는 `backend` 쪽 `.env` 또는 프로젝트 루트 `.env` 참고.
- Next API 베이스 URL: 환경변수 `NEXT_PUBLIC_API_URL` (기본 `http://localhost:8080`).

## 4-1. 백엔드(Go API)가 안 뜰 때

1. **백엔드만 실행해서 오류 확인**  
   프로젝트 루트에서 **run-backend.bat** 더블클릭 → 콘솔에 나오는 메시지를 확인하세요.

2. **자주 나오는 원인**
   - **`DB connection: ...` / `db ping`**  
     → **PostgreSQL이 실행 중인지** 확인.  
     → 프로젝트 루트 또는 `backend` 폴더의 **.env** 에서  
       `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` 가 실제 DB와 맞는지 확인.
   - **`go: command not found`**  
     → [Go 설치](https://go.dev/dl/) 후 터미널을 다시 열고 `go version` 확인.
   - **`listen tcp :8080: bind: Only one usage...`**  
     → 8080 포트를 쓰는 다른 프로그램 종료 후 다시 실행.

3. **터미널에서 직접 실행 (오류 보기 좋음)**
   ```bash
   cd backend
   set PORT=8080
   go run ./cmd/api
   ```
   여기서 나오는 빨간 오류 메시지를 그대로 확인하면 원인 파악에 도움이 됩니다.

## 5. 농장 정보 API 확인 (farms 테이블)

농장 정보는 **farms** 테이블에서 조회됩니다.

- **API**: `GET /api/farms/:farmId` (로그인 필요, 해당 농장에 대한 user_farms 권한 필요)
- **백엔드**: `backend/internal/handlers/farms.go` 의 `FarmGetOne` — `farms` 테이블의 `id`, `farmName`, `farmCode`, `ownerId`, `status`, `createdAt` 컬럼을 조회합니다.
- **화면 확인**: 로그인 → 농장 선택(또는 상단 농장 이름 클릭 후 선택) → **환경 설정** → **농장 정보** 에서 농장명·농장코드·상태·농장 ID가 정상 표시되면 정상 조회된 것입니다.
