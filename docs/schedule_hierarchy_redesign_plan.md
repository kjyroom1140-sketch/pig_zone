# 구분 → 작업유형 → 기준 계층 변경 및 컬럼명 정리 계획

현재 **구분 → 기준 → 작업유형** 계층을 **구분 → 작업유형 → 기준**으로 바꾸고, FK 컬럼명을 이해하기 쉽게 정리합니다.

**진행 방식: 구분·기준·작업유형 테이블에 저장된 데이터는 모두 제거한 뒤, 스키마만 변경합니다.** (기존 데이터 이전 없음)

---

## 1. 현재 vs 변경 후 계층

| 현재 | 변경 후 |
|------|--------|
| 사육시설(structure_templates) | 사육시설 |
| └ 구분(schedule_sortations) | └ 구분(schedule_sortations) |
| &nbsp;&nbsp;&nbsp;└ 기준(schedule_criterias) | &nbsp;&nbsp;&nbsp;└ **작업유형**(schedule_jobtypes) |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└ 작업유형(schedule_jobtypes) | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└ **기준**(schedule_criterias) |

---

## 2. 데이터 제거 후 스키마 변경

### 2.1 진행 원칙

- **구분(schedule_sortations), 기준(schedule_criterias), 작업유형(schedule_jobtypes)** 세 테이블의 **기존 데이터는 모두 삭제**.
- 데이터 이전/매핑 없이 **테이블 구조만** 변경한 뒤, 새 계층과 새 컬럼명으로 사용.

### 2.2 데이터 삭제 순서 (FK 의존 관계)

자식 → 부모 순으로 삭제해야 FK 오류가 나지 않습니다.

1. **schedule_criterias** (기준) — 작업유형을 참조하는 쪽이므로 먼저 삭제
2. **schedule_jobtypes** (작업유형) — 기준을 참조
3. **schedule_sortations** (구분) — 기준이 구분을 참조하므로 기준 삭제 후 삭제

실제로는 현재 구조가 **구분 → 기준 → 작업유형** 이므로:

1. `schedule_criterias` DELETE 또는 TRUNCATE
2. `schedule_jobtypes` DELETE 또는 TRUNCATE  
3. (선택) `schedule_sortations` DELETE 또는 TRUNCATE — 구분 데이터도 비울 경우

TRUNCATE 사용 시 `TRUNCATE schedule_criterias, schedule_jobtypes RESTART IDENTITY CASCADE;` 로 한 번에 처리 가능. 구분까지 비울 경우 `schedule_sortations`를 마지막에 추가.

### 2.3 스키마 변경 순서

데이터가 비었으므로 **기존 FK 컬럼 제거 → 새 FK 컬럼 추가** 순으로 진행.

1. **schedule_jobtypes (작업유형)**
   - `schedule_criterias_id` 컬럼 **DROP**
   - `sortation_id` (또는 schedule_sortations_id) 컬럼 **ADD** — INTEGER, NULL 허용, FK → schedule_sortations(id)
   - COMMENT: '구분 FK → schedule_sortations.id'

2. **schedule_criterias (기준)**
   - `schedule_sortations_id` 컬럼 **DROP**
   - `jobtype_id` (또는 schedule_jobtypes_id) 컬럼 **ADD** — INTEGER, NULL 허용, FK → schedule_jobtypes(id)
   - COMMENT: '작업유형 FK → schedule_jobtypes.id'

3. **schedule_sortations (구분)**  
   - 컬럼 변경 없음. (structure_template_id, sortations, sort_order, createdAt, updatedAt 유지)

---

## 3. 컬럼 정리 (최종)

### 3.1 schedule_sortations (구분) — 변경 없음

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER (PK) | 고유 ID |
| structure_template_id | INTEGER (nullable) | 시설 FK → structure_templates.id |
| sortations | TEXT (nullable) | 구분 데이터(JSON) |
| sort_order | INTEGER | 표시 순서 |
| createdAt, updatedAt | TIMESTAMPTZ | 생성/수정 시각 |

### 3.2 schedule_jobtypes (작업유형) — 구분 직하위

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER (PK) | 고유 ID |
| **sortation_id** | INTEGER (nullable) | 구분 FK → schedule_sortations.id |
| jobtypes | TEXT (nullable) | 작업유형/세부 데이터(JSON) |
| sort_order | INTEGER | 표시 순서 |
| createdAt, updatedAt | TIMESTAMPTZ | 생성/수정 시각 |

- 기존 `schedule_criterias_id` 제거, `sortation_id` 사용.

### 3.3 schedule_criterias (기준) — 작업유형 직하위

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER (PK) | 고유 ID |
| **jobtype_id** | INTEGER (nullable) | 작업유형 FK → schedule_jobtypes.id |
| criterias | TEXT (nullable) | 기준 데이터(JSON) |
| sort_order | INTEGER | 표시 순서 |
| createdAt, updatedAt | TIMESTAMPTZ | 생성/수정 시각 |

- 기존 `schedule_sortations_id` 제거, `jobtype_id` 사용.

---

## 4. 마이그레이션 스크립트 진행 순서 (요약)

1. **데이터 제거**  
   - `TRUNCATE schedule_criterias, schedule_jobtypes RESTART IDENTITY CASCADE;`  
   - 구분 데이터도 제거할 경우: `TRUNCATE schedule_sortations RESTART IDENTITY CASCADE;` (criterias/jobtypes 이미 비었으므로 순서는 그 후)

2. **schedule_jobtypes**  
   - `ALTER TABLE schedule_jobtypes DROP COLUMN schedule_criterias_id;`  
   - `ALTER TABLE schedule_jobtypes ADD COLUMN sortation_id INTEGER REFERENCES schedule_sortations(id) ON DELETE SET NULL;`

3. **schedule_criterias**  
   - `ALTER TABLE schedule_criterias DROP COLUMN schedule_sortations_id;`  
   - `ALTER TABLE schedule_criterias ADD COLUMN jobtype_id INTEGER REFERENCES schedule_jobtypes(id) ON DELETE SET NULL;`

4. **COMMENT**  
   - `COMMENT ON COLUMN schedule_jobtypes.sortation_id IS '구분 FK → schedule_sortations.id';`  
   - `COMMENT ON COLUMN schedule_criterias.jobtype_id IS '작업유형 FK → schedule_jobtypes.id';`

---

## 5. 적용 후 작업 (API · 프론트)

1. **백엔드 (Go)**  
   - schedule_jobtypes: List/Create/Update에서 `schedule_criterias_id` → `sortation_id` (또는 query param은 structure_template_id 유지 후 sortation_id로 필터).  
   - schedule_criterias: List/Create/Update에서 `schedule_sortations_id` → `jobtype_id`.

2. **프론트 (API 타입 · 페이지)**  
   - ScheduleJobtypeItem: `schedule_criterias_id` → `sortation_id`.  
   - ScheduleCriteriaItem: `schedule_sortations_id` → `jobtype_id`.  
   - 화면 흐름: 사육시설 → 구분 → **작업유형** → **기준** (및 기준내용).  
   - 작업유형 목록: 구분 선택 시 해당 구분의 작업유형만 조회.  
   - 기준 목록: 작업유형 선택 시 해당 작업유형의 기준만 조회.

3. **참조 문서**  
   - `table_structures_reference.md`, `schedule_add_documentation.md` 등에서 schedule_criterias / schedule_jobtypes 설명을 위 구조와 새 컬럼명(sortation_id, jobtype_id)에 맞게 수정.

---

## 6. 정리

- **구분·기준·작업유형** 저장 데이터는 **모두 제거**하고, **스키마만** 구분 → 작업유형 → 기준 계층에 맞게 변경.
- **컬럼명:** 작업유형은 `sortation_id`, 기준은 `jobtype_id` 로 통일해 이해하기 쉽게 사용.
- 위 순서대로 데이터 삭제 → 스키마 변경 → API/프론트 수정하면 됨.
