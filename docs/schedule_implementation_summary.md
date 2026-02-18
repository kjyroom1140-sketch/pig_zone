# 일정 구조 재설계 — 구현 정리

`schedule_structure_design.md` 기준으로 적용한 전역 일정 구조와 구현 내용을 한 문서로 정리한 요약입니다.

---

## 1. 설계 개요

### 1.1 네 가지 축

| 축 | 테이블/연동 | 설명 |
|----|-------------|------|
| **구분** | schedule_divisions | 모돈, 옹돈, 자돈, 비번식돈, 시설 |
| **대상장소** | structure_templates (기존) | 교배사, 임신사, 분만사 등 — 별도 테이블 없이 기존 테이블 사용 |
| **기준** | schedule_bases | 전입일, 입식일, 교배일, 분만일, 이유일 등 |
| **작업유형** | schedule_work_types + schedule_work_detail_types | 대분류(이동·사양·번식 등) + 세부(분만사 이동, 교배 실시 등). UI에서는 대분류 코드 미표시. |

### 1.2 작업 추가 선택 순서

```
① 장소 → ② 구분 → ③ 기준 유형 → ④ 작업유형(대분류 → 세부) → ⑤ 일수·설명
```

- ② 구분: 선택한 장소에 매핑된 구분만 노출 (schedule_division_structures)
- ④ 작업유형: 구분에 따라 appliesToScope(pig / facility / both)로 노출 범위 제한

---

## 2. 전역 테이블 정리

### 2.1 새로 만든 테이블

| 테이블 | 모델 | 설명 |
|--------|------|------|
| **schedule_divisions** | ScheduleDivision | 구분 마스터 (code, name, sortOrder). sow, boar, piglet, non_breeding, facility |
| **schedule_bases** | ScheduleBase | 기준 마스터 (name, divisionId nullable, sortOrder). 전입일, 교배일 등. *code 컬럼 제거됨* |
| **schedule_work_types** | ScheduleWorkType | 작업유형 대분류 (name, appliesToScope, sortOrder). UI에서는 이름만 표시, code는 시드/DB용 선택. |
| **schedule_work_detail_types** | ScheduleWorkDetailType | 세부 작업유형 (workTypeId FK, code, name, sortOrder) |
| **schedule_division_structures** | ScheduleDivisionStructure | 구분 ↔ 대상장소 매핑 (divisionId, structureTemplateId). UNIQUE(divisionId, structureTemplateId) |

### 2.2 변경된 테이블

| 테이블 | 변경 내용 |
|--------|-----------|
| **schedule_items** | 구 구조(taskTypeId, basisTypeId 등) 제거 → **divisionId**, **structureTemplateId**, **basisId**, **workDetailTypeId**, dayMin, dayMax, description, sortOrder, isActive, **appliesToAllStructures**, **recurrenceType**, recurrenceInterval, **recurrenceWeekdays**, **recurrenceMonthDay**, recurrenceStartDate, recurrenceEndDate |

### 2.3 기존 테이블 (그대로 사용)

- **structure_templates** — 대상장소. 일정 쪽에서는 structureTemplateId(FK)로만 참조.

### 2.4 제거/미사용

- **schedule_item_types** — 작업/기준을 kind로 구분하던 테이블. 재설계로 **schedule_work_types + schedule_work_detail_types**, **schedule_bases** 로 대체.
- **schedule_task_type_structures** — 작업유형–장소 스코프. 재설계에서는 **schedule_division_structures**(구분–장소)만 사용.

---

## 3. 농장 쪽 테이블과의 관계

| 전역 | 농장 | 비고 |
|------|------|------|
| schedule_work_detail_types.id | farm_schedule_task_types.originalId | 농장 구조 저장 시 전역 세부유형 → 농장 작업유형 복사 |
| schedule_bases.id | farm_schedule_basis_types.originalId | 전역 기준 → 농장 기준 유형 복사 |
| schedule_items | farm_schedule_items | 전역 일정 항목을 농장 저장 시 workDetailTypeId→taskTypeId, basisId→basisTypeId, division→targetType 으로 매핑해 복사 |

---

## 4. 구현 현황

### 4.1 모델 (models/)

| 파일 | 테이블 | 비고 |
|------|--------|------|
| ScheduleDivision.js | schedule_divisions | |
| ScheduleBase.js | schedule_bases | divisionId FK nullable |
| ScheduleWorkType.js | schedule_work_types | appliesToScope: pig \| facility \| both |
| ScheduleWorkDetailType.js | schedule_work_detail_types | workTypeId → schedule_work_types |
| ScheduleDivisionStructure.js | schedule_division_structures | divisionId, structureTemplateId, UNIQUE |
| ScheduleItem.js | schedule_items | 새 컬럼 구조로 전면 교체 (divisionId, basisId, workDetailTypeId, recurrence 등) |

- **models/index.js**: 위 모델 등록, 연관 설정. ScheduleItemType, ScheduleTaskTypeStructure 제거.

### 4.2 API 라우트 (routes/) — server.js 등록 경로

| 경로 | 라우트 파일 | 용도 |
|------|--------------|------|
| GET/POST/PUT/DELETE /api/schedule-divisions | scheduleDivisions.js | 구분 CRUD |
| GET/POST/PUT/DELETE /api/schedule-bases | scheduleBases.js | 기준 CRUD (divisionId 쿼리 지원) |
| GET/POST/PUT/DELETE /api/schedule-work-types | scheduleWorkTypes.js | 대분류 CRUD (appliesToScope 쿼리 지원) |
| GET/POST/PUT/DELETE /api/schedule-work-detail-types | scheduleWorkDetailTypes.js | 세부 CRUD (workTypeId, appliesToScope 쿼리) |
| GET/POST/PUT/DELETE /api/schedule-division-structures | scheduleDivisionStructures.js | 구분–장소 매핑 CRUD |
| GET/POST/PUT/DELETE /api/scheduleItems | scheduleItems.js | 전역 일정 항목 CRUD (새 구조) |

- **기존** `/api/scheduleTaskTypes`, `/api/scheduleBasisTypes` 는 **제거됨**. admin 쪽은 새 API로 전환 필요.

### 4.3 농장 구조 저장 (farmStructure.js)

- **전역 → 농장 복사**
  - 작업 유형: **ScheduleWorkDetailType** 전부 → farm_schedule_task_types (originalId = 세부유형 id, category = 대분류명)
  - 기준: **ScheduleBase** 전부 → farm_schedule_basis_types (originalId = schedule_bases.id)
  - 일정 항목: **ScheduleItem** (structureTemplateId ∈ 선택 템플릿) → farm_schedule_items (workDetailTypeId→taskTypeId, basisId→basisTypeId, division.code→targetType)
- **farm_schedule_task_type_structures**: 전역에 해당 스코프 테이블 없음 → 저장 시 비움. 필요 시 추후 별도 설정.

---

## 5. 시드 데이터 (scripts/seed_schedule_masters.js)

실행 시 `sequelize.sync({ alter: false })` 로 누락된 테이블만 생성한 뒤 아래 데이터를 INSERT(또는 findOrCreate)합니다.

### 5.1 schedule_divisions (5건)

| code | name |
|------|------|
| sow | 모돈 |
| boar | 옹돈 |
| piglet | 자돈 |
| non_breeding | 비번식돈 |
| facility | 시설 |

### 5.2 schedule_bases (8건)

| name |
|------|
| 전입일 |
| 입식일 |
| 교배일 |
| 유산일 |
| 임신확정 |
| 발정일 |
| 분만일 |
| 이유일 |

(모두 divisionId = null — 전 구분 공통. *code 컬럼은 제거됨, 시드는 name 기준 findOrCreate*)

### 5.3 schedule_work_types (10건)

| code | name | appliesToScope |
|------|------|----------------|
| W01 | 이동 | pig |
| W02 | 사양 | pig |
| W03 | 번식 | pig |
| W04 | 질병 | pig |
| W05 | 환경 | facility |
| W06 | 위생 | facility |
| W07 | 점검 | both |
| W08 | 기록 | both |
| W09 | 도태 | both |
| W10 | 시설 | facility |

### 5.4 schedule_work_detail_types (대분류별 세부 예시)

- W01: 교배사 이동, 임신사 이동, 분만사 이동, 격리사 이동, 출하 이동, 후보돈 편입
- W02: 임신사료 전환, 포유사료 급여, 제한급이, 자유급이, 급수 점검, 체중 측정
- W03: 교배 실시, 발정 확인, 임신확인, 재교배, 분만 준비, 분만 관리, 이유
- W04: 예방접종, 항생제 투여, 구충, 개체 치료, 격리 조치, 건강검사
- W05: 온도 조정, 환기 점검, 습도 관리, 조명 조절, 환풍기 점검, 히터 점검
- W06: 돈방 세척, 고압세척, 소독, 분만사 준비 소독, 격리사 소독
- W07: 임신확정 체크, 체형 점검, 발정 확인, 분만 예정 체크, 산차 기록 확인
- W08: 교배일 등록, 분만일 등록, 폐사 등록, 유산 등록, 치료 기록 입력
- W09: 계획 도태, 질병 도태, 산차 초과 도태, 출하
- W10: 환기팬 수리, 급이기 점검, 음수기 점검, CCTV 점검, 조명 교체

### 5.5 schedule_division_structures

- **structure_templates**에 production 시설이 있을 때만 매핑 생성.
- 예: 모돈↔교배사·임신돈사·분만사(모돈)·후보돈사, 옹돈↔웅돈사, 자돈↔분만사(모돈), 비번식돈↔자돈사·육성돈사·비육돈사 등, 시설↔전체 시설.

**실행 방법**

```bash
node scripts/seed_schedule_masters.js
```

---

## 6. 농장 일정 (farm_admin)

- **데이터 흐름**: 전역(schedule_divisions, schedule_bases, schedule_work_types, schedule_work_detail_types, schedule_items)은 **admin**에서 관리. **농장 구조** 메뉴에서 대상 장소를 선택 후 저장하면 `farmStructure.js`가 전역 기준·작업유형·일정 항목을 **farm_schedule_basis_types**, **farm_schedule_task_types**, **farm_schedule_items**로 복사한다.
- **farm_admin 일정 화면**: `/api/farms/:farmId/schedule-task-types`, `/api/farms/:farmId/schedule-basis-types`, `/api/farms/:farmId/schedule-items` 만 사용. 테이블 구조(targetType, basisTypeId, taskTypeId)는 그대로이므로 **별도 구조 변경 없음**. 일정/작업유형이 없을 때 "농장 구조 저장" 안내 문구를 노출하도록 `farm_schedule.js`에 반영됨.

---

## 7. 미구현·추가 작업

| 항목 | 설명 |
|------|------|
| **admin 일정 UI** | ✅ 완료. 문서 흐름(장소→구분→기준→작업유형 대분류→세부→일수·설명), 새 API, 기준/세부 추가 모달 반영. |
| **farm_admin 일정** | ✅ 전역 복사는 농장 구조 저장으로 자동 반영. Farm UI는 기존 farm_schedule_* API 유지, 안내 문구 추가 완료. |

---

## 8. 최근 반영 사항

- **schedule_bases**: `code` 컬럼 제거. 기준 추가 모달은 이름만 입력. DB 컬럼 제거 시 `scripts/drop_schedule_bases_code.js` 실행.
- **작업유형 대분류**: UI에서 코드(W01, W02 등) 미표시, 이름만 표시. "이동" 필터 등은 대분류 이름 기준으로 동작.
- **대상장소**: "전체 시설 반복" 체크박스 제거 → 대상장소 셀렉트에 "전체 시설" 옵션 추가. 전체 시설 선택 시 구분은 시설만 노출.
- **기준**: 기준 셀렉트에 "➕ 기준 추가" 옵션으로 추가 모달 연동.

---

## 9. 참고 문서·파일

- 설계 상세: `docs/schedule_structure_design.md`
- 전역 일정 모델: `models/ScheduleDivision.js`, `ScheduleBase.js`, `ScheduleWorkType.js`, `ScheduleWorkDetailType.js`, `ScheduleDivisionStructure.js`, `ScheduleItem.js`
- 전역 일정 라우트: `routes/scheduleDivisions.js`, `scheduleBases.js`, `scheduleWorkTypes.js`, `scheduleWorkDetailTypes.js`, `scheduleDivisionStructures.js`, `scheduleItems.js`
- 시드: `scripts/seed_schedule_masters.js`
- 농장 구조 저장: `routes/farmStructure.js`
