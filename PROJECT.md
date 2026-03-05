# 🐷 양돈농장 관리 시스템 — 프로젝트 문서

> 다중 농장 지원 및 역할 기반 권한 관리를 갖춘 양돈농장 통합 운영 프로그램  
> 기술 스택: **Go API (chi router)** + **Next.js 14 (App Router)** + **PostgreSQL**

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [디렉토리 구조](#3-디렉토리-구조)
4. [실행 방법](#4-실행-방법)
5. [아키텍처](#5-아키텍처)
6. [주요 기능](#6-주요-기능)
7. [데이터베이스 구조](#7-데이터베이스-구조)
8. [API 라우트](#8-api-라우트)
9. [권한 체계](#9-권한-체계)
10. [문서 목록](#10-문서-목록)

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 프로젝트명 | 양돈농장 운영 관리 시스템 |
| 버전 | 1.0.0 |
| 목적 | 다수 양돈농장의 일정, 돈군, 재고, 시설 구조를 통합 관리 |
| 주요 사용자 | 농장주, 관리자, 수의사, 사육사, 컨설턴트 |

**핵심 설계 원칙**
- 일정(계획)과 실행(완료)을 명확히 분리
- 분만 완료 시 돈군 자동 생성
- 이동 완료 시 위치/두수/재고를 트랜잭션으로 동시 반영
- 수정 최소화, 이력(원장)은 누적 보존
- `pig_groups`에는 현재 상태만 저장, 이동 이력은 별도 테이블로 분리

---

## 2. 기술 스택

### Backend
| 항목 | 내용 |
|------|------|
| 언어 | Go 1.22 |
| 프레임워크 | [chi v5](https://github.com/go-chi/chi) |
| DB 드라이버 | pgx v5 (pgxpool) |
| 인증 | JWT (golang-jwt/jwt v5) + bcrypt |
| 환경변수 | godotenv |

### Frontend
| 항목 | 내용 |
|------|------|
| 프레임워크 | Next.js 14 (App Router) |
| 언어 | TypeScript |
| 스타일 | globals.css (Tailwind CSS 계열 추정) |

### 인프라
| 항목 | 내용 |
|------|------|
| DB | PostgreSQL (JSONB 활용) |
| 로컬 실행 | Windows .bat 스크립트 |
| 포트 | Go API: 8080 / Next.js: 3000 |

---

## 3. 디렉토리 구조

```
webviewer/
├── backend/                    # Go API 서버
│   ├── cmd/api/main.go         # 진입점 (chi 라우터 설정)
│   ├── internal/
│   │   ├── config/             # 환경 변수 로드 (Config 구조체)
│   │   ├── db/                 # PostgreSQL 연결 풀 (pgxpool)
│   │   ├── handlers/           # HTTP 핸들러 (기능별 파일 분리)
│   │   │   ├── auth.go         # 로그인/로그아웃
│   │   │   ├── farms.go        # 농장 CRUD
│   │   │   ├── farm_structure.go        # 농장 시설 구조 (건물→동→방→칸)
│   │   │   ├── farm_facilities.go       # 시설 조회
│   │   │   ├── farm_pig_groups.go       # 돈군 관리
│   │   │   ├── farm_pig_movement_events.go  # 돈군 이동 이력
│   │   │   ├── farm_section_inventory.go    # 섹션별 재고 원장
│   │   │   ├── farm_schedule.go             # 일정 실행 (schedule_executions)
│   │   │   ├── farm_schedule_executions.go  # 일정 실행 상세
│   │   │   ├── farm_schedule_masters.go     # 일정 마스터
│   │   │   ├── farm_schedule_work_plans_master.go  # 작업계획 마스터
│   │   │   ├── farm_bootstrap_opening.go    # 농장 초기 개설 (읽기)
│   │   │   ├── farm_bootstrap_opening_write.go     # 농장 초기 개설 (쓰기)
│   │   │   ├── schedule_bases.go            # 기초 일정 (전역)
│   │   │   ├── schedule_divisions.go        # 구분 정의
│   │   │   ├── schedule_work_types.go       # 작업유형 정의
│   │   │   ├── schedule_work_plans.go       # 작업계획 (전역)
│   │   │   ├── structure_templates.go       # 시설 템플릿 (전역)
│   │   │   ├── admin.go / admin_*.go        # Super Admin 기능
│   │   │   ├── user.go / me.go              # 사용자 정보
│   │   │   └── jsonb.go                     # JSONB 유틸리티
│   │   └── middleware/         # CORS, 인증 미들웨어
│   ├── bin/api                 # 빌드된 실행파일
│   ├── go.mod
│   └── build.bat / run.bat
│
├── frontend/                   # Next.js 프론트엔드
│   ├── app/
│   │   ├── layout.tsx          # 루트 레이아웃
│   │   ├── page.tsx            # 루트 페이지 (리다이렉트)
│   │   ├── login/              # 로그인 페이지
│   │   ├── select-farm/        # 농장 선택 페이지
│   │   ├── dashboard/          # 대시보드 (Super Admin)
│   │   └── farm/               # 농장 기능 영역
│   │       ├── layout.tsx      # 농장 레이아웃 (사이드바 등)
│   │       ├── page.tsx        # 농장 홈
│   │       ├── dashboard/      # 농장 대시보드
│   │       ├── schedule/       # 일정 관리 (주간 캘린더)
│   │       ├── move/           # 돈군 이동
│   │       ├── report/         # 보고서
│   │       └── admin/          # 농장 관리자 설정
│   │           ├── page.tsx
│   │           ├── layout.tsx
│   │           ├── schedule-masters/   # 일정 마스터 관리
│   │           ├── staff/              # 직원 관리
│   │           └── devices/            # 기기 관리
│   ├── components/
│   │   ├── NonAdminShell.tsx   # 일반 사용자 레이아웃 쉘
│   │   └── TopHeader.tsx       # 상단 헤더
│   ├── lib/                    # 공통 유틸리티/API 클라이언트
│   ├── certificates/           # HTTPS 로컬 인증서
│   └── next.config.js / tsconfig.json
│
├── docs/                       # 설계 문서 (상세 목록: §10)
├── scripts/                    # DB 마이그레이션 SQL + 유틸
├── start.bat                   # 전체 서버 시작
├── stop.bat                    # 전체 서버 종료
├── start-servers.bat           # 서버 관리 메뉴 (HTTP/HTTPS 선택)
└── package.json                # 루트 (Node 유틸: pg 의존성)
```

---

## 4. 실행 방법

### 서버 시작

**Windows (권장)**
```
start-servers.bat 더블클릭 → 1 (HTTP) 또는 2 (HTTPS) 선택
```

**터미널 직접 실행**
```bash
# 터미널 1: Go API (포트 8080)
cd backend
bin\api.exe

# 터미널 2: Next.js (포트 3000)
cd frontend
npm install     # 최초 1회
npm run dev
```

### 접속 주소

| 용도 | 주소 |
|------|------|
| 사용자 접속 (프론트엔드) | http://localhost:3000 |
| Go API (내부) | http://localhost:8080 |

### HTTPS 로컬 개발

1. `start-servers.bat` → **2. 시작 (HTTPS)** 선택  
2. `frontend/.env.local` 에 추가:
   ```
   NEXT_PUBLIC_API_URL=
   ```
   (비워두면 Next.js 프록시 `/api`로 요청 → 혼합 콘텐츠 문제 해결)
3. https://localhost:3000 접속 (자체 서명 인증서 경고 → 고급 → 접속)

### 서버 종료
```
stop.bat 더블클릭
```

---

## 5. 아키텍처

```
[브라우저]
    │ HTTPS/HTTP
    ▼
[Next.js :3000]  ──프록시(/api)──▶  [Go chi API :8080]
    │                                       │
    │                               ┌───────▼──────┐
    │                               │  PostgreSQL   │
    │                               │  (JSONB 활용) │
    └───────────────────────────────┴──────────────┘
```

- **인증 흐름**: 로그인 → JWT 발급 → 이후 요청에 Bearer 토큰 포함
- **멀티 농장**: 사용자 1명이 여러 농장 소속 가능, 로그인 후 농장 선택(`/select-farm`)
- **데이터 스코프**: 전역 정의 테이블(`farmId IS NULL`) + 농장별 데이터(`farmId` 지정)

---

## 6. 주요 기능

### 6.1 회원 관리
- 회원가입 / 로그인 / 로그아웃
- bcrypt 비밀번호 암호화
- JWT 기반 세션 인증
- 첫 번째 사용자 자동 `super_admin` 부여

### 6.2 Super Admin
- **대시보드**: 시스템 전체 현황 (회원, 농장, 테이블 통계)
- **DB 구조 조회**: 모든 테이블·컬럼 정보 실시간 확인
- **회원 관리**: 사용자 목록, 활성/비활성 토글, 삭제
- **농장 관리**: 등록된 농장 목록 및 정보 조회
- **기초 일정 관리**: 전역 일정 정의(시설·구분·기준·작업유형) 설정

### 6.3 다중 농장 지원
- 한 사용자가 여러 농장에 소속 가능
- 농장별로 다른 역할 부여
- 로그인 후 `/select-farm`에서 접속할 농장 선택

### 6.4 시설 구조 관리
건물(barn) → 동(section_group) → 방(room) → 칸(section) 계층 구조

- 시설별 타입: 교배사, 임신사, 분만사, 자돈사 등
- `structure_templates` 기반 전역 시설 타입 정의

### 6.5 일정 관리 (`/farm/schedule`)
- **주간 캘린더 뷰**: 칸(section) × 날짜별 예정/완료 표시
- **예정 등록**: 작업 일정 사전 등록
- **바로 완료**: 예정 없이 즉시 실행 완료 기록
- **완료 처리**: 등록된 예정을 완료로 전환
- **분만 완료**: 돈군 자동 생성 연동
- **이동 완료**: 위치/두수/재고 트랜잭션 반영

**일정 계층 구조**:
```
structure_templates (대상장소/시설 타입)
    └─ schedule_sortation_definitions → schedule_sortations (구분)
           └─ schedule_jobtype_definitions → schedule_jobtypes (작업유형)
                  └─ schedule_criteria_definitions → schedule_criterias (기준)
                         └─ schedule_work_plans (기초 일정 정의)
                                └─ schedule_executions (실제 실행 기록)
```

### 6.6 돈군·개체·재고 관리
- `pig_groups`: 현재 두수/위치/상태만 보관
- `pig_movement_events` + `pig_movement_lines`: 이동 이력 전체 보존
- `section_inventory_ledger`: 칸별 재고 원장 (IN/OUT 누적)
- `section_inventory_balance`: 칸별 현재 재고 (upsert)
- 운영 초기값은 `/farm/admin` → 농장 구조 설정 → 초기입력에서 섹션 단위로 입력

### 6.7 농장 관리자 설정 (`/farm/admin`)
- 직원 관리
- 기기/IoT 장치 관리
- 일정 마스터 관리
- 농장 구조 설정 (시설 등록 + 초기 돈군 입력)

---

## 7. 데이터베이스 구조

### 주요 테이블 목록

| 테이블 | 설명 |
|--------|------|
| `users` | 사용자 계정 |
| `farms` | 농장 기본 정보 (UUID PK) |
| `farm_user_roles` | 사용자-농장-역할 매핑 |
| `farm_barns` | 건물 (시설 구조 1계층) |
| `farm_section_groups` | 동 (시설 구조 2계층) |
| `farm_rooms` | 방 (시설 구조 3계층) |
| `farm_sections` | 칸 (시설 구조 4계층, 최소 운영 단위) |
| `sows` | 모돈 정보 |
| `pig_groups` | 돈군 현재 상태 (두수, 위치, 상태) |
| `pig_movement_events` | 돈군 이동 헤더 |
| `pig_movement_lines` | 돈군 이동 상세 라인 |
| `section_inventory_ledger` | 섹션별 재고 원장 (이력 누적) |
| `section_inventory_balance` | 섹션별 현재 재고 |
| `structure_templates` | 전역 시설 타입 정의 |
| `schedule_sortation_definitions` | 구분 정의 (전역) |
| `schedule_sortations` | 시설별 구분 목록 |
| `schedule_jobtype_definitions` | 작업유형 정의 (전역) |
| `schedule_jobtypes` | 구분별 작업유형 목록 |
| `schedule_criteria_definitions` | 기준 정의 (전역) |
| `schedule_criterias` | 작업유형별 기준 목록 |
| `schedule_work_plans` | 기초 일정 (시설+구분+작업유형+기준 조합) |
| `schedule_executions` | 실제 일정 실행 기록 (예정/완료) |

### 데이터 스코프 패턴
```sql
-- 전역 공통 데이터
WHERE farm_id IS NULL

-- 농장별 데이터
WHERE farm_id = $farmId
```

### JSONB 활용
복잡한 조건/콘텐츠는 JSONB 컬럼에 저장 (`criteria_content`, `work_content` 등).  
→ 자세한 컨벤션: [backend_jsonb_read_convention.md](docs/backend_jsonb_read_convention.md)

---

## 8. API 라우트

### 인증
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/auth/login` | 로그인 (JWT 발급) |
| POST | `/api/auth/logout` | 로그아웃 |
| GET | `/api/me` | 현재 사용자 정보 |

### 농장
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/farms` | 내 농장 목록 |
| POST | `/api/farms` | 농장 등록 |
| GET | `/api/farms/:id` | 농장 상세 |
| GET | `/api/farms/:id/structure` | 농장 시설 구조 |
| GET | `/api/farms/:id/pig-groups` | 돈군 목록 |
| GET | `/api/farms/:id/schedule` | 일정 목록 |

### 일정 (전역 기초 정의)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/structure-templates` | 시설 템플릿 목록 |
| GET/POST | `/api/schedule-bases` | 구분/작업유형/기준 기초 |
| GET/POST | `/api/schedule-work-plans` | 기초 일정 작업계획 |

### Super Admin
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/admin/stats` | 대시보드 통계 |
| GET | `/api/admin/users` | 사용자 목록 |
| GET | `/api/admin/farms` | 전체 농장 목록 |

> 전체 라우트는 `backend/cmd/api/main.go` 참조

---

## 9. 권한 체계

| 역할 | 영문 | 설명 |
|------|------|------|
| 최고 관리자 | `super_admin` | 전체 시스템 관리 (Super Admin 페이지 접근) |
| 농장주 | `owner` | 농장 전체 관리 |
| 관리자 | `manager` | 일일 운영 관리 |
| 수의사 | `veterinarian` | 건강 관리 |
| 사육사 | `breeder` | 사육 관리 |
| 일반 직원 | `staff` | 기본 작업 |
| 컨설턴트 | `consultant` | 읽기 전용 |

- `super_admin`은 시스템 전체에 적용되는 전역 역할
- 나머지 역할은 **농장별로** 부여 (한 사용자가 농장A에서는 `owner`, 농장B에서는 `staff` 가능)

---

## 10. 문서 목록

### 실행/운영
| 문서 | 설명 |
|------|------|
| [docs/RUN.md](docs/RUN.md) | 서버 실행 가이드 (HTTP/HTTPS) |
| [README.md](README.md) | 프로젝트 개요 및 빠른 시작 |

### 데이터베이스 설계
| 문서 | 설명 |
|------|------|
| [docs/FARM_TABLE_STRUCTURE.md](docs/FARM_TABLE_STRUCTURE.md) | farms 테이블 상세 컬럼 정의 |
| [docs/facility_structure_overview.md](docs/facility_structure_overview.md) | 시설 구조 (건물→동→방→칸) 개요 |
| [docs/backend_jsonb_read_convention.md](docs/backend_jsonb_read_convention.md) | JSONB 읽기/쓰기 컨벤션 |

### 일정 관리 설계
| 문서 | 설명 |
|------|------|
| [docs/일정관리_페이지_계획서.md](docs/일정관리_페이지_계획서.md) | 일정 관리 페이지 전체 계획 |
| [docs/schedule_tables_structure.md](docs/schedule_tables_structure.md) | 일정 관련 테이블 구조 |
| [docs/일정_칼럼_구조_정리.md](docs/일정_칼럼_구조_정리.md) | 일정 컬럼 구조 정리 |
| [docs/schedule_add_documentation.md](docs/schedule_add_documentation.md) | 예정 추가 API 문서 |
| [docs/schedule_executions_rollout_checklist.md](docs/schedule_executions_rollout_checklist.md) | 일정 실행 롤아웃 체크리스트 |
| [docs/schedule_criteria_recurrence_design.md](docs/schedule_criteria_recurrence_design.md) | 기준 반복 주기 설계 (미구현, 차후 예정) |
| [docs/schedule_criteria_master_table_recommendation.md](docs/schedule_criteria_master_table_recommendation.md) | 기준 마스터 테이블 권고안 |
| [docs/schedule_work_plans_table_redesign.md](docs/schedule_work_plans_table_redesign.md) | 작업계획 테이블 재설계 |
| [docs/schedule_work_plans_table_columns.md](docs/schedule_work_plans_table_columns.md) | 작업계획 테이블 컬럼 |
| [docs/schedule_work_plans_save_mapping.md](docs/schedule_work_plans_save_mapping.md) | 작업계획 저장 매핑 |
| [docs/schedule_work_plans_criteria_content_centralized.md](docs/schedule_work_plans_criteria_content_centralized.md) | 기준 콘텐츠 중앙화 |
| [docs/일정마스터_이동_대상시설_추천.md](docs/일정마스터_이동_대상시설_추천.md) | 이동 대상 시설 추천 로직 |

### 돈군·개체·재고 관리
| 문서 | 설명 |
|------|------|
| [docs/돈군_개체_재고_MVP_기준서.md](docs/돈군_개체_재고_MVP_기준서.md) | MVP 설계 기준서 (핵심 원칙) |
| [docs/돈군_개체_재고_MVP_작업목록.md](docs/돈군_개체_재고_MVP_작업목록.md) | MVP 구현 작업 목록 |
| [docs/예정작업_등록_화면흐름_설계.md](docs/예정작업_등록_화면흐름_설계.md) | 예정 작업 등록 화면 흐름 |

### DB 마이그레이션 스크립트
> 모든 SQL 스크립트: [scripts/](scripts/) 폴더

주요 스크립트:
| 스크립트 | 설명 |
|----------|------|
| `create_farm_facilities_tables.sql` | 농장 시설 구조 테이블 생성 |
| `create_pig_group_inventory_mvp_tables.sql` | 돈군/재고 MVP 테이블 생성 |
| `create_schedule_work_plans_table.sql` | 작업계획 테이블 생성 |
| `schedule_hierarchy_redesign.sql` | 일정 계층 구조 재설계 |
| `unify_schedule_tables_with_farm_scope.sql` | 일정 테이블 농장 스코프 통합 |
