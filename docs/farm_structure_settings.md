# 농장 구조 설정 – 정리 문서

농장 구조 설정 관련 개념, 데이터, API, UI 현황을 정리한 문서입니다. 실제 구현 전 설계·작업 범위 결정용으로 사용할 수 있습니다.

---

## 1. “농장 구조” 관련 두 가지 개념

농장 구조와 관련된 개념은 **두 가지**로 구분하는 것이 좋습니다.

| 구분 | 설명 | 테이블 / API | 용도 |
|------|------|--------------|------|
| **운영 시설 설정** (사육시설 선택) | 이 농장에서 **사용할 사육 시설 종류**를 템플릿 기준으로 선택 | `farm_structure`, `structure_templates` / `GET·POST /api/farm-structure/:farmId/production` | 분만사, 자돈사, 비육사 등 “어떤 시설 타입을 쓸지” 설정 |
| **시설 구조(트리)** | 농장의 **실제 건물·돈사·방·칸** 계층 (물리 구조) | `farm_buildings`, `farm_barns`, `farm_rooms`, `farm_sections` / `GET /api/farm-facilities/:farmId/tree` | 1동, 2동, 각 동의 층·돈사·방·칸 등 실제 배치 |

- **운영 시설**을 먼저 선택한 뒤, **시설 트리**에서 건물·돈사 추가 시 “돈사 종류”를 그 템플릿 중 하나로 고르는 흐름이 자연스럽습니다.
- 대시보드 **환경 설정** 페이지에서 말하는 “농장 구조 설정”은 위 둘 중 **어느 범위까지** 넣을지(운영 시설만 vs 트리까지)를 정해야 합니다.

### 1.1 희망 UX: 농장 구조 설정에서의 편집 흐름

아래는 농장 구조 설정(시설 트리 편집) 화면에서의 **희망 사용 흐름**입니다.

1. **건물 추가**
   - “건물 추가” 버튼으로 건물(동)을 추가한다.

2. **건물 아래에서 “방” 추가 시 — 시설 유형 선택**
   - 건물 아래에 **방**을 추가할 때, 먼저 **사육시설** vs **일반시설**을 선택한다.
   - **사육시설**이면: 이 농장에서 “사육시설 선택”으로 지정해 둔 **사육시설 템플릿 중 하나**를 선택한다.
   - **일반시설**도 같은 건물 안에 둘 수 있다. 한 건물에 사육시설과 일반시설이 함께 있는 경우를 지원한다.

3. **방 일괄 생성**
   - 사육시설(또는 일반시설)을 선택한 뒤 **방 개수**를 입력하면, 한 번에 **1번방, 2번방, … N번방**이 순서대로 생성된다.

4. **칸 일괄 생성**
   - 각 **방**에서 **칸 개수**를 입력하면, 해당 방 아래에 **1번칸, 2번칸, … M번칸**이 순서대로 생성·저장된다.

> **DB 매핑 참고**: 현재 스키마는 **건물(동) → 돈사 → 방 → 칸** 4단계이다. 위에서 “건물 아래에 방을 추가할 때 사육/일반·템플릿 선택”은 **돈사(barn)** 단위로 보는 것이 자연스럽고, “방 개수 입력 → 1번방~N번방”은 **farm_rooms** 일괄 생성, “칸 개수 입력 → 1번칸~M번칸”은 **farm_sections** 일괄 생성으로 구현하면 된다.

---

## 2. 현재 화면 배치와 “농장 구조 설정” 영역

### 2.1 대시보드 > 환경 설정 (`/dashboard/settings`)

- **왼쪽**
  - **기본정보**: 축산물등록번호, 사업자번호, 농장명, 주소, 담당자 등 (수정 버튼으로 편집 후 저장)
  - **사육시설 선택** (데이터 흐름):
    - **표시 목록**: `structure_templates`(category=production)를 불러와 화면에 체크박스 목록으로 표시한다.
    - **선택 상태**: `farm_structure` 테이블에서 해당 농장의 production 시설을 불러와, 그 `templateId` 집합으로 “선택됨”을 표시한다.
    - **저장**: 수정 모드에서 체크 변경 후 저장 시 `farm_structure`에 해당 농장의 production 목록을 반영한다.
- **오른쪽**
  - **농장 구조 설정**: 현재 **빈 영역**(플레이스홀더, 460px). 여기에 무엇을 넣을지가 문서/작업 대상.

즉, “농장 구조 설정”이란 **오른쪽 460px 영역의 기능/콘텐츠**를 무엇으로 채울지에 대한 설계가 필요합니다.

### 2.2 관리자 > 농장 > 시설 구조 (`/admin/farms/[id]/structure`)

- **사육 시설(운영 시설)**: `getFarmStructureProduction`으로 목록만 표시.
- **시설 트리**: `getFarmFacilitiesTree`로 건물 수 등만 표시. 트리 확장/편집 UI는 “단계적으로 추가” 예정 상태.

---

## 3. 데이터 구조 요약

### 3.1 운영 시설 (이미 반영됨)

- **structure_templates**  
  - 전역 마스터. `category`: `production`(사육시설), `support`(일반시설).  
  - 환경 설정 “사육시설 선택”은 `production`만 사용.
- **farm_structure**  
  - 농장별로 “이 농장에서 쓰는” 템플릿을 저장.  
  - `farmId`, `templateId`(→ structure_templates.id), `category`(예: 'production'), `name`, `weight`, `optimalDensity`, `description` 등.

### 3.2 시설 트리 (물리 구조)

계층은 **건물(동) → 층(논리) → 돈사 → 방 → 칸** 5단계입니다.

| 레벨 | 테이블 | 설명 |
|------|--------|------|
| 1 | **farm_buildings** | 건물(동). 1동 = 1 row. `farmId`, `name`, `code`, `orderIndex`, `description`, `totalFloors` 등. |
| 2 | (논리) | 층 번호는 **farm_barns.floorNumber**로 표현. 건물 + floorNumber로 “1동 2층” 등 구분. |
| 3 | **farm_barns** | 돈사. `buildingId`, `floorNumber`, `barnType`(운영 시설 템플릿과 연결 가능), `name`, `orderIndex`, `description` 등. |
| 4 | **farm_rooms** | 방. `barnId`, `roomNumber`, `sectionCount`, `area`, `totalCapacity`, `orderIndex` 등. |
| 5 | **farm_sections** | 칸. `roomId`, `sectionNumber`, `currentPigCount`, `averageWeight`, `entryDate`, `birthDate`, `breedType`, `area`, `capacity` 등. |

- 건물/돈사/방/칸 모두 `isActive`로 소프트 삭제 가능한 구조로 가정.
- 트리 API 응답은 **건물 → barns[] → rooms[] → sections[]** 중첩으로 내려옵니다.

---

## 4. API 현황

### 4.1 운영 시설 (farm-structure)

| 메서드 | 경로 | 구현 | 설명 |
|--------|------|------|------|
| GET | `/api/farm-structure/:farmId/production` | ✅ | 해당 농장의 사육시설 선택 목록 (farm_structure + template 정보) |
| POST | `/api/farm-structure/:farmId/production` | ✅ | body: `{ templateIds: number[] }`. 기존 production 삭제 후 선택한 templateId만 INSERT |

- 권한: `canManageFarmStructure` (system_admin/super_admin 또는 해당 농장 farm_admin/manager).

### 4.2 시설 트리 (farm-facilities)

| 메서드 | 경로 | 구현 | 설명 |
|--------|------|------|------|
| GET | `/api/farm-facilities/:farmId/tree` | ✅ | 건물 → 돈사 → 방 → 칸 트리 조회 (중첩 JSON) |

- **건물/돈사/방/칸의 POST·PUT·DELETE**는 `docs/facility_structure_overview.md`에는 문서화되어 있으나, **현재 Go 백엔드 라우트에는 등록되어 있지 않음**.  
  - 예: `POST /api/farm-facilities/:farmId/buildings`, `PUT /api/farm-facilities/buildings/:buildingId`, `POST .../buildings/:buildingId/barns` 등.
- 따라서 “농장 구조 설정”에서 **트리 편집(건물/돈사/방 추가·수정·삭제)**을 넣으려면 해당 API를 백엔드에 추가하는 작업이 선행됩니다.

---

## 5. 프론트엔드 연동 현황

- **대시보드 환경 설정** (`frontend/app/dashboard/settings/page.tsx`)
  - 기본정보: `updateFarm`, 수정/저장/취소 처리 완료.
  - 사육시설 선택: `getFarmStructureProduction`, `saveFarmStructureProduction` 연동, 수정 모드에서만 변경 후 저장.
  - **농장 구조 설정**: 오른쪽 영역은 비어 있음. 여기에 트리 미리보기만 넣을지, 트리 편집까지 넣을지 결정 필요.
- **관리자 농장 시설 구조** (`frontend/app/admin/farms/[id]/structure/page.tsx`)
  - 운영 시설 목록 + 트리 건물 개수 정도만 표시. 트리 확장/편집 UI는 미구현.
- **대시보드 일정** (`frontend/app/dashboard/schedule/page.tsx`)
  - `getFarmFacilitiesTree`로 트리 조회 후 사용 (읽기 전용 등).

---

## 6. “농장 구조 설정” 영역 작업 시 선택지

오른쪽 “농장 구조 설정” 블록에 들어갈 수 있는 방향을 정리하면 다음과 같습니다.

1. **트리 조회만**  
   - `GET /api/farm-facilities/:farmId/tree`로 트리를 가져와서 **읽기 전용**으로 표시 (확장/축소만).
   - 구현 난이도 낮음. 백엔드 추가 없이 가능.

2. **트리 조회 + 간단 안내**  
   - 트리 미리보기 + “건물/돈사/방 추가·수정은 관리자 > 농장 > 시설 구조에서 할 수 있습니다” 같은 안내 문구.
   - 관리자와 일반 사용자 역할을 나누는 경우 적합.

3. **트리 편집까지**  
   - 건물 추가/수정/삭제, 돈사·방·칸 CRUD를 이 페이지에서 수행.
   - **편집 흐름**은 **§1.1 희망 UX**대로 구현: 건물 추가 → (돈사 단위로) 사육시설/일반시설 선택 및 템플릿 선택 → 방 개수 입력으로 1번방~N번방 일괄 생성 → 방별 칸 개수 입력으로 1번칸~M번칸 일괄 생성.
   - 이 경우 **백엔드에 farm-facilities용 POST/PUT/DELETE API** 및 **방/칸 일괄 생성 API** 구현이 필요하고, `docs/facility_structure_overview.md`의 API 명세를 참고해 라우트·핸들러를 추가해야 함.

4. **운영 시설과 트리 요약만**  
   - “선택된 사육시설 n개”, “건물 n동” 정도만 요약 표시하고, 상세는 다른 메뉴로 링크.
   - 가장 단순한 형태.

---

## 7. 권한

- **농장 구조/시설 관리** 권한: `canManageFarmStructure`
  - `super_admin`, `system_admin`: 모든 농장
  - 해당 농장의 `farm_admin`, `manager`: 해당 농장만
- 대시보드 환경 설정은 “현재 선택된 농장” 기준이므로, 위 권한이 있으면 동일하게 적용하면 됩니다.

---

## 8. 관련 문서·파일

| 구분 | 경로 |
|------|------|
| 시설 계층·API 개요 | `docs/facility_structure_overview.md` |
| 테이블 구조 참고 | `docs/table_structures_reference.md`, `docs/table_structures_pig_and_schedule.md` |
| 백엔드 핸들러 | `backend/internal/handlers/farm_structure.go`, `backend/internal/handlers/farm_facilities.go` |
| 라우트 등록 | `backend/cmd/api/main.go` (farm-structure, farm-facilities/tree만 등록됨) |
| 프론트 설정 페이지 | `frontend/app/dashboard/settings/page.tsx` |
| 관리자 시설 구조 페이지 | `frontend/app/admin/farms/[id]/structure/page.tsx` |
| API 클라이언트 | `frontend/lib/api.ts` (getFarmStructureProduction, saveFarmStructureProduction, getFarmFacilitiesTree) |

---

## 9. 정리

- **농장 구조 설정**은 “운영 시설 선택”과 “시설 트리(건물·돈사·방·칸)” 두 레이어로 나뉜다.
- **사육시설 선택**은 이미 환경 설정 왼쪽에 구현되어 있고, **농장 구조 설정**은 오른쪽 빈 영역의 기능을 무엇으로 채울지**에 대한 설계가 필요하다.
- 트리를 **조회만** 할지, **편집까지** 할지에 따라 백엔드 API 추가 여부와 UI 범위가 달라지므로, 위 선택지(6장) 중 하나를 정한 뒤 단계적으로 구현하는 것을 권장한다.
