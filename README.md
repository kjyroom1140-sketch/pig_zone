# 🐷 양돈농장 관리 시스템

다중 농장 지원 및 역할 기반 권한 관리를 갖춘 양돈농장 운영 관리 프로그램입니다.

## ✨ 완성된 기능

### 1. 회원 관리 시스템
- ✅ 회원가입 / 로그인 / 로그아웃
- ✅ 비밀번호 암호화 (bcrypt)
- ✅ 세션 기반 인증
- ✅ 첫 번째 사용자는 자동으로 최고 관리자(super_admin) 권한 부여

### 2. 최고 관리자 페이지
- ✅ **대시보드**: 시스템 전체 현황 (회원, 농장, 테이블 통계)
- ✅ **데이터베이스 구조**: 모든 테이블과 컬럼 정보 실시간 조회
- ✅ **회원 관리**: 사용자 목록, 활성/비활성 토글, 삭제
- ✅ **농장 관리**: 등록된 농장 목록 및 정보 조회
- ✅ **시스템 설정**: 기본 설정 정보 확인

### 3. 다중 농장 지원
- ✅ 한 사용자가 여러 농장에 소속 가능
- ✅ 농장별로 다른 역할 부여 가능
- ✅ 농장 전환 기능 (추후 구현)

### 4. 역할 기반 권한 관리
- **super_admin** (최고 관리자): 모든 시스템 관리
- **owner** (농장주): 농장 전체 관리
- **manager** (관리자): 일일 운영 관리
- **veterinarian** (수의사): 건강 관리
- **breeder** (사육사): 사육 관리
- **staff** (일반 직원): 기본 작업
- **consultant** (컨설턴트): 읽기 전용

## 🚀 빠른 시작

### 1. 서버 실행

```bash
node server.js
```

서버 주소: `http://localhost:3000`

### 2. 최고 관리자 로그인

```
사용자명: admin
비밀번호: admin12345
```

로그인하면 자동으로 **관리자 페이지**로 이동합니다.

### 3. 관리자 페이지 기능

#### 📊 대시보드
- 전체 회원 수
- 등록 농장 수
- 농장-회원 연결 수
- 데이터베이스 테이블 수

#### 🗄️ 데이터베이스 구조
- 현재 생성된 모든 테이블 목록
- 각 테이블의 컬럼 정보 (이름, 타입, 필수 여부)
- 실시간 데이터베이스 스키마 확인

#### 👥 회원 관리
- 전체 회원 목록 조회
- 회원 정보 (사용자명, 이름, 이메일, 권한, 상태)
- 회원 활성/비활성 토글
- 회원 삭제 (자기 자신 제외)

#### 🏢 농장 관리
- 등록된 농장 목록
- 농장 정보 (농장명, 코드, 농장주, 주소, 직원 수)

#### ⚙️ 시스템 설정
- 시스템 기본 정보
- 양돈 관리 설정 (추후 확장)

## 📦 데이터베이스 구조

### Users (사용자)
```sql
- id: UUID (Primary Key)
- username: String (Unique, 로그인 ID)
- email: String (Unique)
- password: String (Hashed)
- fullName: String (실명)
- phone: String
- systemRole: Enum (super_admin / user)
- isActive: Boolean
- lastLogin: DateTime
```

### Farms (농장)
```sql
- id: UUID (Primary Key)
- farmName: String (농장명)
- farmCode: String (Unique, 농장 코드)
- businessNumber: String (사업자번호)
- address: String
- phone: String
- email: String
- totalArea: Float (총 면적 m²)
- capacity: Integer (최대 사육 두수)
- ownerId: UUID (Foreign Key -> Users)
- isActive: Boolean
```

### UserFarms (사용자-농장 관계)
```sql
- id: UUID (Primary Key)
- userId: UUID (Foreign Key -> Users)
- farmId: UUID (Foreign Key -> Farms)
- role: Enum (owner, manager, veterinarian, breeder, staff, consultant)
- department: String (부서/담당 구역)
- position: String (직책명)
- employmentType: Enum (full_time, part_time, contract, temporary)
- hireDate: Date (입사일)
- resignDate: Date (퇴사일)
- permissions: JSON (세밀한 권한 제어)
- assignedBy: UUID (등록자)
- isActive: Boolean
```

## 🗂️ 프로젝트 구조

```
d:\webviewer\
├── config/
│   └── database.js          # PostgreSQL 연결 설정
├── middleware/
│   └── auth.js              # 인증 및 권한 미들웨어
├── models/
│   ├── User.js              # 사용자 모델
│   ├── Farm.js              # 농장 모델
│   ├── UserFarm.js          # 사용자-농장 관계 모델
│   └── index.js             # 모델 관계 설정
├── routes/
│   ├── auth.js              # 인증 라우트
│   └── admin.js             # 관리자 라우트
├── public/
│   ├── css/
│   │   ├── style.css        # 로그인 페이지 스타일
│   │   └── admin.css        # 관리자 페이지 스타일
│   ├── js/
│   │   ├── login.js         # 로그인 페이지 스크립트
│   │   └── admin.js         # 관리자 페이지 스크립트
│   ├── login.html           # 로그인 페이지
│   └── admin.html           # 관리자 페이지
├── .env                     # 환경 변수
├── package.json
├── server.js                # 메인 서버 파일
├── create_admin.js          # 관리자 생성 스크립트
└── README.md
```

## 📊 API 엔드포인트

### 인증 API
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인
- `POST /api/auth/logout` - 로그아웃
- `GET /api/auth/me` - 현재 사용자 정보

### 관리자 API (super_admin 전용)
- `GET /api/admin/database/tables` - 테이블 목록
- `GET /api/admin/database/tables/:tableName/columns` - 테이블 컬럼 정보
- `GET /api/admin/database/stats` - 데이터베이스 통계
- `GET /api/admin/users` - 전체 회원 목록
- `PATCH /api/admin/users/:userId/toggle-active` - 회원 활성/비활성
- `DELETE /api/admin/users/:userId` - 회원 삭제
- `GET /api/admin/farms` - 전체 농장 목록
- `GET /api/admin/settings` - 시스템 설정

## 🔐 보안 기능

- ✅ bcrypt를 사용한 비밀번호 해싱 (10 rounds)
- ✅ 세션 기반 인증 (24시간 유효)
- ✅ 비밀번호 최소 길이 요구 (8자)
- ✅ 사용자명 영문/숫자만 허용
- ✅ 이메일 형식 검증
- ✅ SQL Injection 방지 (Sequelize ORM)
- ✅ 역할 기반 접근 제어 (RBAC)
- ✅ 자기 자신 삭제/비활성화 방지

## 🛠️ 기술 스택

- **Backend**: Node.js, Express
- **Database**: PostgreSQL
- **ORM**: Sequelize
- **Authentication**: express-session, bcrypt
- **Frontend**: HTML, CSS, JavaScript (Vanilla)

## 📝 다음 단계

현재 최고 관리자 페이지가 완성되었습니다. 다음 기능을 추가할 수 있습니다:

### Phase 1: 농장 관리 확장
- [ ] 농장 생성 페이지
- [ ] 농장 수정/삭제 기능
- [ ] 농장 선택 페이지 (일반 사용자용)

### Phase 2: 직원 관리
- [ ] 농장별 직원 추가
- [ ] 직원 역할 관리
- [ ] 직원 근무 일정

### Phase 3: 양돈 관리 기능
- [ ] 돼지 등록 및 관리
- [ ] 건강 기록
- [ ] 사료 관리
- [ ] 백신 접종 기록

### Phase 4: 대시보드 및 보고서
- [ ] 농장 현황 대시보드
- [ ] 통계 및 차트
- [ ] 보고서 생성

## 🎯 현재 상태

✅ **완료**: 로그인 시스템, 최고 관리자 페이지, 데이터베이스 구조 확인, 회원 관리

---

**개발 시작일**: 2026-02-08  
**현재 버전**: 1.0.0  
**라이선스**: MIT
