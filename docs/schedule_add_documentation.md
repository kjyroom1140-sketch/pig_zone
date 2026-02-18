# 일정 추가 — 정리 문서

> 이 문서는 **일정 추가** 기능에 대한 요구사항, 화면·API·DB 매핑, 정리 사항을 기록합니다.

---

## 1. 개요

- **목적**: 
- **관련 화면**: admin 일정 관리 설정 > 일정 항목 (추가/수정 모달)
- **관련 API**: 
- **관련 테이블**: 

---

## 2. 화면 구성 (일정 추가 모달)

| 항목 | 연결 테이블(옵션 소스) | 저장 위치 | 비고 |
|------|------------------------|-----------|------|
| 대상장소 | `structure_templates` | `schedule_work_plans.structure_templates` (JSON) | 옵션: /api/structureTemplates |
| 구분 | `schedule_sortations` | `schedule_work_plans.schedule_sortations` (JSON) | |
| 기준 | `schedule_criterias` | `schedule_work_plans.schedule_criterias` (JSON) | |
| 기준일로부터 일수 (시작/끝) | — | `schedule_criterias` JSON 내 dayMin, dayMax | 기준 선택에 따라 일수 포함 |
| 작업유형 (대분류) | `schedule_jobtypes` | `schedule_work_plans.schedule_jobtypes` (JSON) | |
| 작업 내용 (세부) | `schedule_jobtypes` JSON 또는 `schedule_work_detail_types` | `schedule_jobtypes` JSON 내 detail | 대분류·세부 한 묶음으로 저장 가능 |
| 반복 (전체 시설일 때) | — | `schedule_work_plans.details` (JSON) | 매일/매주/매월 등, recurrenceType 등 |

**확인 요약**
- 대상장소·구분·기준·작업유형·작업 내용: 정리하신 테이블 매핑과 현재 `schedule_work_plans` 컬럼 구조와 일치합니다.
- 일수·반복: DB에는 별도 컬럼 없이, 각각 `schedule_criterias` JSON, `details` JSON에 넣는 구조입니다.

---

## 3. 데이터 흐름



- 저장 시 사용 API:
- 요청 body 예시:
- DB 저장 테이블/컬럼:

---

## 4. 정리·결정 사항

- (작성 시 추가)

---

## 5. 작업 계획 — 셀렉트바 추가 기능

일정 추가 모달에서 **기준** 셀렉트에 「+ 기준 추가」, **작업유형** 셀렉트에 「+ 작업유형 추가」를 구현하기 위한 작업 계획입니다. (구분 추가와 동일한 패턴 적용.)

---

### 5.1 + 기준 추가

| 구분 | 내용 |
|------|------|
| **화면** | 일정 추가 모달 > 기준 셀렉트(`scheduleItemBasisId`) 하단에 항상 **➕ 기준 추가** 옵션 표시 |
| **동작** | 해당 옵션 선택 시 기준 추가 모달 열기 → 이름 입력 후 저장 → `schedule_criterias` 테이블에 저장, 기준 목록 갱신 후 새 항목 자동 선택 |
| **옵션 소스/저장** | 옵션: `GET /api/schedule-criterias`(기존). 저장: `schedule_criterias` 테이블 |
| **테이블 구조** | `schedule_criterias`: id, sortations(TEXT), criterias(TEXT), createdAt, updatedAt |
| **백엔드** | `POST /api/schedule-criterias` 추가. body: `name`(필수), `criterias`(TEXT/JSON, 선택). name만 있으면 `criterias`에 `[{ name }]` 형태로 저장 |
| **프론트** | ① `fillScheduleItemBasisOptions()`에서 기준 목록 아래에 `<option value="__add__">➕ 기준 추가</option>` 항상 추가 ② `scheduleItemBasisId` change 시 `value === '__add__'`이면 기준 추가 모달 열기(기존 `openScheduleBasisAddModalFromItem` 유무 확인 후 연동 또는 신규) ③ 기준 추가 모달: 이름 입력 필드, 저장 시 `POST /api/schedule-criterias`, 성공 시 `loadScheduleBases()` 호출 후 구분에 맞게 `fillScheduleItemBasisOptions()` 재호출, 새로 생성된 id로 셀렉트 값 설정 |
| **비고** | 현재 기준 추가 모달이 일정 마스터용(`scheduleMasterBasisModal` 등)으로 다른 API(`schedule-bases`)를 쓸 수 있음. 일정 항목용은 `schedule_criterias` 전용 모달/API로 구현할 것 |

---

### 5.2 + 작업유형 추가

| 구분 | 내용 |
|------|------|
| **화면** | 일정 추가 모달 > 작업유형 셀렉트(`scheduleItemWorkTypeId`) 하단에 항상 **➕ 작업유형 추가** 옵션 표시 |
| **동작** | 해당 옵션 선택 시 작업유형 추가 모달 열기 → 이름 입력 후 저장 → `schedule_jobtypes` 테이블에 저장, 작업유형 목록 갱신 후 새 항목 자동 선택 |
| **옵션 소스/저장** | 옵션: `GET /api/schedule-jobtypes`(기존). 저장: `schedule_jobtypes` 테이블 |
| **테이블 구조** | `schedule_jobtypes`: id, criterias(TEXT), jobtypes(TEXT), createdAt, updatedAt |
| **백엔드** | `POST /api/schedule-jobtypes` 추가. body: `name`(필수), `jobtypes`(TEXT/JSON, 선택). name만 있으면 `jobtypes`에 `[{ name }]` 형태로 저장 |
| **프론트** | ① `fillScheduleItemWorkTypeOptions()`에서 작업유형 목록 아래에 `<option value="__add__">➕ 작업유형 추가</option>` 항상 추가 ② `scheduleItemWorkTypeId` change 시 `value === '__add__'`이면 작업유형 추가 모달 열기 ③ 작업유형 추가 모달: 이름 입력 필드, 저장 시 `POST /api/schedule-jobtypes`, 성공 시 `loadScheduleWorkTypes()` 호출 후 `fillScheduleItemWorkTypeOptions()` 재호출, 새로 생성된 id로 셀렉트 값 설정 |
| **비고** | 작업 내용(세부)은 `schedule_jobtypes`의 jobtypes JSON 내부 구조로 관리. 1단계에서는 대분류(작업유형) 추가만 구현해도 됨 |

---

### 5.3 구현 순서 제안

1. **기준 추가**: POST /api/schedule-criterias 구현 → 기준 추가 모달(일정 항목용) 추가/연동 → `fillScheduleItemBasisOptions`에 ➕ 기준 추가 옵션 및 change 처리.
2. **작업유형 추가**: POST /api/schedule-jobtypes 구현 → 작업유형 추가 모달 추가 → `fillScheduleItemWorkTypeOptions`에 ➕ 작업유형 추가 옵션 및 change 처리.

---

## 6. 참고

- 기존 설계: `schedule_structure_design.md`, `schedule_item_form_to_db_mapping.md` 등
- 구분 추가: `schedule_sortations` + `POST /api/schedule-sortations` + 구분 추가 모달(`scheduleSortationAddModal`) 참고
