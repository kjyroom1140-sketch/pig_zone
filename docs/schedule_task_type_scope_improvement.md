# 작업 유형 "적용 대상(전체 시설 vs 특정 장소)" 개선

## 1. 개선 목표

- **현상**: 모든 작업 유형이 한 목록에 있어, 스케줄 추가·수정 시 작업 유형 선택 목록이 길다.
- **요구**: 일부 작업 유형은 **모든 시설**에 공통이고, 일부는 **특정 장소(시설 유형)**에서만 발생한다. 이 구분을 두어, **대상장소를 선택했을 때 해당 장소에 적용되는 작업 유형만** 보이도록 하면 목록이 짧아진다.

**효과**: 작업자가 일정을 추가할 때 "대상장소"를 먼저 선택하면, 그 장소에 맞는 작업 유형만 드롭다운에 노출되어 목록이 축소된다.

---

## 2. 설계 요약

| 구분 | 내용 |
|------|------|
| **적용 대상** | 각 작업 유형에 **전체 시설** 또는 **특정 장소(들)** 설정. |
| **전체 시설** | 대상장소와 무관하게 항상 작업 유형 목록에 포함. |
| **특정 장소** | 선택한 **structure_template_id** 목록에만 해당 작업 유형 표시. (일정 추가 시 "대상장소"에 해당하는 것만 노출.) |
| **필터 규칙** | "대상장소" = A일 때 노출: `appliesToAllStructures === true` **또는** "특정 장소"에 A가 포함된 작업 유형. |

---

## 3. DB 스키마 변경

### 3.1 전역 작업 유형 (`schedule_task_types`)

- **추가 컬럼**
  - `applies_to_all_structures` BOOLEAN, NOT NULL, DEFAULT true  
    - true: 전체 시설 적용 (기존 동작 유지).  
    - false: 아래 연결 테이블에 있는 시설만 적용.

- **신규 테이블** `schedule_task_type_structures`
  - `schedule_task_type_id` INTEGER, FK → schedule_task_types.id, ON DELETE CASCADE  
  - `structure_template_id` UUID, FK → structure_templates.id, ON DELETE CASCADE  
  - PRIMARY KEY (schedule_task_type_id, structure_template_id)  
  - `applies_to_all_structures = false`인 작업 유형만 이 테이블에 행을 넣고, 여기 있는 structure_template_id에만 해당 작업 유형이 노출된다.

### 3.2 농장 작업 유형 (`farm_schedule_task_types`)

- **추가 컬럼**
  - `applies_to_all_structures` BOOLEAN, NOT NULL, DEFAULT true  

- **신규 테이블** `farm_schedule_task_type_structures`
  - `farm_schedule_task_type_id` INTEGER, FK → farm_schedule_task_types.id, ON DELETE CASCADE  
  - `structure_template_id` UUID, FK → structure_templates.id, ON DELETE CASCADE  
  - PRIMARY KEY (farm_schedule_task_type_id, structure_template_id)  

**운영 시설 저장 시 복사** (farmStructure 등):  
전역 `schedule_task_types` → `farm_schedule_task_types` 복사 시 `applies_to_all_structures`도 복사.  
`schedule_task_type_structures` → `farm_schedule_task_type_structures`는 **원본 전역 task type id → 복사된 farm task type id** 매핑으로 새 테이블에 행 생성.

---

## 4. API 변경

### 4.1 전역 작업 유형 (admin)

| 메서드 | 경로 | 변경 내용 |
|--------|------|-----------|
| GET | `/api/scheduleTaskTypes` | **쿼리** `structureTemplateId` (optional). 있으면 "해당 장소에 적용되는" 작업 유형만 반환 (전체 시설 + 해당 장소가 특정 장소에 포함된 유형). |
| GET | `/api/scheduleTaskTypes` | 쿼리 없으면 **전체 목록** (목록/관리용). |
| POST | `/api/scheduleTaskTypes` | body에 `appliesToAllStructures` (boolean), `structureTemplateIds` (배열, optional) 추가. `appliesToAllStructures === false`일 때만 `schedule_task_type_structures`에 행 저장. |
| PUT | `/api/scheduleTaskTypes/:id` | 동일 필드로 수정 시 연결 테이블 갱신. |
| GET | (기존) 구조 템플릿 목록 | 작업 유형 모달에서 "특정 장소" 선택용. `GET /api/structureTemplates` 사용. |

### 4.2 농장 작업 유형 (farm_admin)

| 메서드 | 경로 | 변경 내용 |
|--------|------|-----------|
| GET | `/api/farms/:farmId/schedule-task-types` | **쿼리** `structureTemplateId` (optional). 있으면 해당 농장 작업 유형 중 "해당 장소에 적용되는" 것만 반환. |
| GET | 쿼리 없음 | 전체 목록 (목록/관리용). |
| POST | `/api/farms/:farmId/schedule-task-types` | body에 `appliesToAllStructures`, `structureTemplateIds` 추가. `farm_schedule_task_type_structures` 반영. |
| PUT | `/api/farms/:farmId/schedule-task-types/:id` | 동일. |

---

## 5. 수정이 필요한 페이지·파일

### 5.1 admin.html (일정 관리 설정 — 작업 유형)

| 위치 | 수정 내용 |
|------|-----------|
| **작업 유형 목록 모달** | 테이블에 **"적용 대상"** 컬럼 추가. (전체 시설 / 특정 장소일 경우 "분만사, 이유사" 등 구조명 나열.) |
| **작업 유형 추가/수정 모달** | ① **적용 대상**: 라디오 또는 셀렉트 — "전체 시설" / "특정 장소만". ② "특정 장소만" 선택 시 **구조 템플릿 다중 선택** (체크박스 목록 또는 멀티 셀렉트). `GET /api/structureTemplates`로 목록 로드. |
| **일정 항목 추가/수정 모달** | **대상장소** 셀렉트 변경 시, 작업 유형 셀렉트를 **필터링**: `GET /api/scheduleTaskTypes?structureTemplateId=<선택된 대상장소 id>` 호출 후 옵션 재구성. 대상장소가 비어 있으면 전체 작업 유형 또는 "대상장소를 먼저 선택하세요" 처리. |

### 5.2 admin.js

| 기능 | 수정 내용 |
|------|-----------|
| `loadScheduleTaskTypes(structureTemplateId?)` | 쿼리 파라미터로 `structureTemplateId` 전달해 목록 조회 (일정 모달용). 목록 모달용은 파라미터 없이 전체 조회. |
| 작업 유형 목록 렌더 | 각 행에 "적용 대상" 표시. (appliesToAllStructures면 "전체 시설", 아니면 structureTemplateIds에 해당하는 구조 이름 나열.) |
| 작업 유형 추가/수정 폼 제출 | `appliesToAllStructures`, `structureTemplateIds` 전송. 저장 후 목록/연결 테이블 갱신. |
| 작업 유형 모달 오픈 시 | 구조 템플릿 목록 로드 (`/api/structureTemplates`), "특정 장소" 선택 시 사용. |
| 일정 항목 모달 | `scheduleItemStructureTemplateId` change 이벤트에서 `loadScheduleTaskTypes(selectedStructureId)` 호출 후 `scheduleItemTaskTypeId` 옵션 채우기. |

### 5.3 farm_admin.html (농장 일정 관리 — 작업 유형)

| 위치 | 수정 내용 |
|------|-----------|
| **작업 유형 목록 모달** | 테이블에 **"적용 대상"** 컬럼 추가 (위와 동일). |
| **작업 유형 추가/수정 모달** | ① 적용 대상: 전체 시설 / 특정 장소만. ② 특정 장소만일 때 **구조 템플릿 다중 선택**. (이 농장 **운영 시설**만 보여줄지, 전역 구조 템플릿 전부 보여줄지 정책 결정. 권장: 전역 `structure_templates` 사용해 일관성 유지.) |
| **일정 항목 추가/수정 모달** | **대상장소**(`farmScheduleItemStructureTemplateId`) 변경 시, 작업 유형 셀렉트를 `GET /api/farms/:farmId/schedule-task-types?structureTemplateId=<id>` 로 필터링해 옵션 재구성. |

### 5.4 farm_schedule.js

| 기능 | 수정 내용 |
|------|-----------|
| `loadFarmScheduleTaskTypes(structureTemplateId?)` | 선택적 쿼리 `structureTemplateId`로 농장 작업 유형 조회. (일정 모달에서 대상장소에 따라 필터된 목록용.) |
| `fillFarmScheduleItemTaskTypeOptions(structureTemplateId?)` | 인자로 **현재 모달의 대상장소 값** 전달. 해당 값으로 API 호출 후 옵션 채우기. "대상장소" 셀렉트 change 시 `fillFarmScheduleItemTaskTypeOptions(selectedId)` 호출. |
| 작업 유형 목록 모달 렌더 | "적용 대상" 컬럼 추가. |
| 작업 유형 추가/수정 | POST/PUT body에 `appliesToAllStructures`, `structureTemplateIds` 포함. 저장 후 목록/연결 테이블 반영. |
| 작업 유형 모달 오픈 시 | 구조 템플릿 목록은 전역 `GET /api/structureTemplates` 또는 농장 운영 시설 기반 목록 중 정책에 맞게 로드. |

### 5.5 백엔드

| 파일 | 수정 내용 |
|------|-----------|
| **models/ScheduleTaskType.js** | `appliesToAllStructures` 컬럼 추가 (default true). |
| **models/FarmScheduleTaskType.js** | `appliesToAllStructures` 컬럼 추가 (default true). |
| **models/** | `ScheduleTaskTypeStructure`, `FarmScheduleTaskTypeStructure` 모델 추가 (연결 테이블). |
| **models/index.js** | 새 모델 등록, ScheduleTaskType hasMany ScheduleTaskTypeStructure, FarmScheduleTaskType hasMany FarmScheduleTaskTypeStructure. |
| **routes/scheduleTaskTypes.js** | GET 시 `structureTemplateId` 쿼리 처리(필터 로직). POST/PUT 시 `appliesToAllStructures`, `structureTemplateIds` 처리 및 연결 테이블 저장. |
| **routes/farmScheduleTaskTypes.js** | 동일하게 GET 필터, POST/PUT 시 farm용 연결 테이블 처리. |
| **routes/farmStructure.js** | 운영 시설 저장 시 `farm_schedule_task_types` 복사할 때 `applies_to_all_structures` 복사; `schedule_task_type_structures` → `farm_schedule_task_type_structures` 매핑 복사 (원본 전역 id → 복사된 farm task type id). |

### 5.6 그 외 참고

- **대시보드 일정 페이지** (`dashboard-schedule.js`): 현재 일정 **표시**만 하고 작업 유형 셀렉트를 쓰지 않으면 수정 불필요. 나중에 "일정 추가" 등을 넣을 때는 farm_admin과 동일하게 **대상장소 기준 작업 유형 필터** 적용하면 된다.
- **기존 데이터**: `applies_to_all_structures` default true이므로 기존 행은 모두 "전체 시설"로 동작한다.

---

## 6. 구현 순서 제안

1. **DB·모델**: `applies_to_all_structures` 컬럼, `schedule_task_type_structures`, `farm_schedule_task_type_structures` 테이블 및 모델 추가.  
2. **API**: GET 필터(`structureTemplateId`), POST/PUT에서 적용 대상·연결 테이블 처리.  
3. **admin**: 작업 유형 목록/추가/수정 모달 UI 및 일정 항목 모달에서 대상장소 변경 시 작업 유형 필터.  
4. **farm_admin**: 동일하게 작업 유형 목록/추가/수정 모달, 일정 항목 모달 필터.  
5. **farmStructure**: 운영 시설 저장 시 적용 대상·연결 테이블 복사 로직 추가.

이 순서로 적용하면 작업 유형을 "전체 시설 / 특정 장소"로 구분하고, 스케줄 추가 시 대상장소에 맞는 작업 유형만 노출되도록 할 수 있다.
