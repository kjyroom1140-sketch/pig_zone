# 일정 추가/수정 화면 → DB 저장 위치 매핑

admin.html **일정관리 설정 → 일정 항목 → 일정 추가/수정** 모달에 나오는 입력 항목이 **어느 테이블·어느 컬럼**에 저장되는지 정리한 문서입니다.  
(일정관리 재설계 후 UI가 바뀌면 이 매핑도 수정 예정.)

---

## 저장 대상 테이블

| 항목 | 값 |
|------|-----|
| **테이블명** | `schedule_items` |
| **모델** | `ScheduleItem` (models/ScheduleItem.js) |
| **API** | POST `/api/scheduleItems` (추가), PUT `/api/scheduleItems/:id` (수정) |

---

## 화면 필드 → DB 컬럼 매핑

| 화면에 보이는 항목 | input/select ID | API 전송 키 | DB 테이블 | DB 컬럼 | 비고 |
|-------------------|-----------------|------------|-----------|---------|------|
| **구분** * | `scheduleItemTargetType` | `targetType` | schedule_items | **targetType** | sow, boar, non_breeding, facility (모돈/옹돈/비번식돈/시설) |
| **대상장소** | `scheduleItemStructureTemplateId` | `structureTemplateId` | schedule_items | **structureTemplateId** | FK → structure_templates.id, 선택 안 함이면 null |
| **기준** | `scheduleItemBasisTypeId` | `basisTypeId` | schedule_items | **basisTypeId** | FK → schedule_item_types.id (kind='basis'), 선택 안 함이면 null |
| **일령** | `scheduleItemAgeLabel` | `ageLabel` | schedule_items | **ageLabel** | 구분=돼지일 때만 표시·저장 (예: 0, 1~7, 21~28) |
| **날짜(시작) 일수** | `scheduleItemDayMin` | `dayMin` | schedule_items | **dayMin** | 구분=돼지 또는 시설+입식일일 때만 표시·저장 |
| **날짜(끝) 일수** | `scheduleItemDayMax` | `dayMax` | schedule_items | **dayMax** | 위와 동일 |
| **반복** (매일/매주/매월 등) | `scheduleItemRecurrenceType` 또는 시설 기준 선택값 | `recurrenceType` | schedule_items | **recurrenceType** | daily, weekly, monthly, yearly. 시설+매일/매주/매월이면 기준에서 자동 매핑 |
| 반복 옵션: **요일** (일~토 체크) | `.schedule-recur-weekday` | `recurrenceWeekdays` | schedule_items | **recurrenceWeekdays** | 매주일 때만 (예: "1,4" = 월,목) |
| 반복 옵션: **매월 n일** | `scheduleItemRecurrenceMonthDay` | `recurrenceMonthDay` | schedule_items | **recurrenceMonthDay** | 매월일 때만 (1~31) |
| **작업유형** * | `scheduleItemTaskTypeId` | `taskTypeId` | schedule_items | **taskTypeId** | FK → schedule_item_types.id (kind='task', 필수) |
| **작업내용** | `scheduleItemDescription` | `description` | schedule_items | **description** | TEXT, 빈 값이면 null |

---

## 화면에 없지만 DB에 있는 컬럼

| DB 컬럼 | 설명 | 저장 시점 |
|---------|------|-----------|
| **id** | 일정 항목 고유 ID | 추가 시 자동 생성 |
| **sortOrder** | 정렬 순서 | API에서 기존 목록 재정렬 시 PUT으로 전달 |
| **isActive** | 사용 여부 | 기본값 true (모달에서 직접 입력 없음) |
| **recurrenceInterval** | 반복 간격 (예: 2주마다=2) | API 기본 1 |
| **recurrenceStartDate** | 반복 시작일 | 현재 모달에서는 미사용 |
| **recurrenceEndDate** | 반복 종료일 | 현재 모달에서는 미사용 |
| **createdAt**, **updatedAt** | 생성/수정 시각 | 자동 |

---

## 구분·기준에 따른 필드 표시 요약

- **구분 = 모돈/옹돈/비번식돈**: 일령, 날짜(시작) 일수, 날짜(끝) 일수 표시 → **ageLabel**, **dayMin**, **dayMax** 저장.
- **구분 = 시설 + 기준 입식일(등)**: 날짜(시작) 일수, 날짜(끝) 일수만 표시 → **dayMin**, **dayMax** 저장.
- **구분 = 시설 + 기준 매일/매주/매월**: 일령·일수 필드 숨김, 반복 옵션(요일/매월 n일)만 표시 → **recurrenceType**, **recurrenceWeekdays** 또는 **recurrenceMonthDay** 저장.

---

## 참고

- **structure_templates**: 농장 구조 템플릿(사육시설/일반시설) 마스터. 대상장소 셀렉트 옵션 출처.
- **schedule_item_types**: 전역 기준 유형·작업 유형 통합 테이블. kind='basis' → 기준 셀렉트, kind='task' → 작업유형 셀렉트 출처. (참고: [schedule_item_types_unified_table.md](./schedule_item_types_unified_table.md))
