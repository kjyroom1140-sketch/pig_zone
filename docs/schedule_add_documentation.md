# 일정 추가 — 정리 문서

> 이 문서는 **일정 추가** 기능에 대한 요구사항, 화면·API·DB 매핑, 정리 사항을 기록합니다.  
> **기초 일정 관리** 페이지(`/admin/schedule-work-plans`)의 구분/기준/작업유형 추가 구현 상태가 반영되어 있습니다.

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
| **화면** | **기초 일정 관리** 페이지(`/admin/schedule-work-plans`) > 기준 패널 하단 **+ 기준 추가** 버튼. (일정 추가 모달의 기준 셀렉트에 ➕ 기준 추가 옵션은 별도 구현 시 동일 API 사용) |
| **동작** | 구분 선택 후 **+ 기준 추가** 클릭 → 기준 추가 모달 열기 → 이름 입력 후 저장 → `schedule_criterias` 테이블에 저장, 기준 목록 갱신 후 모달 닫기 |
| **옵션 소스/저장** | 옵션: `GET /api/schedule-criterias`. 저장: `schedule_criterias` 테이블 |
| **테이블 구조** | `schedule_criterias`: id, **schedule_sortations_id**(INTEGER, 구분 FK), **criterias**(TEXT/JSON), "createdAt", "updatedAt". *(sortations, description 컬럼 제거됨)* |
| **백엔드** | ✅ `POST /api/schedule-criterias` 구현됨. body: `name`(필수), `schedule_sortations_id`(필수, 선택한 구분 id), `criterias`(선택). name만 있으면 `criterias`에 `[{"name":"기준이름"}]` 형태로 저장 |
| **프론트** | ✅ 기초 일정 관리: 구분 라디오 선택 → + 기준 추가 → 모달에서 이름 입력 → `createScheduleCriteria({ name, schedule_sortations_id, criterias: [{ name }] })` 호출, 성공 시 `loadChains()` 및 목록 갱신 |
| **비고** | 일정 항목용 모달에서 기준 셀렉트 + 「➕ 기준 추가」 옵션은 위 API를 그대로 사용하면 됨 |

---

### 5.2 + 작업유형 추가

| 구분 | 내용 |
|------|------|
| **화면** | **기초 일정 관리** 페이지 > 작업유형 패널 하단 **+ 작업유형 추가** 버튼. (일정 추가 모달의 작업유형 셀렉트에 ➕ 작업유형 추가 옵션은 별도 구현 시 동일 API 사용) |
| **동작** | 구분·기준 선택 후 **+ 작업유형 추가** 클릭 → 작업유형 추가 모달 열기 → 이름 입력 후 저장 → `schedule_jobtypes` 테이블에 저장, 목록 갱신 |
| **옵션 소스/저장** | 옵션: `GET /api/schedule-jobtypes`. 저장: `schedule_jobtypes` 테이블 |
| **테이블 구조** | `schedule_jobtypes`: id, schedule_criterias_id(INTEGER), jobtypes(TEXT), "createdAt", "updatedAt" |
| **백엔드** | ✅ `POST /api/schedule-jobtypes` 구현됨. body: `name`(필수), `schedule_criterias_id`(필수), `jobtypes`(선택). name만 있으면 `jobtypes`에 `[{"name":"작업유형이름"}]` 형태로 저장 |
| **프론트** | ⏳ 기초 일정 관리: 작업유형 추가 모달/API 연동은 TODO. 구현 시 기준 추가와 동일 패턴(선택한 기준 id로 `createScheduleJobtype` 호출) |
| **비고** | 작업 내용(세부)은 `schedule_jobtypes`의 jobtypes JSON 내부 구조로 관리. 1단계에서는 대분류(작업유형) 추가만 구현해도 됨 |

---

### 5.3 구현 순서 제안 / 현재 상태

1. **기준 추가**: ✅ 완료. POST /api/schedule-criterias, 기초 일정 관리 페이지 기준 추가 모달 구현. 일정 항목용 모달에 ➕ 기준 추가 옵션 연동 시 동일 API 사용.
2. **작업유형 추가**: 백엔드 POST /api/schedule-jobtypes ✅ 있음. 기초 일정 관리 페이지에 작업유형 추가 모달·연동 ⏳ TODO. 일정 항목용은 `fillScheduleItemWorkTypeOptions`에 ➕ 작업유형 추가 옵션 및 change 처리.

---

## 6. 참고

- 기존 설계: `schedule_structure_design.md`, `schedule_implementation_summary.md` 등
- **구분 추가**: ✅ `schedule_sortations` + `POST /api/schedule-sortations` + 기초 일정 관리 페이지 구분 추가 모달 구현됨
- **테이블 참고**: `docs/table_structures_reference.md` — schedule_criterias는 schedule_sortations_id, criterias만 사용(sortations/description 제거)
