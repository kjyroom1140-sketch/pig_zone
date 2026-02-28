# 시설 구조 관리 – 구조와 현재 시나리오

## 1. 시설 구조 계층 (데이터 모델)

물리적 농장 시설은 **5단계 계층**으로 관리됩니다.

| 레벨 | 모델 | 테이블 | 설명 |
|------|------|--------|------|
| 1 | **건물(동)** | `farm_buildings` | 농장 내 건물 단위 (예: 1동, 2동). **1동 = 1 row**. `totalFloors`로 층 수만 저장. |
| 2 | **층** | (논리) | 층 번호는 **farm_barns.floorNumber** 로 구분. 건물 UUID(`buildingId`) + `floorNumber`(1,2,3…)로 표현. 실제로는 건물 row가 “1층용”, “2층용”으로 여러 개 존재. |
| 3 | **돈사** | `farm_barns` | 건물 내 사육 시설. `buildingId`(건물 UUID) + `floorNumber`(층)로 건물·층에 연결. |
| 4 | **방** | `farm_rooms` | 돈사 내 방 (예: 1번방, 2번방). `barnId`로 돈사에 연결. `sectionCount` = 칸 수. |
| 5 | **칸** | `farm_sections` | 방 내 개별 칸(사육 단위). 두수·체중·입주일·일령 등 사육 정보 저장. |

- **buildingGroupId / floor 컬럼 없음**: 건물 1 row = 1동이며, 층 정보는 `farm_barns.buildingId` + `farm_barns.floorNumber`로만 표현합니다.
- **트리 API**는 `farm_buildings` 1 row당 1건물로 조회하고, 돈사를 `floorNumber`로 묶어 **건물(동) → 층 → 돈사 → 방 → 칸** 형태의 트리 데이터를 반환합니다.

### 1.1 기존 DB 마이그레이션

기존에 `floor`·`buildingGroupId` 컬럼이 있던 DB는 동당 1 row 구조로 통합하는 마이그레이션이 필요합니다. 필요 시 요청하여 스크립트 생성 가능합니다.

---

## 2. 두 가지 “시설” 개념

시설 구조 관리와 연관된 개념이 **두 가지** 있습니다.

| 구분 | API/테이블 | 용도 |
|------|------------|------|
| **운영 시설 설정** | `farm_structure`, `/api/farm-structure/:farmId/production` | “이 농장에서 쓰는 사육 시설 종류” (분만사, 자돈사, 비육사 등)를 **템플릿 기준**으로 선택. `structure_templates`(전역) + `farm_structure`(농장별) 사용. |
| **시설 구조(트리)** | `farm_buildings` / `farm_barns` / `farm_rooms` / `farm_sections`, `/api/farm-facilities/:farmId/tree` | 농장의 **실제 건물·돈사·방·칸** 계층. 건물 추가/수정/삭제, 돈사·방·칸 CRUD. |

- **건물 추가 시**: “운영 시설이 먼저 있어야 한다”는 검사가 있으며, 돈사 추가 시에는 운영 시설(템플릿) 중 하나를 “돈사 종류”로 선택합니다.

---

## 3. API 정리

### 3.1 시설 트리 (farm-facilities)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/farm-facilities/:farmId/tree` | 건물(동) → 층 → 돈사 → 방 → 칸 트리 조회 (1동=1 row, 층은 barns.floorNumber로 구분) |
| POST | `/api/farm-facilities/:farmId/buildings` | 건물(동) 1 row 추가 (body: name, totalFloors 등) |
| PUT | `/api/farm-facilities/buildings/:buildingId` | 건물 수정 (이름/설명/totalFloors) |
| DELETE | `/api/farm-facilities/buildings/:buildingId` | 건물 1 row 삭제 |
| POST | `/api/farm-facilities/buildings/:buildingId/barns` | 해당 건물에 돈사 추가 (body에 floorNumber 필수) |
| PUT | `/api/farm-facilities/barns/:barnId` | 돈사 수정 |
| DELETE | `/api/farm-facilities/barns/:barnId` | 돈사 삭제 |
| POST | `/api/farm-facilities/barns/:barnId/rooms` | 방 추가 |
| POST | `/api/farm-facilities/barns/:barnId/rooms/bulk` | 방 일괄 추가 |
| PUT | `/api/farm-facilities/rooms/:roomId` | 방 수정 |
| DELETE | `/api/farm-facilities/rooms/:roomId` | 방 삭제 |

- 권한: `checkFarmPermission` (system_admin / super_admin 또는 해당 농장 farm_admin / manager).

### 3.2 운영 시설 (farm-structure)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/farm-structure/:farmId/production` | 해당 농장의 “사육 시설” 템플릿 선택 목록 (production) |
| POST | `/api/farm-structure/:farmId/production` | 선택한 템플릿 ID 목록으로 farm_structure 저장 (body: `templateIds`) |

---

## 4. 화면·시나리오

### 4.1 farm_admin.html – 시설 구조 관리 (통합 뷰)

- **위치**: 농장 정보 / 시설 구조 메뉴 클릭 시 **통합 뷰** (`integrated-farm-manage`) 표시.
- **왼쪽**: 농장 정보 폼 + **운영 시설 설정** (사육 시설 템플릿 체크박스 목록, `loadFarmStructures()`).
- **오른쪽**: **시설 구조 트리** (`#facilitiesTreeContainer`).
  - `initFacilities(currentFarmId)` 호출 → `GET /api/farm-facilities/:farmId/tree` 후 트리 렌더.
  - 건물: 추가(＋), 돈사 추가(＋🐷), 수정(✏️), 삭제(🗑️).
  - 층: 돈사 추가(＋🐷).
  - 돈사: 방 추가(＋🚪), 수정, 삭제.
  - 방: 수정, 삭제.
  - 칸: 사육정보 수정(✏️) – 현재는 안내 메시지.
- **건물 추가**: 기본 층수 1. “운영 시설 설정”이 없으면 안내 모달 후 건물 추가 모달로 진행.

### 4.2 dashboard.html – 일정 관리

- **위치**: 일정 관리 메뉴 클릭 시 표시.
- **상단**: 검색 한 줄 + 가운데 달력 아이콘 + 좌우 화살표(1일 이동).
- **본문**: **농장 구조 + 7일** 그리드 테이블.
  - `GET /api/farm-facilities/:farmId/tree`로 트리 조회 후, 확장 상태 기준으로 평탄화한 행 + 7일 열 렌더.
  - 요일/휴일/당일 색 구분, 당일 강조.
  - **읽기 전용** (추가·수정·삭제 없음). 수정은 farm_admin 시설 구조 관리에서만 가능.

---

## 5. 현재 시나리오 요약

1. **farm_admin**에서 농장 선택 후 **농장 정보 / 시설 구조**로 진입.
2. **운영 시설 설정**: 사육 시설 템플릿(분만사, 자돈사, 비육사 등)을 선택 후 저장 → `farm_structure` 반영.
3. **시설 구조 트리**:  
   - 건물 추가(1동 = 1 row, totalFloors로 층 수 입력) → 각 층에서 돈사 추가(층 선택 + 돈사 종류) → 돈사별 방 추가(또는 일괄) → 방별 칸은 자동/수동 생성.  
   - 수정/삭제는 각 노드의 아이콘(✏️, 🗑️)으로 수행.
4. **대시보드 일정 관리**: 같은 농장의 시설 트리를 “농장 구조 + 7일” 그리드로 **조회만** 제공. 날짜 이동은 화살표로 1일 단위 변경.

---

## 6. 관련 파일

| 구분 | 파일 |
|------|------|
| API | `routes/farmFacilities.js`, `routes/farmStructure.js` |
| 모델 | `models/FarmBuilding.js`, `FarmBarn.js`, `FarmRoom.js`, `FarmSection.js` |
| UI (편집) | `public/farm_admin.html`, `public/js/farm_facilities.js`, `public/css/farm_facilities.css` |
| UI (조회) | `public/dashboard.html`, `public/css/dashboard.css` |
| 일정 설계 | `docs/farm_schedule_design.md` |
