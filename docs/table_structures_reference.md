# 테이블 구조 참고 (이미지 기준 테이블)

이미지에 나온 테이블 이름 기준으로, 코드·문서에서 파악한 구조를 정리했습니다.

---

## 데이터 타입 규칙 (통일)

- **ID·FK 컬럼**: DB는 **INTEGER**, 앱(Go/JS)은 **숫자 타입**만 사용.
- 구분/기준/작업유형 테이블의 FK가 TEXT로 되어 있으면 `scripts/schedule_tables_fk_to_integer.sql` 또는 `node scripts/run_schedule_tables_fk_to_integer.js` 로 INTEGER로 변경 후 사용.

---

## 1. structure_templates

**역할:** 시설 템플릿(대상 장소). 농장 구조 설정 화면에서 사육시설(production)·일반시설(support) 목록으로 사용.

| 컬럼 (DB) | 타입 | 설명 |
|-----------|------|------|
| id | INTEGER (PK) | 고유 ID |
| name | VARCHAR | 시설명 |
| category | enum_structure_templates_category | 'production' \| 'support' |
| weight | VARCHAR (nullable) | 체중 범위 (예: "30~50") |
| optimalDensity | FLOAT (nullable) | 적정면적(두수당) |
| ageLabel | VARCHAR (nullable) | 입실 일령 |
| description | TEXT (nullable) | 설명 |
| sortOrder | INTEGER | 정렬 순서 (같은 category 내) |
| createdAt, updatedAt | TIMESTAMP | 생성/수정 시각 |

- **연결:** schedule_sortations.structure_template_id, farm_schedule_items.structureTemplateId, farm_structure.templateId 등에서 FK로 참조.

---

## 2. schedule_sortations

**역할:** “구분”. 대상 장소(structure_templates)별로 쓰는 구분 목록.

| 컬럼 (DB) | 타입 | 설명 |
|-----------|------|------|
| id | INTEGER (PK) | 고유 ID |
| structure_template_id | INTEGER (nullable) | 대상장소 FK → structure_templates.id |
| sortations | TEXT (nullable) | 구분 데이터(JSON 등) |
| createdAt, updatedAt | TIMESTAMP | 생성/수정 시각 |

- **연결:** schedule_criterias.schedule_sortations_id → schedule_sortations.id (1:N).

---

## 3. schedule_criterias

**역할:** “기준”. 구분(schedule_sortations)별로 쓰는 기준 목록. **기준 추가 시**: 구분에서 선택한 목록의 id → `schedule_sortations_id` 컬럼, 입력한 기준 이름 → `criterias` 컬럼(JSON)에 저장.

| 컬럼 (DB) | 타입 | 설명 |
|-----------|------|------|
| id | INTEGER (PK) | 고유 ID |
| schedule_sortations_id | INTEGER (nullable) | 구분 FK → schedule_sortations.id |
| criterias | TEXT (nullable) | 기준 데이터(JSON, 예: [{"name":"기준이름"}]) |
| createdAt, updatedAt | TIMESTAMP | 생성/수정 시각 |

- **연결:** schedule_jobtypes.schedule_criterias_id → schedule_criterias.id (1:N).

---

## 4. schedule_jobtypes

**역할:** “작업유형”. 기준(schedule_criterias)별로 쓰는 작업유형·세부 목록.

| 컬럼 (DB) | 타입 | 설명 |
|-----------|------|------|
| id | INTEGER (PK) | 고유 ID |
| schedule_criterias_id | INTEGER (nullable) | 기준 FK → schedule_criterias.id |
| jobtypes | TEXT (nullable) | 작업유형/세부 데이터(JSON) |
| createdAt, updatedAt | TIMESTAMP | 생성/수정 시각 |

---

## 5. schedule_work_plans

**문서상:** 일정 “작업 계획”의 전역/마스터 개념으로 언급됨.  
**코드 사용:** 실제 조회·INSERT는 **farm_schedule_work_plans** 테이블 사용 (농장별 작업 계획).

- **schedule_work_plans** (문서): structure_templates, schedule_sortations, schedule_criterias, schedule_jobtypes 등을 JSON 컬럼으로 참조하는 구조로 설명됨.
- **farm_schedule_work_plans** (코드 사용): 농장별 실행 계획.

| 컬럼 (DB) – farm_schedule_work_plans | 타입 | 설명 |
|--------------------------------------|------|------|
| id | INTEGER (PK) | 고유 ID |
| farmId | UUID | 농장 FK → farms.id |
| farmScheduleItemId | INTEGER | 일정 항목 FK → farm_schedule_items.id |
| taskTypeCategory | VARCHAR(50) (nullable) | 작업 유형 대분류 |
| roomId | UUID (nullable) | 대상 방 FK → farm_rooms.id |
| sectionId | UUID (nullable) | 대상 칸 FK → farm_sections.id |
| plannedStartDate | DATE | 예정 시작일 |
| plannedEndDate | DATE | 예정 종료일 |
| entrySource | VARCHAR (nullable) | 전입처 |
| entryCount | INTEGER (nullable) | 전입 두수 |
| completedDate | DATE (nullable) | 완료 일자 |
| createdAt, updatedAt | TIMESTAMP | 생성/수정 시각 |

---

## 6. section_group_occupancy

**역할:** 문서에서는 “농장·농장별 업무” 영역에서 **pig_group_id**와 함께 참조됨. 칸(section)별 돈군 점유/배치 정보로 추정.

- 코드베이스에는 컬럼 정의·쿼리가 없어, **실제 DB 스키마는 DB 클라이언트에서 직접 확인**하는 것이 좋습니다.

---

## 계층 요약

```
structure_templates (대상장소)
    └── schedule_sortations (구분) [structure_template_id]
            └── schedule_criterias (기준) [schedule_sortations_id]
                    └── schedule_jobtypes (작업유형) [schedule_criterias_id]
```

- **farm_schedule_work_plans**는 농장·일정 항목(farm_schedule_items) 기준으로 “언제·어디서” 실행/완료할지 저장.
- **section_group_occupancy**는 돈군(pig_groups)과 칸(section) 관계 추적용으로 문서에만 등장.

DB 컬럼명이 camelCase로 저장된 경우(예: "optimalDensity", "sortOrder")는 쿼리에서 큰따옴표로 감싼 이름을 사용하고 있습니다.
