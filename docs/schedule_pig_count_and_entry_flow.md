# 일정 관리 - 사육 두수 출처 & 전입 두수 저장 위치

## 1. 사육 두수는 어디서 불러오는지

### 1-1. 일정 관리 화면에서의 흐름

1. **프론트** (`public/js/dashboard-schedule.js`)
   - 그리드 로드 시 `GET /api/farm-facilities/:farmId/tree` 호출
   - 응답의 **트리 데이터**(건물 → 층 → 돈사 → 방 → **칸(sections)**)를 `dashboardTreeData`에 저장
   - 각 **칸(section)** 에는 `currentPigCount` 값이 들어 있음

2. **백엔드** (`routes/farmFacilities.js` – `GET /:farmId/tree`)
   - 먼저 **farm_sections** 기준으로 트리 구조 조회 (이때 DB의 `currentPigCount` 컬럼 값도 옴)
   - 그 다음 **사육 두수 하이브리드** 로직으로 각 칸의 `currentPigCount`를 **다시 계산**해서 덮어씀

### 1-2. 사육 두수 결정 우선순위 (같은 칸 기준)

아래 순서로 **하나라도 있으면** 그 값이 해당 칸의 사육 두수로 사용됩니다.

| 순위 | 출처 | 테이블/컬럼 | 설명 |
|------|------|-------------|------|
| 1 | **pig_groups** | `current_section_id` 별 `headcount` 합계 | 해당 칸을 현재 위치로 가진 활성 돈군들의 두수 합 |
| 2 | **section_group_occupancy** | `section_id` 별 `headcount` 합 (ended_at IS NULL) | 칸–돈군 배치에서 “현재 재적” 두수 합 |
| 3 | **farm_sections** | `current_pig_count` | 칸 테이블에 직접 저장된 값 (폴백) |

- 코드 위치: `routes/farmFacilities.js` 181~209라인  
- 주석: "사육 두수 하이브리드: pig_groups(또는 section_group_occupancy) 우선, 없으면 farm_sections.currentPigCount"

### 1-3. 일정 그리드에서의 사용

- `dashboard-schedule.js` 의 `sumSectionPigs(sections)` → 각 칸의 `currentPigCount` 합산
- 방/돈사/층/건물별 합계는 이 칸 합계를 단계별로 더해서 계산
- “사육두수 없음” 여부는 `section.currentPigCount` 가 0/없음인지로 판단

**요약:** 일정 관리에 보이는 사육 두수는  
**`/api/farm-facilities/:farmId/tree`** 가 **pig_groups → section_group_occupancy → farm_sections.currentPigCount** 순으로 정한 값이며, 프론트는 이 트리 안의 **칸(section).currentPigCount** 를 그대로 사용합니다.

---

## 2. 전입으로 저장 시 전입 두수는 어디로 저장되는지

### 2-1. 항상 저장되는 곳

| 저장 위치 | 테이블 | 컬럼 | 설명 |
|-----------|--------|------|------|
| 작업 계획 | **farm_schedule_work_plans** | **entry_count** | 전입 작업 계획의 “전입 두수” (항상 저장) |

- API: `POST /api/farms/:farmId/schedule-work-plans`
- 코드: `routes/farmScheduleItems.js` – `FarmScheduleWorkPlan.create()` 시 `entryCount` 전달  
- 모델: `models/FarmScheduleWorkPlan.js` – `entryCount` 필드

### 2-2. “완료함” 체크 후 저장 시 추가로 저장되는 곳

전입일 + **완료일(completedDate)** + **전입 두수(entryCount)** 가 있으면, 같은 전입 두수로 아래에도 저장됩니다.

| 저장 위치 | 테이블 | 컬럼 | 설명 |
|-----------|--------|------|------|
| 돈군 | **pig_groups** | **headcount** | 새로 만든 돈군의 두수 = 전입 두수 |
| 이동 이력 | **pig_movements** | **headcount** | 전입 이동 1건의 두수 = 전입 두수 |

- 돈군 생성: `PigGroup.create({ ..., headcount: entryCountNum, ... })`
- 이동 생성: `PigMovement.create({ ..., headcount: entryCountNum, movementType: 'entry', ... })`
- 코드: `routes/farmScheduleItems.js` 316~343라인 부근

이후 **사육 두수**는 위 1절처럼 **pig_groups** 의 `current_section_id` 별 `headcount` 합으로 다시 계산되므로, 전입 완료로 만든 돈군의 두수가 일정 관리 그리드의 “사육 두수”에 반영됩니다.

### 2-3. 요약

- **전입 두수**는  
  - 항상: **farm_schedule_work_plans.entry_count**  
  - 완료함 저장 시 추가: **pig_groups.headcount**, **pig_movements.headcount**
- 일정 관리의 **사육 두수**는  
  - **GET /api/farm-facilities/:farmId/tree** 에서  
  - **pig_groups** → **section_group_occupancy** → **farm_sections.current_pig_count** 순으로 정해진 **칸별 currentPigCount** 를 사용합니다.
