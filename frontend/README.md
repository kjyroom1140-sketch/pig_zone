# 양돈농장 관리 시스템 - Next.js 프론트엔드

Go API(백엔드)와 연동하는 Next.js 14 (App Router) 프론트엔드입니다.

## 요구 사항

- Node.js 18+
- Go API 서버 실행 중 (기본 `http://localhost:8080`)

## 설정

- `NEXT_PUBLIC_API_URL`: Go API 주소 (기본 `http://localhost:8080`). `.env.local`에 설정 가능.

## 실행

```bash
cd frontend
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속. 로그인 시 Go API(`/api/auth/login`)로 인증합니다.

## 라우트

| 경로 | 설명 |
|------|------|
| `/` | `/login`으로 리다이렉트 |
| `/login` | 로그인 |
| `/admin` | 관리자 대시보드 (system_admin) |
| `/select-farm` | 농장 선택 (일반 사용자) |
