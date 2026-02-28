# 일정관리 테이블 구조 정리

대상장소 → 구분 → 기준 → 작업유형 연결 구조와 각 테이블 컬럼을 정리한 문서입니다.

---

## 1. 연결 구조 요약

```
대상장소 (structure_templates)
    │
    │  schedule_sortations.structure_template_id  →  장소 1 : N 구분
    ▼
구분 (schedule_sortations)
    │
    │  schedule_criterias.schedule_sortations_id  →  구분 1 : N 기준
    ▼
기준 (schedule_criterias)
    │
    │  schedule_jobtypes.schedule_criterias_id  →  기준 1 : N 작업유형
    ▼
작업유형 (schedule_jobtypes)
```

---

## 2. 테이블별 컬럼 정리

### 2.1 대상장소 — `structure_templates`

| 컬럼 | 타입 | NULL | 설명 |
|------|------|------|------|
| id | INTEGER | N (PK) | 고유 ID |
| category | VARCHAR | Y | 시설 구분 (production 등) |
| name | VARCHAR | Y | 시설명 (분만사, 자돈사 등) |
| description | TEXT | Y | 설명 |
| ageLabel | VARCHAR | Y | 일령 라벨 |
| sortOrder | INTEGER | Y | 정렬 순서 |
| createdAt | TIMESTAMP | N | 생성 일시 |
| updatedAt | TIMESTAMP | N | 수정 일시 |

- **역할**: 일정에서 선택하는 “대상 장소” 옵션 소스.
- **모델**: `StructureTemplate`

---

### 2.2 구분 — `schedule_sortations`

| 컬럼 | 타입 | NULL | 설명 |
|------|------|------|------|
| id | INTEGER | N (PK) | 고유 ID |
| **structure_template_id** | INTEGER | Y | 대상장소(structure_templates.id) FK |
| sortations | TEXT | Y | 구분 이름 등 JSON |
| createdAt | TIMESTAMP | N | 생성 일시 |
| updatedAt | TIMESTAMP | N | 수정 일시 |

- **역할**: “이 장소에서 쓰는 구분” 목록. `structure_template_id`로 장소별 필터.
- **모델**: `ScheduleSortation`
- **API**: `GET/POST /api/schedule-sortations`

---

### 2.3 기준 — `schedule_criterias`

| 컬럼 | 타입 | NULL | 설명 |
|------|------|------|------|
| id | INTEGER | N (PK) | 고유 ID |
| **schedule_sortations_id** | INTEGER | Y | 구분(schedule_sortations.id) FK |
| sortations | TEXT | Y | 정렬 데이터 |
| criterias | TEXT | Y | 기준 데이터(JSON) |
| description | TEXT | Y | 기준 유형 설명 |
| createdAt | TIMESTAMP | N | 생성 일시 |
| updatedAt | TIMESTAMP | N | 수정 일시 |

- **역할**: “이 구분에서 쓰는 기준” 목록. `schedule_sortations_id`로 구분별 필터.
- **모델**: `ScheduleCriteria`
- **API**: `GET/POST /api/schedule-criterias`

---

### 2.4 작업유형 — `schedule_jobtypes`

| 컬럼 | 타입 | NULL | 설명 |
|------|------|------|------|
| id | INTEGER | N (PK) | 고유 ID |
| **schedule_criterias_id** | INTEGER | Y | 기준(schedule_criterias.id) FK |
| jobtypes | TEXT | Y | 작업유형/세부 데이터(JSON) |
| createdAt | TIMESTAMP | N | 생성 일시 |
| updatedAt | TIMESTAMP | N | 수정 일시 |

- **역할**: “이 기준에서 쓰는 작업유형” 목록. `schedule_criterias_id`로 기준별 필터.
- **변경**: 기존 `criterias` 컬럼 제거, `schedule_criterias_id` 컬럼 추가.
- **모델**: `ScheduleJobtype`
- **API**: `GET/POST /api/schedule-jobtypes`

---

## 3. 일정 추가 모달 선택 순서

| 순서 | 항목 | 옵션 소스 테이블 | 필터 조건 |
|------|------|------------------|-----------|
| ① | 대상장소 | structure_templates | category=production 등 |
| ② | 구분 | schedule_sortations | structure_template_id = 선택 장소 (또는 null) |
| ③ | 기준 | schedule_criterias | schedule_sortations_id = 선택 구분 (또는 null) |
| ④ | 작업유형 | schedule_jobtypes | schedule_criterias_id = 선택 기준 (또는 null) |
| ⑤ | 작업 내용(세부) | schedule_jobtypes.jobtypes JSON | 대분류 선택 시 해당 세부 목록 |

---

## 4. 추가 저장 기능 검증 (일정 추가 모달 흐름)

각 단계에서 **「➕ 추가」** 선택 후 저장 시, 해당 테이블에 저장되는지 확인한 결과입니다.

| 단계 | 항목 | 추가 모달 | 저장 함수 | API | 저장 테이블 | FK 전달 |
|------|------|-----------|-----------|-----|-------------|---------|
| ① | 대상장소 | (없음) | — | — | structure_templates | 일정 모달에서는 기존 목록만 선택. 시설 기준 메뉴에서 별도 관리 |
| ② | 구분 | scheduleSortationAddModal | saveScheduleSortationAdd() | POST /api/schedule-sortations | **schedule_sortations** | structure_template_id = 현재 선택 장소 |
| ③ | 기준 | scheduleBasisAddModal | saveScheduleBasisAddModal() | POST /api/schedule-criterias | **schedule_criterias** | schedule_sortations_id = 현재 선택 구분 |
| ④ | 작업유형 | scheduleJobtypeAddModal | saveScheduleJobtypeAdd() | POST /api/schedule-jobtypes | **schedule_jobtypes** | schedule_criterias_id = 현재 선택 기준 |
| ⑤ | 세부(작업내용) | scheduleWorkDetailAddModal | saveScheduleWorkDetailAddModal() | POST /api/schedule-work-detail-types | schedule_work_detail_types | workTypeId = 현재 선택 대분류 |

- **구분 추가**: `ScheduleSortation.create()` 사용 → `schedule_sortations` 테이블에 저장됨. ✅  
- **기준 추가**: `ScheduleCriteria.create()` 사용 → `schedule_criterias` 테이블에 저장됨. ✅  
- **작업유형 추가**: `ScheduleJobtype.create()` 사용 → `schedule_jobtypes` 테이블에 저장됨. ✅  

세부(⑤)는 `schedule_work_detail_types` 테이블용 API이며, 일정 4축(장소→구분→기준→작업유형)과는 별도 구조입니다.

---

## 5. 마이그레이션 참고

- `schedule_jobtypes`의 `criterias` → `schedule_criterias_id` 변경:  
  `node scripts/schedule_jobtypes_criterias_to_schedule_criterias_id.js`
