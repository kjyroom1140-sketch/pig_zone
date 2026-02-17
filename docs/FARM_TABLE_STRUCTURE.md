# 🏢 Farm (농장) 테이블 구조

## 📋 테이블 개요

**테이블명**: `farms`  
**설명**: 양돈 농장의 기본 정보를 관리하는 테이블

---

## 🗂️ 필드 구조

### 기본 정보

| 필드명 | 타입 | 필수 | 기본값 | 설명 |
|--------|------|------|--------|------|
| `id` | UUID | ✅ | UUIDV4 | 농장 고유 ID (Primary Key) |
| `farmName` | VARCHAR(100) | ✅ | - | 농장명 |
| `farmCode` | VARCHAR(50) | ✅ | - | 농장 코드 (예: FARM-001, 고유값) |
| `ownerName` | VARCHAR(80) | ❌ | - | 대표자/소유자명 |
| `businessNumber` | VARCHAR(20) | ❌ | - | 사업자등록번호 |

### 연락처 정보

| 필드명 | 타입 | 필수 | 기본값 | 설명 |
|--------|------|------|--------|------|
| `phone` | VARCHAR(30) | ❌ | - | 전화번호 |
| `email` | VARCHAR(120) | ❌ | - | 이메일 주소 |

### 주소 정보

| 필드명 | 타입 | 필수 | 기본값 | 설명 |
|--------|------|------|--------|------|
| `address` | TEXT | ❌ | - | 기본 주소 |
| `addressDetail` | TEXT | ❌ | - | 상세 주소 |
| `postalCode` | VARCHAR(20) | ❌ | - | 우편번호 |

### 위치 정보 (GPS)

| 필드명 | 타입 | 필수 | 기본값 | 설명 |
|--------|------|------|--------|------|
| `latitude` | DOUBLE | ❌ | - | 위도 (지도 표시용) |
| `longitude` | DOUBLE | ❌ | - | 경도 (지도 표시용) |
| `timezone` | VARCHAR(50) | ✅ | 'Asia/Seoul' | 타임존 |

### 농장 규모

| 필드명 | 타입 | 필수 | 기본값 | 설명 |
|--------|------|------|--------|------|
| `totalArea` | FLOAT | ❌ | - | 총 면적 (m²) |
| `capacity` | INTEGER | ❌ | - | 최대 사육 두수 |

### 상태 관리

| 필드명 | 타입 | 필수 | 기본값 | 설명 |
|--------|------|------|--------|------|
| `status` | ENUM | ✅ | 'ACTIVE' | 농장 상태 (ACTIVE/INACTIVE/DELETED) |
| `isActive` | BOOLEAN | ✅ | true | 활성 여부 (deprecated, status 사용 권장) |
| `note` | TEXT | ❌ | - | 비고/메모 |

### 관계 정보

| 필드명 | 타입 | 필수 | 기본값 | 설명 |
|--------|------|------|--------|------|
| `ownerId` | UUID | ✅ | - | 농장을 등록한 사용자 ID (users.id 참조) |

### 시스템 필드

| 필드명 | 타입 | 필수 | 기본값 | 설명 |
|--------|------|------|--------|------|
| `createdAt` | TIMESTAMPTZ | ✅ | now() | 생성 일시 |
| `updatedAt` | TIMESTAMPTZ | ✅ | now() | 수정 일시 |

---

## 📊 상태(Status) 값 설명

| 값 | 설명 | 용도 |
|----|------|------|
| `ACTIVE` | 운영 중 | 정상적으로 운영되는 농장 |
| `INACTIVE` | 일시 중단 | 휴장 또는 임시 중단 상태 |
| `DELETED` | 삭제됨 | 논리 삭제 (실제 DELETE 하지 않음) |

---

## 🔗 관계 (Relationships)

### 1. User (소유자)
- **관계**: Many-to-One
- **외래키**: `ownerId` → `users.id`
- **설명**: 한 사용자가 여러 농장을 등록할 수 있음

### 2. UserFarm (농장-사용자 연결)
- **관계**: One-to-Many
- **설명**: 한 농장에 여러 사용자(직원)가 소속될 수 있음

---

## 📌 인덱스

| 인덱스명 | 컬럼 | 타입 | 설명 |
|----------|------|------|------|
| PRIMARY | `id` | Primary Key | 기본 키 |
| UNIQUE | `farmCode` | Unique | 농장 코드 중복 방지 |
| INDEX | `ownerId` | Index | 소유자별 조회 최적화 |
| INDEX | `status` | Index | 상태별 조회 최적화 |

---

## 💡 사용 예시

### 농장 생성
```javascript
const farm = await Farm.create({
    farmName: '행복돼지농장',
    farmCode: 'FARM-001',
    ownerName: '김농장',
    phone: '010-1234-5678',
    email: 'farm001@example.com',
    address: '경기도 이천시 농장로 123',
    addressDetail: '1동',
    postalCode: '12345',
    latitude: 37.2721,
    longitude: 127.4350,
    timezone: 'Asia/Seoul',
    totalArea: 5000.0,
    capacity: 1000,
    status: 'ACTIVE',
    note: '2026년 신규 등록',
    ownerId: 'user-uuid-here'
});
```

### 활성 농장 조회
```javascript
const activeFarms = await Farm.findAll({
    where: {
        status: 'ACTIVE'
    },
    include: [{
        model: User,
        as: 'owner',
        attributes: ['id', 'fullName', 'email']
    }]
});
```

### 농장 상태 변경 (일시 중단)
```javascript
await farm.update({
    status: 'INACTIVE',
    note: '2026년 3월 휴장'
});
```

### 논리 삭제
```javascript
await farm.update({
    status: 'DELETED',
    note: '2026년 폐업'
});
```

---

## ✅ 개선 사항

### 기존 구조 대비 추가된 기능

1. **상세 주소 관리**
   - `addressDetail`: 상세 주소 별도 관리
   - `postalCode`: 우편번호 추가

2. **GPS 위치 정보**
   - `latitude`, `longitude`: 지도 표시 및 위치 기반 서비스 지원

3. **타임존 지원**
   - `timezone`: 국제화 대비, 시간대별 관리 가능

4. **상태 관리 강화**
   - `status` ENUM: 명확한 상태 구분
   - 논리 삭제 지원으로 데이터 보존

5. **메모 기능**
   - `note`: 농장별 특이사항 기록

6. **소유자명 추가**
   - `ownerName`: User 테이블과 별도로 대표자명 관리 가능

---

## 🔄 마이그레이션

### 실행 방법
```bash
node migrate_farm_table.js
```

### 마이그레이션 내용
- 기존 테이블에 새 컬럼 추가
- 기존 데이터 보존
- 안전한 IF NOT EXISTS 구문 사용

---

## 🎯 향후 확장 가능성

1. **이미지 관리**
   - 농장 사진, 로고 등

2. **인증/허가 정보**
   - 축산업 허가증 번호
   - 인증 정보 (무항생제, 동물복지 등)

3. **운영 정보**
   - 설립일
   - 운영 시작일
   - 직원 수

4. **통계 정보**
   - 월별 생산량
   - 출하 실적

---

## 📝 주의사항

1. **farmCode는 고유값**
   - 중복 불가
   - 농장 식별자로 사용

2. **status vs isActive**
   - 새로운 개발에서는 `status` 사용 권장
   - `isActive`는 하위 호환성을 위해 유지

3. **논리 삭제**
   - 실제 DELETE 대신 `status = 'DELETED'` 사용
   - 데이터 복구 및 이력 관리 가능

4. **타임존**
   - 기본값: 'Asia/Seoul'
   - 필요시 다른 타임존 설정 가능

---

## 🔍 검증 완료

✅ 모든 필드가 정상적으로 추가됨  
✅ 인덱스 생성 완료  
✅ ENUM 타입 정상 동작  
✅ 기존 데이터 보존  
✅ 외래키 관계 유지  

---

**작성일**: 2026-02-08  
**버전**: 1.0  
**상태**: ✅ 프로덕션 준비 완료
