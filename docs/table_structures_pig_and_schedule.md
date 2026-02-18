# 테이블 컬럼 구조 정리

돈군·객체·이동·작업 스케줄 관련 테이블의 컬럼 구조를 정리한 문서입니다.  
일정 관련 테이블(schedule_item_types, schedule_items, farm_schedule_* 등)은 서버 기동 시 **Sequelize sync**로 생성됩니다. 재설계 가이드: [schedule_redesign_guide.md](./schedule_redesign_guide.md).

---

## 1. 돈군 테이블 (pig_groups)

한 무리 단위. 일정·이동·사육의 기본 단위.

| 컬럼명 (DB) | 타입 | NULL | 설명 |
|-------------|------|------|------|
| id | UUID | N (PK) | PK (DB 내부 식별자), 기본값 gen_random_uuid() |
| farm_id | UUID | N | 농장 ID (FK → farms.id) |
| group_no | VARCHAR(30) | Y | 돈군 번호(사람이 보는 식별자). 생성 일시 기반 (예: ENT-1234567890) |
| current_section_id | UUID | Y | 현재 있는 칸 (FK → farm_sections.id) |
| entry_date | DATE | Y | 입식/전입일 |
| birth_date | DATE | Y | 출생일 |
| breed_type | VARCHAR(50) | Y | 대표 품종 |
| headcount | INTEGER | Y | 두수 |
| status | VARCHAR(30) | Y | 상태: active, split, merged, closed 등 |
| parent_group_id | UUID | Y | 분할 시 원래 돈군 (FK → pig_groups.id) |
| created_at | TIMESTAMP | N | 생성 일시 |
| updated_at | TIMESTAMP | N | 수정 일시 |

- **모델:** `models/PigGroup.js`
- **테이블:** `pig_groups`

---

## 2. 돼지 객체 테이블 (pigs)

RFID 등으로 개별 식별된 마리만 등록하는 테이블.

| 컬럼명 (DB) | 타입 | NULL | 설명 |
|-------------|------|------|------|
| id | UUID | N (PK) | PK |
| farm_id | UUID | N | 농장 ID (FK → farms.id) |
| pig_group_id | UUID | Y | 소속 돈군 (FK → pig_groups.id). NULL = 미편입/돈군 미사용 |
| individual_no | VARCHAR(50) | Y | 개체 번호(귀표 등) |
| ear_tag_type | VARCHAR(20) | Y | 귀표 유형: 'rfid', 'barcode', 'none' 등 |
| rfid_tag_id | VARCHAR(100) | Y | RFID 전자이표 ID. NULL이면 비RFID/미등록 |
| breed_type | VARCHAR(50) | Y | 품종 (pig_breeds 참조 또는 코드) |
| gender | VARCHAR(20) | Y | 성별 (암컷/수컷 등) |
| birth_date | DATE | Y | 출생일 |
| entry_date | DATE | Y | 전입/입식일 |
| status | VARCHAR(30) | Y | 상태 (사육중, 출하, 폐사 등) |
| created_at | TIMESTAMP | N | 생성 일시 |
| updated_at | TIMESTAMP | N | 수정 일시 |

- **모델:** `models/Pig.js`
- **테이블:** `pigs`

---

## 3. 이동 테이블 (pig_movements)

이동 1건 = 1행. 돈군 단위 기록. 사별(칸/방/돈사) 조회 가능.

| 컬럼명 (DB) | 타입 | NULL | 설명 |
|-------------|------|------|------|
| id | UUID | N (PK) | PK |
| farm_id | UUID | N | 농장 ID (FK → farms.id, 사별/농장별 조회용) |
| pig_group_id | UUID | Y | 이동한 돈군 (FK → pig_groups.id). NULL = 돈군 미지정 두수 이동 등 |
| from_section_id | UUID | Y | 출발 칸 (FK → farm_sections.id). 전입은 NULL 가능 |
| to_section_id | UUID | Y | 도착 칸 (FK → farm_sections.id). 출하·폐사는 NULL 가능 |
| moved_at | TIMESTAMP/DATE | N | 이동 일시 |
| headcount | INTEGER | Y | 이동 두수 |
| split_percentage | INTEGER | Y | 분할 시 원 돈군 대비 이 목적지(to)로 간 비율(0~100). 일반이동/전입/출하 시 NULL |
| movement_type | VARCHAR(30) | Y | transfer(일반이동), entry(전입), shipment(출하), merge, split 등 |
| source_group_id | UUID | Y | 분할 시 원 돈군 id (FK → pig_groups.id). 같은 분할 이벤트 행 묶을 때 사용 |
| schedule_item_id | INTEGER | Y | 일정 연계 (FK → farm_schedule_items.id, 해당 시 선택) |
| moved_by | UUID | Y | 실행자 (FK → users.id) |
| memo | TEXT | Y | 비고 |
| created_at | TIMESTAMP | N | 생성 일시 |

- **모델:** `models/PigMovement.js`
- **테이블:** `pig_movements`
- **참고:** `updated_at` 컬럼 없음 (모델에서 updatedAt: false)

---

## 4. 전역 일정 테이블 (sync로 생성)

### 4.1 schedule_item_types (기준 유형·작업 유형 통합)

| 컬럼명 (DB) | 타입 | NULL | 설명 |
|-------------|------|------|------|
| id | SERIAL | N (PK) | 고유 ID |
| kind | VARCHAR(10) | N | 'basis' (기준) \| 'task' (작업) |
| code | VARCHAR(50) | Y | 코드 |
| name | VARCHAR(100) | N | 표시명 |
| targetType | VARCHAR(20) | Y | 구분: pig, facility (기준 유형용) |
| description | TEXT | Y | 설명 (기준 유형용) |
| category | VARCHAR(50) | Y | 대분류 (작업 유형용) |
| sortOrder | INTEGER | Y | 정렬 순서, 기본값 0 |
| appliesToAllStructures | BOOLEAN | Y | 전체 시설 적용 여부 (작업 유형용), 기본 true |
| createdAt, updatedAt | TIMESTAMP | N | 생성/수정 시각 |

- **모델:** `models/ScheduleItemType.js`
- **참고:** [schedule_item_types_unified_table.md](./schedule_item_types_unified_table.md)

### 4.2 schedule_task_type_structures (작업 유형 ↔ 시설 템플릿)

| 컬럼명 (DB) | 타입 | NULL | 설명 |
|-------------|------|------|------|
| id | SERIAL | N (PK) | 고유 ID |
| scheduleTaskTypeId | INTEGER | N | FK → schedule_item_types.id (kind='task') |
| structureTemplateId | INTEGER | N | FK → structure_templates.id |
| createdAt, updatedAt | TIMESTAMP | N | 생성/수정 시각 |

- **모델:** `models/ScheduleTaskTypeStructure.js`

### 4.3 schedule_items (전역 일정 항목)

| 컬럼명 (DB) | 타입 | NULL | 설명 |
|-------------|------|------|------|
| id | SERIAL | N (PK) | 고유 ID |
| targetType | VARCHAR(20) | N | 구분: pig, facility 등 |
| structureTemplateId | INTEGER | Y | FK → structure_templates.id |
| basisTypeId | INTEGER | Y | FK → schedule_item_types.id (kind='basis') |
| ageLabel | VARCHAR(50) | Y | 일령 표시 |
| dayMin, dayMax | INTEGER | Y | 날짜(시작/끝) 일수 |
| taskTypeId | INTEGER | N | FK → schedule_item_types.id (kind='task') |
| description | TEXT | Y | 작업내용 |
| sortOrder | INTEGER | Y | 정렬 순서 |
| isActive | BOOLEAN | N | 사용 여부, 기본 true |
| recurrenceType, recurrenceInterval, recurrenceWeekdays, recurrenceMonthDay, recurrenceStartDate, recurrenceEndDate | (각각) | Y | 반복 설정 |
| createdAt, updatedAt | TIMESTAMP | N | 생성/수정 시각 |

- **모델:** `models/ScheduleItem.js`

---

## 5. 농장 일정 항목 테이블 (farm_schedule_items)

농장별 “어떤 작업을 할지” 정의. 작업 스케줄의 템플릿/정의 역할.

| 컬럼명 (DB) | 타입 | NULL | 설명 |
|-------------|------|------|------|
| id | INTEGER | N (PK) | 농장 일정 항목 고유 ID (자동 증가) |
| farmId | UUID | N | 농장 ID (FK → farms.id) |
| targetType | STRING(20) | N | 구분: pig(돼지), facility(시설), 기본값 'pig' |
| structureTemplateId | INTEGER | Y | 대상장소 (FK → structure_templates.id) |
| basisTypeId | INTEGER | Y | 기준 (FK → farm_schedule_basis_types.id) |
| ageLabel | STRING(50) | Y | 일령 표시 (예: 0, 1~7) |
| dayMin | INTEGER | Y | 날짜(시작) - 일수 |
| dayMax | INTEGER | Y | 날짜(끝) - 일수 |
| taskTypeId | INTEGER | N | 작업유형 (FK → farm_schedule_task_types.id) |
| description | TEXT | Y | 작업내용 |
| sortOrder | INTEGER | Y | 정렬 순서, 기본값 0 |
| isActive | BOOLEAN | N | 사용 여부, 기본값 true |
| recurrenceType | STRING(20) | Y | none \| daily \| weekly \| monthly \| yearly |
| recurrenceInterval | INTEGER | Y | 반복 간격(기본 1) |
| recurrenceWeekdays | STRING(20) | Y | 주간 시 요일 (0=일..6=토) |
| recurrenceMonthDay | INTEGER | Y | 월간 시 일(1-31) |
| recurrenceStartDate | DATE | Y | 반복 시작일 |
| recurrenceEndDate | DATE | Y | 반복 종료일(null=무기한) |
| createdAt | TIMESTAMP | N | 생성 일시 |
| updatedAt | TIMESTAMP | N | 수정 일시 |

- **모델:** `models/FarmScheduleItem.js`
- **테이블:** `farm_schedule_items`
- **참고:** 모델이 underscored: false 이면 DB 컬럼명이 camelCase일 수 있음.

---

## 6. 작업 계획 테이블 (farm_schedule_work_plans)

일정 항목와 분리하여, “언제·어디서·완료했는지” 예정/완료를 관리.

| 컬럼명 (DB) | 타입 | NULL | 설명 |
|-------------|------|------|------|
| id | INTEGER | N (PK) | 고유 ID (자동 증가) |
| farmId | UUID | N | 농장 (FK → farms.id, 권한·파티션용) |
| farmScheduleItemId | INTEGER | N | 해당 일정 항목 (FK → farm_schedule_items.id) |
| taskTypeCategory | STRING(50) | Y | 작업 유형 대분류 (이동/환경 등). farm_schedule_task_types.category와 동일. 필터용 |
| roomId | UUID | Y | 대상 방 (FK → farm_rooms.id). 이벤트/대상 단위 시 |
| sectionId | UUID | Y | 대상 칸 (FK → farm_sections.id). 이벤트/대상 단위 시 |
| plannedStartDate | DATE | N | 예정 시작일 |
| plannedEndDate | DATE | N | 예정 종료일 |
| entrySource | STRING(200) | Y | 전입처 (사육두수 없을 때 전입 작업 추가 시) |
| entryCount | INTEGER | Y | 전입 두수 (사육두수 없을 때 전입 작업 추가 시) |
| completedDate | DATE | Y | 완료 일자 (완료 체크 시 기록) |
| completedAt | TIMESTAMP | Y | 완료 체크 시각 |
| completedBy | UUID | Y | 완료 체크한 사용자 (FK → users.id, 감사·통계용) |
| createdAt | TIMESTAMP | N | 생성 일시 |
| updatedAt | TIMESTAMP | N | 수정 일시 |

- **모델:** `models/FarmScheduleWorkPlan.js`
- **테이블:** `farm_schedule_work_plans`
- **참고:** 모델이 underscored: false 이면 DB 컬럼명이 camelCase일 수 있음.

---

## 관계 요약

- **pig_groups** ← pigs (pig_group_id), pig_movements (pig_group_id, source_group_id), section_group_occupancy (pig_group_id)
- **pig_movements** → pig_groups, farm_sections (from/to), farm_schedule_items (schedule_item_id), users (moved_by)
- **schedule_item_types** ← schedule_items (basisTypeId, taskTypeId), schedule_task_type_structures (scheduleTaskTypeId), farm_schedule_basis_types (originalId), farm_schedule_task_types (originalId)
- **schedule_items** → schedule_item_types, structure_templates
- **farm_schedule_work_plans** → farm_schedule_items (farmScheduleItemId), farm_rooms (roomId), farm_sections (sectionId), farms (farmId), users (completedBy)
- **farm_schedule_items** → farms, structure_templates, farm_schedule_basis_types, farm_schedule_task_types
- **farm_schedule_basis_types** / **farm_schedule_task_types** → farms, schedule_item_types (originalId)
