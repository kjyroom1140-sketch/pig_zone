# 사육두수 없을 때 작업 추가 설계 (전입 vs 시설)

일정(작업) 관리에서 **사육두수가 없는** 구간에 작업을 추가할 때, **전입**과 **시설** 두 가지를 구분해 설계·구현하기 위한 정리 문서입니다.

---

## 1. 적용 범위

| 조건 | 설명 |
|------|------|
| **사육두수 없음** | 해당 장소(돈사·방·칸)에 현재 돼지가 없음 (`currentPigCount === 0` 또는 pig_groups/section_group_occupancy 기준 0두). |
| **운영돈사 중 하위 돈사가 없는 경우** | 선택한 단위가 **운영돈사(production barn)** 이고, 그 아래 **하위 돈사가 없는** 구조. 즉, “돈사 → 방 → 칸” 중 **돈사** 또는 **방/칸** 단위로 선택한 상황. |

이때 작업 추가는 **1) 전입** 과 **2) 시설** 두 가지로 구분합니다.

---

## 2. 두 가지 작업 유형 요약

| 구분 | 전입 | 시설 |
|------|------|------|
| **의미** | 해당 돈사(방/칸)에 **돼지 전입**을 계획·등록하는 작업. 저장 시 **돈군 생성** 및 **사육두수 반영**이 이뤄짐. | 해당 돈사(방/칸)에 대한 **시설 관련 작업**(관리·환경·방역 등). 돼지 두수와 무관하게 **작업 내용**만 기록. |
| **저장 시 처리** | 돈군 생성(`pig_groups`) + 사육두수 반영(`farm_sections.currentPigCount` 또는 `pig_groups`/`section_group_occupancy`) | 작업 계획(`farm_schedule_work_plans`) 1건 생성. 작업 유형(관리/환경/방역) + **작업 내용(텍스트)** 저장. |
| **일정 항목** | 전입 전용 일정 항목(`farm_schedule_items`, 예: taskType=전입) | 시설용 일정 항목(taskType=관리/환경/방역 등) |

---

## 3. 전입 작업 추가 설계

### 3.1 흐름

1. 사용자가 **사육두수 없는** 돈사(또는 방/칸)의 날짜 셀을 클릭 → 작업 추가 모달 오픈.
2. **작업 유형**에서 **전입** 선택.
3. **전입 정보 입력**: 전입 예정일(또는 예정 시작·종료일), **전입 두수**, 필요 시 입식일·품종·비고 등.
4. **저장** 클릭 시:
   - **작업 계획** 1건 생성 (`farm_schedule_work_plans`: 예정 시작일·종료일, 대상 roomId/sectionId).
   - **돈군 생성** (`pig_groups`):  
     - `farmId`, `current_section_id` = 선택한 칸(또는 해당 방의 대표 칸), `headcount` = 전입 두수, `status = 'active'`, `entry_date` = 전입일 등.
   - **사육두수 반영**  
     - **방안 A**: `farm_sections.currentPigCount` += 전입 두수 (해당 칸이 1개일 때).  
     - **방안 B**: `section_group_occupancy`에 1행 추가 (`section_id`, `pig_group_id`, `headcount`, `ended_at = NULL`).  
     - 문서상 권장: **pig_groups + section_group_occupancy(또는 pig_groups만)** 로 사육두수 관리 시, 트리/그리드의 사육두수는 해당 테이블 기준으로 조회하므로 **돈군 생성만** 하면 됨. (`farm_sections.currentPigCount` 동기화는 선택 사항.)

### 3.2 데이터 연동

| 처리 | 테이블/API | 비고 |
|------|------------|------|
| 작업 계획 | `farm_schedule_work_plans` | farmScheduleItemId = 전입용 일정 항목, plannedStartDate/End, roomId/sectionId. |
| 돈군 생성 | `pig_groups` | docs: `pig_object_group_movement_tables.md` §1.2. current_section_id, headcount, entry_date, status='active'. |
| 사육두수 | `pig_groups` 합계 또는 `section_group_occupancy` | 동 문서 §1. “사육 두수”는 이동 테이블이 아닌 돈군(또는 배치) 테이블 기준. |

### 3.3 API 제안

- **POST /api/farms/:farmId/schedule-work-plans**  
  - body에 `entryHeadcount`, `entryDate`(또는 plannedStartDate를 전입일로 사용) 등이 있으면 **전입**으로 판단.  
  - 서버에서: (1) `FarmScheduleWorkPlan` 생성, (2) `PigGroup` 생성, (3) 필요 시 `SectionGroupOccupancy` 생성 또는 `farm_sections.currentPigCount` 갱신.
- 또는 **POST /api/farms/:farmId/entry** 전용 API를 두고, 그 안에서 돈군 생성 + (선택) 작업 계획 1건 생성.

---

## 4. 시설 작업 추가 설계 (관리·환경·방역)

### 4.1 흐름

1. 사용자가 **사육두수 없는** 돈사(방/칸)의 날짜 셀 클릭 → 작업 추가 모달 오픈.
2. **작업 유형**에서 **시설** 선택.
3. **시설 항목(카테고리)** 선택: **관리** | **환경** | **방역** (필요 시 세부 유형 확장).
4. **작업 내용** 입력: 자유 텍스트 또는 구조화된 입력(예: 점검 항목, 소독제명, 온도 등).
5. **저장** 클릭 시:
   - **작업 계획** 1건만 생성 (`farm_schedule_work_plans`).  
   - 돈군·사육두수는 변경하지 않음.

### 4.2 시설 항목(관리·환경·방역) 정의

| 항목 | 설명 | 일정 항목과의 관계 |
|------|------|---------------------|
| **관리** | 시설 점검, 정리정돈, 설비 확인 등. | `farm_schedule_items`에서 taskType.category = `management` 또는 시설용 작업유형 1개. |
| **환경** | 환기, 온도·습도, 조명, 분뇨 처리 등. | taskType.category = `environment`. |
| **방역** | 소독, 세척, 질병 예방 조치 등. | taskType.category = `disinfection` 또는 `biosecurity`. |

- **추천**: 기존 **작업 유형**(`farm_schedule_task_types`)의 **category**를 “관리 / 환경 / 방역”에 매핑해 두고, 시설 작업 추가 시 **해당 category의 일정 항목**만 셀렉트에 노출.  
- 시설용 일정 항목이 없으면, “시설 작업 유형” 마스터를 별도 두거나, **작업 계획에만** “시설 카테고리(관리/환경/방역) + 작업 내용”을 저장하는 **경량 모델**도 가능.

### 4.3 작업 내용 저장 방법

| 방안 | 설명 | 장점 | 단점 |
|------|------|------|------|
| **A. work_plan에만 저장** | `farm_schedule_work_plans`에 **workContent** 또는 **memo** 컬럼 추가. 시설 선택 시 “항목(관리/환경/방역)” + 이 필드에 작업 내용 입력. | 스키마 변경 최소. 시설 작업이 “일정 정의” 없이도 등록 가능. | 일정 항목(farm_schedule_items)과의 연결이 느슨해짐. |
| **B. 일정 항목 + description** | 시설용 **farm_schedule_items**를 “관리”, “환경”, “방역” 등으로 미리 등록해 두고, 작업 추가 시 해당 일정 항목 선택 + **예정일**만 저장. “작업 내용”은 나중에 **work_plan.memo** 또는 별도 필드로 추가. | 기존 작업 계획·일정 항목 체계와 일치. | 시설용 일정 항목 수가 늘어남. |
| **C. 시설 전용 테이블** | 시설 작업만 별도 테이블(예: `farm_facility_work_log`)에 “대상(돈사/방/칸), 카테고리(관리/환경/방역), 작업 내용, 예정일/완료일” 저장. | 시설 업무에 최적화된 구조. | 일정 그리드와 별도 조회·UI 필요. |

**권장**:  
- **단기**: **방안 A** — `farm_schedule_work_plans`에 **workContent**(TEXT, NULL) 추가. 시설 선택 시 taskTypeCategory = `facility` 또는 `management`/`environment`/`disinfection`, farmScheduleItemId는 “시설 공통” 1개 또는 카테고리별 1개씩 두고, **작업 내용**은 workContent에 저장.  
- **중장기**: 시설 작업이 많아지면 **방안 B**로 시설용 일정 항목을 관리/환경/방역별로 늘리고, workContent는 “추가 메모”로만 사용.

### 4.4 UI 제안 (시설)

1. 모달에서 **“전입 / 시설”** 또는 **작업 유형(일정 항목)** 선택 시 **시설** 계열 선택.
2. **시설 항목** 셀렉트: **관리** | **환경** | **방역**.
3. **작업 내용** 텍스트 영역(필수 또는 선택).
4. 예정 시작일·종료일(기존과 동일).
5. 저장 시 `POST .../schedule-work-plans` body에 예: `{ farmScheduleItemId, plannedStartDate, plannedEndDate, roomId?, sectionId?, workContent: "..." }` 전달.

---

## 5. 작업 추가 모달 통합 흐름 제안

1. **대상·날짜**: 그리드 셀 클릭으로 **동·사·방·칸** + **예정 시작일(기본값: 클릭한 날)** 확정.
2. **작업 구분 선택**: **전입** | **시설** (또는 기존처럼 일정 항목 셀렉트만 두고, 상단에 “전입 / 시설” 탭이나 라디오로 구분).
3. **전입 선택 시**  
   - 전입 두수, 전입일(또는 예정일), 필요 시 품종·비고 입력.  
   - 저장 → 작업 계획 생성 + 돈군 생성 + 사육두수 반영(돈군/배치 테이블 기준).
4. **시설 선택 시**  
   - 시설 항목(관리/환경/방역) 선택 → 작업 내용 입력.  
   - 저장 → 작업 계획만 생성(workContent 저장).
5. **기존 “일정 항목만 선택”** 방식은 그대로 두고, “전입/시설”은 그 위에 **빈방 전용 옵션**으로 추가하는 형태로 구현 가능.

---

## 6. 정리

| 구분 | 전입 | 시설 |
|------|------|------|
| **선택 조건** | 사육두수 없음 + 전입 작업 추가 | 사육두수 없음 + 시설 작업 추가 |
| **저장 시** | 작업 계획 + **돈군 생성** + **사육두수 반영** | **작업 계획** + 작업 내용(workContent) |
| **시설 항목** | — | 관리, 환경, 방역 (taskType.category 또는 별도 필드) |
| **참고 문서** | `pig_object_group_movement_tables.md`, `dashboard_schedule_register_and_completion.md` | `schedule_facility_management_recommendation.md`, `schedule_target_type_recommendation.md` |

이 설계를 기준으로 API·테이블 확장(workContent, 전입 시 돈군 생성 로직)과 모달 UI(전입/시설 구분, 시설 항목·작업 내용 입력)를 단계적으로 구현하면 됩니다.
