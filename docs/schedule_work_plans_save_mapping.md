## 에러 발생 시 (schedule_work_plans_sortation_id_fkey 위반)

**증상**: 기초 일정 저장 시 500 에러, `schedule_work_plans_sortation_id_fkey` 참조키 위반.

**원인**: DB의 FK가 아직 **목록 테이블**(schedule_sortations 등)을 가리키는데, 앱은 **정의 id**를 저장하도록 바뀐 상태.

**해결**: 프로젝트 루트에서 마이그레이션 실행 후 서버 재시작 없이 다시 저장 시도.

```bash
node scripts/run_schedule_work_plans_store_definition_ids.js
```

실행 후 기존 `schedule_work_plans` 행의 id가 정의 id로 변환되고, FK가 정의 테이블을 참조하도록 바뀝니다.

---

각각의 테이블
- **구분**: `schedule_sortations`
- **작업유형**: `schedule_jobtypes`
- **기준**: `schedule_criterias`

---

## 기초 일정 저장 시 저장하는 ID (정의 테이블 id)

**기초 일정 저장** 시 `schedule_work_plans` 테이블에 넣는 값은 **정의(definitions) 테이블의 id**를 사용합니다.

| schedule_work_plans 컬럼 | 저장하는 값 | 출처 테이블 |
|--------------------------|-------------|-------------|
| **sortation_id** | 구분 **정의** id | **schedule_sortation_definitions**.id |
| **jobtype_id** | 작업유형 **정의** id | **schedule_jobtype_definitions**.id |
| **criteria_id** | 기준 **정의** id | **schedule_criteria_definitions**.id |

- 목록 테이블(schedule_sortations, schedule_jobtypes, schedule_criterias)의 행 id가 **아니라**
- 각각 **구분 정의** / **작업유형 정의** / **기준 정의** 테이블의 **id** 로 저장합니다.

DB 마이그레이션: `node scripts/run_schedule_work_plans_store_definition_ids.js` 실행 시 기존 목록 id 가 정의 id 로 변환되고, FK 가 정의 테이블을 참조하도록 변경됩니다.

---

## 구분 목록 선택 시 데이터를 읽어오는 테이블

**구분 목록 선택** 모달을 열 때 다음 두 테이블에서 데이터를 읽어옵니다.

| 용도 | 테이블 | 설명 |
|------|--------|------|
| 모달에 뜨는 목록(체크 후보) | **schedule_sortation_definitions** | 구분 정의 마스터. 여기서 id, name, sort_order를 조회해 체크 목록으로 표시 |
| 현재 시설에 적용된 구분(체크 상태) | **schedule_sortations** | 선택한 시설(structure_template_id)의 구분 행들. sortations JSON에 sortation_definition_id가 있으면 해당 정의를 체크된 상태로 표시 |

확인 버튼으로 저장할 때는 체크된 정의 id 목록을 **schedule_sortations**에 반영(해당 시설의 구분 행 추가/삭제·동기화)합니다.

---

## 3개 테이블 컬럼 정리

### schedule_sortations (구분)

| 컬럼명 | 타입 | NULL | 설명 |
|--------|------|------|------|
| id | SERIAL / INTEGER | N (PK) | 기본키 |
| structure_template_id | INTEGER | Y | 시설 FK → structure_templates.id |
| sortations | JSONB | Y | 구분 데이터 JSON (예: [{ "sortation_definition_id": 1 }] 또는 [{ "name": "구분명" }]) |
| sort_order | INTEGER | N | 표시 순서 (기본 0) |
| "createdAt" | TIMESTAMPTZ | N | 생성 일시 |
| "updatedAt" | TIMESTAMPTZ | N | 수정 일시 |

### schedule_jobtypes (작업유형)

| 컬럼명 | 타입 | NULL | 설명 |
|--------|------|------|------|
| id | SERIAL / INTEGER | N (PK) | 기본키 |
| sortation_id | INTEGER | Y | 구분 FK → schedule_sortations.id |
| jobtypes | JSONB | Y | 작업유형 데이터 JSON (예: [{ "jobtype_definition_id": 1 }] 또는 [{ "name": "작업명" }]) |
| sort_order | INTEGER | N | 표시 순서 (기본 0) |
| "createdAt" | TIMESTAMPTZ | N | 생성 일시 |
| "updatedAt" | TIMESTAMPTZ | N | 수정 일시 |

### schedule_criterias (기준)

| 컬럼명 | 타입 | NULL | 설명 |
|--------|------|------|------|
| id | SERIAL / INTEGER | N (PK) | 기본키 |
| jobtype_id | INTEGER | Y | 작업유형 FK → schedule_jobtypes.id |
| criterias | JSONB | Y | 기준 데이터 JSON (예: [{ "criteria_definition_id": 1 }] 또는 [{ "name": "기준명" }]) |
| sort_order | INTEGER | N | 표시 순서 (기본 0) |
| "createdAt" | TIMESTAMPTZ | N | 생성 일시 |
| "updatedAt" | TIMESTAMPTZ | N | 수정 일시 |

---



