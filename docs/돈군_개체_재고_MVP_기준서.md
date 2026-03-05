# 돈군·개체·재고 MVP 기준서 (v3)

이 문서는 일정관리 페이지를 중심으로 돈군/재고/이동을 운영하기 위한 최소 기준입니다.  
핵심은 **일정(계획)과 실행(완료)을 분리**하고, 돈군·재고는 실행 시점에 확정 반영하는 것입니다.

---

## 1) 운영 컨셉 (핵심 원칙)

1. 일정은 예정 데이터, 돈군/재고는 실행 데이터다.
2. 분만 완료 시 돈군을 자동 생성한다.
3. 이동 완료 시 위치/두수/재고를 트랜잭션으로 동시에 반영한다.
4. 수정은 최소화하고 이력(원장)은 누적 보존한다.
5. `pig_groups`에는 현재 상태만 저장하고, 이동 이력은 별도 테이블로 분리한다.
6. 운영 시작 전 초기값은 **농장 구조 설정**에서 칸 단위로 입력/확정한다.

### 1-1. 돈군 ID/위치 관리 정책 (확정)

- 돈군 ID는 분만/분할/합군 시 "운영 단위" 기준으로 생성/정리한다.
- `pig_groups`는 현재값만 보관한다.
  - 현재 두수(`head_count`)
  - 현재 위치(`current_section_id`)
  - 현재 상태(`status`)
- 이동 경로/변경 내역은 `pig_movement_events`, `pig_movement_lines`에만 저장한다.
- 이동 실행/일정 표시의 위치 단위는 **항상 칸(section)** 으로 고정한다.
- 방(room) 레벨 표시는 실행건이 아니라 구조/요약 정보로만 취급한다.
- 비권장: 돈군 테이블 단일 행에 이동 경로(JSON/문자열) 누적 저장.

### 1-2. 운영 초기값 입력 정책 (확정)

- 초기값 입력 위치는 `/farm/admin`의 **농장 구조 설정** 내 "초기입력" 단계로 고정한다.
- 입력 단위는 최소 `칸(section)`이며, 저장 단위는 **섹션 단위 모달 저장(즉시 반영)**으로 운영한다.
- 시설 타입별 입력 규칙:
  - 교배사/임신사/분만사: **모돈 정보 입력 필수**
  - 분만사: 모돈 정보 + 자돈(돈군) 초기값 동시 입력 허용
  - 기타 시설: 돈군/두수 입력
- 돈군 입력(분만사/기타 시설) 시 날짜 입력 규칙:
  - `전입일(entryDate)` 필수
  - `출생일(birthDate)` 직접 입력 또는 `일령(ageDays)` 직접 입력 중 1개 필수
  - `일령` 입력 시 `출생일 = 전입일 - 일령`으로 계산 저장
  - `전입일`을 선택/변경하면, 전입일 시점의 일령 기준으로 `출생일`을 자동 역산한다.
  - `출생일`이 확정되면 `일령`은 오늘 기준(`today - birthDate`)으로 자동 재계산해 표시한다.
- 초기입력의 돈군번호(`group_no`)는 사용자 수동 입력이 아니라 **모달 저장 시 서버 자동생성**을 기본 정책으로 한다.
- 모달 저장 시 해당 섹션 데이터는 단일 트랜잭션으로 즉시 반영한다.
  - `sows`(모돈) 등록/배치
  - `pig_groups` 생성
  - `section_inventory_ledger` `ref_type='opening'` IN 기록
  - `section_inventory_balance` upsert
- 중요: 최종 확정 버튼은 두지 않고, 모달의 저장 버튼이 검증+반영 트리거를 수행한다.
- 운영 시작 상태는 `farms.farm_initialized_at` 기준으로 판별하며, 현재 구현은 첫 섹션 저장 성공 시 서버가 자동 설정한다.
- 초기입력 API(정책 변경):
  - `POST /api/farms/:farmId/bootstrap/opening/sections/:sectionId/save` (모달 저장: 검증+반영)
  - `GET /api/farms/:farmId/bootstrap/opening/status`
- 섹션 저장 API 요청 권장 스키마:
  - `kind`: `breedingGestation | farrowing | other`
  - `entryDate`: `YYYY-MM-DD`
  - `sows[]`: `{ sowNo, birthDate?, ... }`
  - `group`: `{ headCount, birthDate? | ageDays?, ... }` (분만사/기타 시설)

### 1-3. 교배사/임신사 수용 방식 정책 (스톨/군사)

- 설정 대상: **교배사/임신사의 방(room) 단위**
- 권장 저장 컬럼: `farm_rooms.housing_mode`
  - 값: `stall`(스톨), `group`(군사)
  - 비대상 시설(자돈사/비육사 등)은 `NULL` 허용 또는 `group` 고정
- 기본값 권장: `group`
- UI/서버 가드:
  - 교배사/임신사만 `운영방식` 선택 UI 노출
  - 그 외 사육시설은 `칸 갯수 변경`만 허용(운영방식은 `group` 고정)
  - API(`PUT /api/farm-facilities/:farmId/rooms/:roomId`)도 동일하게 `stall` 저장을 차단해야 함

#### 방식별 운영 규칙

- `stall`(스톨):
  - 개체(모돈) 중심 운영
  - 초기입력 시 모돈 개체 식별(`sow_no`) 기반 배치를 우선
  - 동일 방 내 칸 재고는 "모돈 개체 합계"와 일치해야 함
- `group`(군사):
  - 돈군/두수 중심 운영
  - 초기입력은 돈군(`pig_groups`) + 두수 중심으로 입력
  - 모돈 정보는 필요 시 보조 입력(정책상 필수 여부는 시설 규칙에 따름)
- 개수 라벨/입력 규칙:
  - `group`(군사) 선택 시: **칸 개수**를 입력/표시
  - `stall`(스톨) 선택 시: **스톨 개수**를 입력/표시

#### 전환(변경) 가드 규칙

- 운영 시작 전(`farm_initialized_at IS NULL`): 자유 변경 허용
- 운영 시작 후:
  - 기본 정책은 변경 제한
  - 변경이 꼭 필요하면, 대상 방 관련 활성 재고/모돈 배치가 0인지 검증 후 허용
  - 변경 이력(변경자/시각/사유) 감사 로그 기록 권장

---

## 2) 일정관리 페이지 기반 업무 시나리오

### 2-1. 분만 등록

- 작업자가 일정관리 페이지에서 칸을 선택
- 분만 예정 일정이 있으면 해당 일정을 클릭 후 완료 처리
- 분만 예정이 없으면 작업자가 즉시 일정 추가 후 완료 처리
- 완료 시 자동 처리:
  - 돈군 생성
  - 해당 칸 두수 증가(재고 IN)
  - 일정마스터(일령 기준) 기반 후속 일정 자동 생성

### 2-2. 이동 등록

- 날짜 도래 시 이동 예정 일정이 표시됨
- 작업자가 이동 완료 처리 시:
  - 출발 칸 재고 OUT
  - 도착 칸 재고 IN
  - 돈군 현재 위치 갱신
  - 이동 이력 저장

---

## 3) 가장 중요한 쟁점: 분할/합군/부분 이동

질문 주신 케이스를 반영하면 단일 이동행(`pig_movements` 1행)만으로는 한계가 있습니다.  
따라서 **이동 이벤트 + 이동 라인** 2계층 모델을 권장합니다.

### 지원해야 하는 케이스

1. 전량 이동: A칸 돈군 100두 전량을 B칸으로 이동
2. 부분 이동(잔류): A칸 100두 중 60두만 이동, 40두는 잔류
3. 분할 이동(1 -> N): A칸 100두를 B칸 60두 + C칸 40두
4. 합군 이동(N -> 1): A돈군 30두 + B돈군 20두를 C칸에서 하나의 돈군으로 운영

### MVP 정책 권장

- `N -> M` 복합 이동은 1회 처리하지 않고 이벤트를 분리
  - 예: 1->N 후 필요 시 N->1 별도 이벤트
- 이동 완료는 반드시 두수 검증 통과 시에만 반영
- 잔류 두수는 원 돈군(source)에 남긴다.
- 이동/합군 결과는 target 돈군에 반영한다.
- 부분 합군은 운영 혼선 방지를 위해 **신규 target 돈군 생성**을 기본 정책으로 한다.

---

## 4) 도메인 경계

### 돈군 관리
- 돈군 생성/수정/상태관리
- 현재 위치(건물/사/방/칸) 추적
- 분할/합군 이력 추적

### 개체 관리
- 모돈은 개체 추적이 필요하므로 별도 테이블(`sows`)로 관리한다.
- 일반 비육/자돈은 MVP에서 돈군(`pig_groups`) 중심으로 운영한다.
- RFID/개체번호 확장은 `sows` 기반으로 2차 확장한다.

### 모돈 관리 (별도 테이블 권장)
- 테이블: `sows`
  - 예시 컬럼: `id`, `farm_id`, `sow_no`, `status`, `current_section_id`, `parity`, `birth_date`, `memo`, `created_at`
- 분만 완료 시 `farrowing_events.origin_sow_id`는 `sows.id`를 참조한다.
- 분만 등록 사전 검증:
  - 대상 칸에 유효한 모돈 배치가 없으면 분만 완료를 차단한다.

### 재고 관리
- 여기서 재고는 "칸별 두수 재고"를 우선
- 사료/약품/백신 재고는 동일 패턴으로 2차 확장

---

## 5) 테이블 초안 (PostgreSQL)

## 5-1. pig_groups
- `id` UUID PK
- `farm_id` UUID NOT NULL
- `group_no` VARCHAR(40) NOT NULL
- `root_group_id` UUID NULL  -- 계보 추적용 루트 돈군 ID
- `current_section_id` UUID NULL
- `head_count` INTEGER NOT NULL DEFAULT 0
- `status` VARCHAR(20) NOT NULL DEFAULT 'active'  -- active/closed/merged
- `created_reason` VARCHAR(20) NOT NULL DEFAULT 'manual' -- birth/split/manual/merge
- `parent_group_id` UUID NULL  -- 분할로 생성된 경우 원 그룹
- `birth_date` DATE NULL -- 돈군 출생일(직접 입력 또는 일령 계산값)
- `memo` TEXT NULL
- `created_at` TIMESTAMP NOT NULL DEFAULT now()
- `updated_at` TIMESTAMP NOT NULL DEFAULT now()
- `is_deleted` BOOLEAN NOT NULL DEFAULT false

## 5-2. pig_movement_events (이동 헤더)
- `id` UUID PK
- `farm_id` UUID NOT NULL
- `event_type` VARCHAR(20) NOT NULL -- full/partial/split/merge/entry/shipment
- `scheduled_work_plan_id` INTEGER NULL -- 일정 연계
- `moved_at` TIMESTAMP NOT NULL DEFAULT now()
- `moved_by` UUID NULL
- `memo` TEXT NULL
- `created_at` TIMESTAMP NOT NULL DEFAULT now()

## 5-3. pig_movement_lines (이동 상세 라인)
- `id` UUID PK
- `farm_id` UUID NOT NULL
- `event_id` UUID NOT NULL FK -> pig_movement_events.id
- `source_group_id` UUID NULL
- `target_group_id` UUID NULL
- `from_section_id` UUID NULL
- `to_section_id` UUID NULL
- `head_count` INTEGER NOT NULL
- `line_type` VARCHAR(20) NOT NULL -- move/split_out/split_in/merge_in/merge_out
- `created_at` TIMESTAMP NOT NULL DEFAULT now()

## 5-4. section_inventory_ledger (칸별 두수 원장)
- `id` UUID PK
- `farm_id` UUID NOT NULL
- `section_id` UUID NOT NULL
- `pig_group_id` UUID NULL
- `direction` VARCHAR(3) NOT NULL -- IN/OUT/ADJ
- `head_count` INTEGER NOT NULL
- `event_id` UUID NULL
- `ref_type` VARCHAR(20) NOT NULL -- birth/movement/adjust
- `ref_id` UUID NULL
- `occurred_at` TIMESTAMP NOT NULL DEFAULT now()
- `created_at` TIMESTAMP NOT NULL DEFAULT now()

## 5-5. section_inventory_balance (옵션, 성능용)
- `farm_id` UUID NOT NULL
- `section_id` UUID NOT NULL
- `head_count` INTEGER NOT NULL DEFAULT 0
- `updated_at` TIMESTAMP NOT NULL DEFAULT now()
- PK: (`farm_id`, `section_id`)

---

## 6) API 초안 (farm scope)

기본 prefix: `/api/farms/:farmId`

### 돈군
- `GET /pig-groups`
- `POST /pig-groups`
- `PUT /pig-groups/:groupId`
- `DELETE /pig-groups/:groupId` (soft)

### 이동 이벤트
- `GET /pig-movement-events`
- `POST /pig-movement-events`
  - payload에 `lines[]` 포함
  - 한 이벤트에서 분할/합군/부분 이동 표현 가능
- `GET /pig-movement-events/:eventId`

### 재고(칸 두수)
- `GET /section-inventory/balances`
- `GET /section-inventory/ledger`
- `POST /section-inventory/adjust` (관리자 정정용)

### 일정 실행 연계
- `POST /schedule-executions` (캘린더에서 예정 등록)
- `POST /schedule-executions/:executionId/complete-birth`
- `POST /schedule-executions/:executionId/complete-move`

---

## 7) 화면 초안

### `/farm/schedule` (핵심)
- 일정 클릭 시 실행 모달
- 분만 실행 모달:
  - 분만 마리수, 돈군번호 자동생성, 메모
- 이동 실행 모달:
  - 출발 돈군/칸
  - 도착 라인 다중 입력(칸, 두수)
  - 합군 대상 선택(선택)

### 7-1. 캘린더 직접 등록 UX (예정/완료 즉시 처리)

#### A) 예정 등록 (캘린더 셀에서 바로)
1. 작업자가 캘린더에서 날짜 + 칸 선택
2. "예정 등록" 버튼 클릭
3. 모달에서 작업유형(분만/이동/점검), 계획(`work_plan_id`), 메모 입력
4. `POST /schedule-executions` 호출
5. `schedule_executions`에 `status='pending'`으로 저장
6. 저장 직후 해당 셀에 예정건 표시
   - 표시키: `section_id + scheduled_date`
   - 방(room) 행은 실행건 표시 대상이 아님(요약/안내만 허용)

#### B) 완료 등록 (캘린더 셀에서 바로)
1. 작업자가 캘린더 셀의 예정건 선택(또는 "바로 완료" 선택)
2. 작업유형별 완료 모달 입력
   - 분만: `bornCount`, `sectionId`, `memo`
   - 이동: `lines[]`, `memo`
3. 완료 API 호출
   - `POST /schedule-executions/:executionId/complete-birth`
   - `POST /schedule-executions/:executionId/complete-move`
4. 트랜잭션 성공 시 `status='completed'` 전이 + 도메인 반영
5. 셀 UI를 완료 상태로 즉시 갱신

#### C) 예정 없이 바로 완료(현장 입력) 정책
- 분만/이동 예정이 없어도 작업자는 캘린더 셀에서 "바로 완료" 가능
- 처리 원칙:
  1. 내부적으로 실행건(`pending`) 생성
  2. 동일 트랜잭션에서 완료 API 처리
  3. 최종 상태는 `completed`로 저장
- 목적: 현장 입력 편의성과 데이터 정합성 동시 보장

#### D) 검증/제약 (필수)
- 권한: `farm_admin`, `farm_staff`만 등록/완료 가능
- 중복 완료 방지: `idempotency_key` 강제 사용
- 상태 전이 규칙: `pending -> completed`만 허용(예외 정책 별도)
- 완료 실패 시: 도메인 반영과 상태 전이를 모두 롤백

### 7-2. 농장 구조 설정 기반 초기입력 UX (운영 시작 전)
1. 사용자가 사/방/칸 구조를 완성
2. "초기입력" 단계에서 칸별 초기 데이터 입력
   - 교배/임신/분만사: 모돈
   - 분만사: 모돈 + 자돈(돈군)
   - 기타 시설: 돈군/두수
3. 교배사/임신사는 방의 `housing_mode`에 따라 입력 UI 분기
   - `stall`: 모돈 개체 입력폼 중심
   - `group`: 돈군/두수 입력폼 중심(필요 시 모돈 보조 입력)
4. 방 row 설정 버튼 정책
   - 교배사/임신사: **운영방식** 버튼으로 모달을 열어 `군사/스톨`과 개수를 함께 설정
     - 군사 선택 시: 칸 개수 입력
     - 스톨 선택 시: 스톨 개수 입력
   - 그 외 사육시설: **칸 갯수 변경**만 허용(운영방식 변경 불가)
5. 모달 저장 클릭 시 해당 섹션 검증+즉시 저장을 수행
6. 필수 섹션 저장 완료 시 운영 시작 상태로 자동 전환

#### 7-2-a 전입일/이동일 저장 정책 (초기입력 연계)

- 초기입력에서 돈군이 형성되면 `pig_groups`에 저장되어야 하며, 동시에 재고 원장과 날짜 정합성을 맞춘다.
- 기준 날짜 정책:
  - `전입일(입식일)`은 필수이며, 해당 날짜를 opening 반영 기준일로 사용
  - 전입일 변경 시 `출생일`은 자동 역산, `일령`은 오늘 기준으로 자동 재계산한다.
- 최소 반영 컬럼:
  - `pig_groups.current_section_id` (현재 위치)
  - `pig_groups.birth_date` (돈군 출생일)
  - `section_inventory_ledger.occurred_at` (opening IN 발생일)
- 출생일 저장 위치 기준(현재 구현):
  - **정본(원천)**: `pig_groups.birth_date` (돈군 단위 출생일)
  - **개체 정본**: `sows.birth_date` (모돈 개체 출생일)
  - **화면 스냅샷(보조)**: `farm_sections.birthDate` (구조 화면 표시/검색 보조값, 정본 아님)
  - 일정/이력 연계 시 날짜 기준은 `pig_groups.birth_date`, `section_inventory_ledger.occurred_at`, `pig_movement_events.moved_at`를 우선 사용
- 일정/이동/실행 이력 연계 저장(표준):
  - `pig_movement_events.event_type='entry'`
  - `pig_movement_events.moved_at = 전입일(미입력 시 NOW())`
  - `pig_movement_lines.line_type='entry'`
  - `schedule_executions` 완료건 자동 생성
    - `execution_type='inspection'`, `status='completed'`
    - `result_ref_type='opening_section'`, `result_ref_id=section_id`
    - `scheduled_date=entryDate`, `completed_by=저장 사용자`
    - `work_plan_id`는 농장 단위 자동 work plan(`재고두수등록(초기값)`)을 재사용/생성하여 연결
  - 필요 시 `farm_sections.entryDate`를 동일 날짜로 동기화해 구조 화면과 일자 정합성 유지
- 현재 구현 기준:
  - 섹션 저장 성공 시 `farm_initialized_at`를 설정한다.
  - 섹션 저장 성공 시 `schedule_executions(completed)` 1건을 즉시 생성한다.
  - 섹션 저장 API 응답에 `scheduleExecutionId`를 포함한다.
  - 레거시 DB에서 `farm_sections.birthDate` 컬럼이 없을 수 있으므로, 필요 시 `scripts/alter_farm_sections_add_entry_birth_date.sql` 적용을 권장한다.
  - 운영 반영 체크리스트: `docs/schedule_executions_rollout_checklist.md`

### `/farm/move` (보조)
- 이벤트 이력 조회/검색
- 이벤트 상세 라인 조회

---

## 8) 트랜잭션 처리 규칙 (중요)

### 8-1. 분만 완료 트랜잭션
1. 일정 실행 상태 잠금(중복 완료 방지)
2. 돈군 생성
3. 칸 재고 원장 IN 기록
4. balance 갱신(사용 시)
5. 후속 일정 자동 생성
6. 실행 완료 처리

### 8-2. 이동 완료 트랜잭션
1. 이벤트/라인 입력 검증 (합계/음수/중복)
2. 출발 칸 재고 충분 여부 검증
3. 이동 이벤트/라인 저장
4. 원장 OUT/IN 기록
5. 돈군 두수/위치/상태 갱신
6. 실행 완료 처리

---

## 9) 분할/합군 구현 정책

### 전량 이동
- 원 돈군 위치만 변경

### 부분 이동(잔류)
- 원 돈군 `head_count` 감소
- 이동분은 신규 돈군 생성(기본 정책)

### 분할 이동(1 -> N)
- 라인별로 이동분 처리
- 잔여 두수는 원 돈군 유지

### 합군 이동(N -> 1)
- 대상 돈군 `head_count` 합산 (target은 **마리수가 많은 돈군 우선**)
- 마리수가 동일하면 tie-breaker는 **`created_at`이 더 이른 돈군 우선**
- 소스 돈군 두수 0이면 `status='merged'` 또는 `closed`

### 합군 데이터 변경 예시 (Before / After)

#### 예시 A: 전량 합군 (A 12두 + B 8두 -> 자돈사 1칸)

**Before**

| 그룹 | head_count | current_section_id | status |
|---|---:|---|---|
| A | 12 | 분만사-1칸 | active |
| B | 8 | 분만사-2칸 | active |

**이동 입력**

- target_group: A
- A 이동량 `x=12`, B 이동량 `y=8`
- 도착칸: 자돈사-1칸

**After**

| 그룹 | head_count | current_section_id | status | 비고 |
|---|---:|---|---|---|
| A (target) | 20 | 자돈사-1칸 | active | `12 + 8`로 합산 |
| B (source) | 0 | (유지 또는 NULL 정책) | merged | 운영종료, 이력보존 |

#### 예시 B: 부분 합군 (A 12두 중 7두 + B 8두 중 5두 -> 자돈사 1칸)

**Before**

| 그룹 | head_count | current_section_id | status |
|---|---:|---|---|
| A | 12 | 분만사-1칸 | active |
| B | 8 | 분만사-2칸 | active |

**이동 입력 (부분 합군은 신규 target 생성 권장)**

- target_group: 신규 C
- A 이동량 `x=7`, B 이동량 `y=5`
- 도착칸: 자돈사-1칸

**After**

| 그룹 | head_count | current_section_id | status | 비고 |
|---|---:|---|---|---|
| A (source) | 5 | 분만사-1칸 | active | 7두 이동 후 잔류 |
| B (source) | 3 | 분만사-2칸 | active | 5두 이동 후 잔류 |
| C (target, 신규) | 12 | 자돈사-1칸 | active | `7 + 5`로 신규 돈군 생성 |

> 본 기준서의 고정 정책: 부분 합군은 자동으로 **신규 target 돈군 생성** 방식으로 처리합니다.

### 정책 요약(확정)

- 일정 데이터는 계획 `schedule_work_plans` / 실행 `schedule_executions` 로 분리
- 실행의 예정/완료는 `schedule_executions.status`(`pending`/`completed`)로 운영 (예정/완료 물리 테이블 분리 없음)
- 돈군 현재 상태: `pig_groups`
- 이동/분할/합군 이력: `pig_movement_events` + `pig_movement_lines`
- 칸별 두수 이력: `section_inventory_ledger`
- 현재고 빠른 조회(옵션): `section_inventory_balance`

> **요약 박스: 실행 파이프라인(고정)**
> 1. `schedule_work_plans`(계획) 기준으로 실행건 생성  
> 2. 생성된 실행건은 `schedule_executions.status='pending'`(예정)으로 저장  
> 3. 일정관리 화면은 `pending` 실행건을 캘린더에 표시  
>    - 표시 단위는 **칸(section)** 이며, `section_id + scheduled_date`가 일치하는 셀에만 노출  
> 4. 작업자가 분만/이동 완료 처리 API 호출  
> 5. 도메인 반영(돈군/원장/현재고) 성공 후 같은 실행건을 `completed`로 전이  
> 6. `result_ref_type/result_ref_id`로 완료 결과(분만/이동 이벤트) 연결
>
> ※ 예정/완료는 물리 테이블 분리가 아니라 `schedule_executions.status`로 관리

### 실행 테이블 구조(`schedule_executions`)

#### 컬럼 상세 설명

| 컬럼 | 역할 | 상세 설명 | 운영 메모 |
|------|------|-----------|-----------|
| `id` | 실행건 PK | 실행 단위 1건의 고유 식별자(UUID) | API 경로의 `executionId`로 사용 |
| `farm_id` | 테넌트 키 | 농장 단위 데이터 격리를 위한 필수 키 | 모든 조회/수정 쿼리에 강제 포함 |
| `work_plan_id` | 계획 참조 | 실행건이 어떤 계획(`schedule_work_plans`)에서 생성됐는지 연결 | 계획 변경 이력 추적 기준 |
| `section_id` | 위치 참조 | 실행 대상 칸(위치). 위치 미지정 작업은 NULL 가능 | 위치 기반 캘린더 표시/필터링 키 |
| `execution_type` | 실행 분류 | 실행 종류(`birth`,`move`,`inspection` 등) | 완료 API 분기 기준 |
| `scheduled_date` | 예정일 | 실행 예정 날짜 | 캘린더 주간/일간 조회 핵심 조건 |
| `status` | 상태 전이 | `pending`,`completed`,`skipped`,`cancelled` | 예정/완료 물리 테이블 분리 없이 상태로 관리 |
| `completed_at` | 완료 시각 | 완료 처리된 시점 | `status='completed'`일 때 필수 |
| `completed_by` | 완료 처리자 | 완료 처리한 사용자 ID | 사용자 감사 로그 기준 |
| `result_ref_type` | 결과 타입 | 완료 결과가 연결된 도메인 이벤트 타입 | 예: `farrowing_event`,`movement_event` |
| `result_ref_id` | 결과 ID | 완료 결과 이벤트의 PK(UUID) | `result_ref_type`와 쌍으로 사용 |
| `idempotency_key` | 멱등 키 | 중복 완료/재시도 안전 처리를 위한 키 | farm 기준 partial unique 적용 |
| `memo` | 비고 | 작업자 메모/특이사항 | UI 입력값 그대로 저장 가능 |
| `created_at` | 생성 시각 | 실행건 생성 시각 | 기본값 `now()` |
| `updated_at` | 수정 시각 | 실행건 변경 시각 | 상태 전이 시 갱신 |

#### 구조(관계) 요약

- `schedule_work_plans`(계획) 1건에서 `schedule_executions`(실행) N건이 생성됨
- 실행건은 기본 `status='pending'`으로 생성되고, 완료 API 성공 시 `completed`로 전이됨
- 완료 시 도메인 이벤트를 생성하고 `result_ref_type/result_ref_id`로 연결함
  - 분만 완료: `farrowing_events`
  - 이동 완료: `pig_movement_events`
- `section_id`, `scheduled_date`, `status` 조합으로 캘린더/작업 목록 조회 성능을 확보함

#### 무결성 체크(권장)

- `status='completed'`이면 `completed_at`, `completed_by`는 NULL 불가
- `result_ref_type`와 `result_ref_id`는 둘 다 NULL이거나 둘 다 값 존재
- `idempotency_key`는 같은 `farm_id` 내 중복 금지(partial unique)
- `execution_type`, `status`는 허용값 체크 제약(ENUM 또는 CHECK) 권장

#### 이벤트 기반 일정 생성 시 필수 입력 항목(권장 고정)

- 일정이 출생/분만/교배 같은 도메인 이벤트를 기준으로 자동 생성될 때는, 기준 이벤트 식별값과 기준 날짜를 필수로 강제한다.
- 공통 필수:
  - `farm_id` (농장 격리 키)
  - `section_id` 또는 위치를 확정할 수 있는 값
  - `event_date` 성격의 기준 날짜(예: `birth_date`, `farrowing_date`, `service_date`)
  - 중복 생성 방지를 위한 `idempotency_key`(또는 동등한 유니크 키)
- 교배 기준 일정 생성:
  - 필수: `sow_id`(또는 `sow_no`), `service_date`
- 분만 기준 일정 생성:
  - 필수: `origin_sow_id`, `farrowing_date`, `born_count(>0)`
- 출생(자돈/돈군 생성) 기준 일정 생성:
  - 필수: `group_id`(또는 생성 돈군 식별자), `birth_date`, `head_count(>0)`
- 검증 규칙(최소):
  - 날짜 유효성(공백/형식/허용 범위)
  - `farm_id` 일치 및 위치(`section_id`) 유효성
  - 개체/돈군 식별자 존재성
  - 수량값 양수(`head_count > 0`, `born_count > 0`)

---

## 10) 운영 규칙

- 모든 조회는 `farm_id` 강제
- 삭제는 soft delete 우선
- 원장 데이터는 수정 대신 정정(ADJ) 추가
- 숫자 검증: `head_count > 0`, 잔여 음수 금지
- 같은 실행 이벤트 중복 처리 금지(idempotency key)

---

## 11) 구현 순서 제안

1. 테이블 생성: `pig_groups`, `pig_movement_events`, `pig_movement_lines`, `section_inventory_ledger`
2. 이동 이벤트 API + 트랜잭션 검증 구현
3. 일정 페이지 실행 모달(분만/이동) 구현
4. 후속 일정 자동생성 연결
5. balance/리포트 고도화

---

## 12) 완료 기준 (Definition of Done)

- 분만 완료 시 돈군 자동 생성 + 칸 재고 반영
- 부분 이동/분할 이동/합군 이동이 모두 정상 처리
- 일정 완료와 이동 이벤트가 1:1로 추적 가능
- 칸별 현재 두수와 원장 이력이 일치
- 농장별 데이터 격리(`farm_id`) 검증 완료

---

## 13) 테이블/컬럼 주석 문구(복사용)

아래 문구는 DB `COMMENT ON TABLE`, `COMMENT ON COLUMN`에 그대로 사용할 수 있도록 정리했습니다.  
각 컬럼의 "설명 + 사용용도"를 함께 적었습니다.

### 13-1. `pig_groups`

- 테이블 주석: `돈군 마스터. 분만/분할/합군으로 생성된 돈군의 현재 상태와 위치를 관리`

| 컬럼 | 주석(설명) | 사용 용도 |
|---|---|---|
| `id` | 돈군 고유 식별자(PK) | 내부 참조, FK 연결 |
| `farm_id` | 소속 농장 ID | 농장별 데이터 격리/권한 필터 |
| `group_no` | 사용자 표시용 돈군 번호 | 화면 조회/검색용 식별자 |
| `root_group_id` | 계보 추적용 루트 돈군 ID | 분할/합군 후 원계보 조회 |
| `current_section_id` | 현재 위치 칸 ID | 현재 사육 위치 표시 |
| `head_count` | 현재 돈군 두수 | 재고/이동 검증 기준 |
| `status` | 돈군 상태(active/closed/merged) | 운영 가능 여부 판단 |
| `created_reason` | 생성 사유(birth/split/manual/merge) | 생성 출처 추적 |
| `parent_group_id` | 분할 시 원 돈군 ID | 계보/분할 이력 추적 |
| `memo` | 비고 | 현장 특이사항 기록 |
| `created_at` | 생성 시각 | 감사 이력 |
| `updated_at` | 최종 수정 시각 | 동기화/정렬 기준 |
| `is_deleted` | 소프트 삭제 여부 | 논리 삭제 처리 |

### 13-2. `pig_movement_events`

- 테이블 주석: `이동 작업 헤더. 한 번의 이동 업무(완료 이벤트) 단위를 저장`

| 컬럼 | 주석(설명) | 사용 용도 |
|---|---|---|
| `id` | 이동 이벤트 고유 식별자(PK) | 이동 라인 묶음 키 |
| `farm_id` | 소속 농장 ID | 농장별 이력 분리 |
| `event_type` | 이동 유형(full/partial/split/merge/entry/shipment) | UI 분기/검증 규칙 |
| `scheduled_work_plan_id` | 연계된 일정 ID | 일정 완료와 이동 이력 연결 |
| `moved_at` | 실제 이동 처리 시각 | 작업 일시 기록 |
| `moved_by` | 작업자 사용자 ID | 책임자/감사 추적 |
| `memo` | 비고 | 현장 기록 |
| `created_at` | 생성 시각 | 감사 이력 |

### 13-3. `pig_movement_lines`

- 테이블 주석: `이동 상세 라인. 분할/합군/부분이동을 라인 단위로 표현`

| 컬럼 | 주석(설명) | 사용 용도 |
|---|---|---|
| `id` | 이동 라인 고유 식별자(PK) | 라인 단위 추적 |
| `farm_id` | 소속 농장 ID | 농장별 데이터 분리 |
| `event_id` | 이동 이벤트 ID(FK) | 헤더-라인 연결 |
| `source_group_id` | 출발 돈군 ID | 분할/부분 이동 출처 |
| `target_group_id` | 도착 돈군 ID | 합군/신규돈군 연결 |
| `from_section_id` | 출발 칸 ID | 재고 OUT 기준 위치 |
| `to_section_id` | 도착 칸 ID | 재고 IN 기준 위치 |
| `head_count` | 라인 이동 두수 | 수량 검증/반영 값 |
| `line_type` | 라인 유형(move/split_out/split_in/merge_in/merge_out) | 라인 해석 규칙 |
| `created_at` | 생성 시각 | 감사 이력 |

### 13-4. `section_inventory_ledger`

- 테이블 주석: `칸별 두수 재고 원장. IN/OUT/ADJ 트랜잭션을 누적 저장`

| 컬럼 | 주석(설명) | 사용 용도 |
|---|---|---|
| `id` | 원장 고유 식별자(PK) | 원장 트랜잭션 추적 |
| `farm_id` | 소속 농장 ID | 농장별 격리 |
| `section_id` | 칸 ID | 칸 단위 재고 집계 |
| `pig_group_id` | 관련 돈군 ID | 돈군별 재고 흐름 추적 |
| `direction` | 입출 방향(IN/OUT/ADJ) | 증감 계산 기준 |
| `head_count` | 증감 두수 | 현재고 계산 값 |
| `event_id` | 연계 이동 이벤트 ID | 이동과 원장 연결 |
| `ref_type` | 참조 유형(birth/movement/adjust) | 발생 원인 분류 |
| `ref_id` | 참조 원본 ID | 원본 데이터 역추적 |
| `occurred_at` | 실제 발생 시각 | 시계열 집계/조회 |
| `created_at` | 생성 시각 | 감사 이력 |

### 13-5. `section_inventory_balance`

- 테이블 주석: `칸별 현재 두수 스냅샷. 원장 집계 성능 최적화용`

| 컬럼 | 주석(설명) | 사용 용도 |
|---|---|---|
| `farm_id` | 소속 농장 ID | 파티션/조회 키 |
| `section_id` | 칸 ID | 현재고 기준 위치 |
| `head_count` | 현재 두수 | 화면 즉시 조회값 |
| `updated_at` | 최종 갱신 시각 | 동기화 상태 확인 |

### 13-6. SQL 주석 적용 예시

```sql
COMMENT ON TABLE pig_groups IS '돈군 마스터. 분만/분할/합군으로 생성된 돈군의 현재 상태와 위치를 관리';
COMMENT ON COLUMN pig_groups.group_no IS '사용자 표시용 돈군 번호. 화면 조회/검색용 식별자';
COMMENT ON COLUMN pig_groups.current_section_id IS '현재 위치 칸 ID. 현재 사육 위치 표시';
COMMENT ON COLUMN pig_groups.head_count IS '현재 돈군 두수. 재고/이동 검증 기준';
```

---

## 14) 출하 역추적 설계 (모돈 기원 포함)

요구사항:
- 여러 칸(예: 1칸 20두, 2칸 10두, 3칸 3두) 출하 이후에도
- "어느 칸들을 거쳤는지"와 "어느 모돈에서 시작됐는지"를 한 번에 조회

이를 위해 돈군 관리는 다음처럼 분리합니다.

### 14-1. 기본 원칙

1. `pig_groups`는 현재 상태만 보관
2. 이동/분할/합군은 이벤트 이력 테이블에 누적
3. 분할/합군 시 부모-자식 계보를 별도 테이블에 기록
4. 출하는 헤더/라인으로 저장하여 다중 칸 출하를 한 건으로 관리

### 14-2. 추가 권장 테이블

#### a) `farrowing_events` (분만 원천 이벤트)
- 용도: 돈군 시작점과 모돈 연결
- 최소 컬럼 예시:
  - `id` UUID PK
  - `farm_id` UUID
  - `section_id` UUID
  - `created_group_id` UUID  -- 분만으로 생성된 돈군 ID
  - `origin_sow_id` UUID NULL
  - `born_count` INTEGER
  - `occurred_at` TIMESTAMP

#### b) `pig_group_lineage_edges` (계보 엣지)
- 용도: 돈군 분할/합군 계보 추적
- 최소 컬럼 예시:
  - `id` UUID PK
  - `farm_id` UUID
  - `parent_group_id` UUID
  - `child_group_id` UUID
  - `edge_type` VARCHAR(20) -- split/merge/birth_link
  - `event_id` UUID NULL
  - `created_at` TIMESTAMP

#### c) `shipment_events`, `shipment_lines` (출하 헤더/라인)
- 용도: 다중 칸 출하를 한 이벤트로 저장
- 최소 컬럼 예시:
  - `shipment_events`: `id`, `farm_id`, `shipped_at`, `shipped_by`, `memo`
  - `shipment_lines`: `id`, `event_id`, `source_group_id`, `section_id`, `head_count`

### 14-3. 추적 방식

1. 출하 이벤트 조회(`shipment_events` + `shipment_lines`)
2. 라인별 `source_group_id`에서 시작
3. `pig_group_lineage_edges`를 재귀로 역탐색
4. 도달한 최초 노드의 `farrowing_events`를 통해 `origin_sow_id` 확인
5. 중간 이동 경로는 `pig_movement_events/lines` 시계열로 나열

### 14-4. 운영 정책 (확정 권장)

- 전량 이동: 돈군 ID 유지
- 부분 이동/분할: 이동분은 신규 돈군 ID 생성
- 합군: target 돈군 1개만 active 유지, source는 merged/closed
- 계보는 항상 `pig_group_lineage_edges`에 남김

위 정책을 쓰면 출하 후에도
"어떤 칸 경로를 거쳤는지 + 어떤 모돈 기원인지"를 안정적으로 역추적할 수 있습니다.

---

## 15) 추적 조회 SQL 샘플 (재귀 CTE)

아래 SQL은 PostgreSQL 기준 예시입니다.  
파라미터는 `:farmId`, `:shipmentEventId` 형태로 표기했습니다.

### 15-1. 출하 이벤트 기준 돈군 계보(부모) 역추적

```sql
WITH RECURSIVE
shipped_groups AS (
  SELECT DISTINCT sl.source_group_id AS group_id
  FROM shipment_lines sl
  JOIN shipment_events se ON se.id = sl.event_id
  WHERE se.farm_id = :farmId
    AND se.id = :shipmentEventId
),
lineage AS (
  SELECT
    sg.group_id AS start_group_id,
    sg.group_id AS current_group_id,
    0 AS depth
  FROM shipped_groups sg

  UNION ALL

  SELECT
    l.start_group_id,
    e.parent_group_id AS current_group_id,
    l.depth + 1 AS depth
  FROM lineage l
  JOIN pig_group_lineage_edges e
    ON e.child_group_id = l.current_group_id
   AND e.farm_id = :farmId
  WHERE l.depth < 30
)
SELECT DISTINCT
  start_group_id,
  current_group_id AS ancestor_group_id,
  depth
FROM lineage
ORDER BY start_group_id, depth;
```

### 15-2. 출하 돈군의 모돈 기원(`origin_sow_id`) 조회

```sql
WITH RECURSIVE
shipped_groups AS (
  SELECT DISTINCT sl.source_group_id AS group_id
  FROM shipment_lines sl
  JOIN shipment_events se ON se.id = sl.event_id
  WHERE se.farm_id = :farmId
    AND se.id = :shipmentEventId
),
lineage AS (
  SELECT sg.group_id AS start_group_id, sg.group_id AS current_group_id, 0 AS depth
  FROM shipped_groups sg
  UNION ALL
  SELECT l.start_group_id, e.parent_group_id, l.depth + 1
  FROM lineage l
  JOIN pig_group_lineage_edges e
    ON e.child_group_id = l.current_group_id
   AND e.farm_id = :farmId
  WHERE l.depth < 30
),
origin_candidates AS (
  SELECT
    l.start_group_id,
    fe.origin_sow_id,
    fe.occurred_at,
    ROW_NUMBER() OVER (
      PARTITION BY l.start_group_id
      ORDER BY fe.occurred_at ASC
    ) AS rn
  FROM lineage l
  JOIN farrowing_events fe
    ON fe.created_group_id = l.current_group_id
   AND fe.farm_id = :farmId
)
SELECT
  start_group_id,
  origin_sow_id,
  occurred_at AS farrowing_at
FROM origin_candidates
WHERE rn = 1
ORDER BY start_group_id;
```

### 15-3. 출하 돈군의 이동 경로(칸 히스토리) 나열

```sql
WITH RECURSIVE
shipped_groups AS (
  SELECT DISTINCT sl.source_group_id AS group_id
  FROM shipment_lines sl
  JOIN shipment_events se ON se.id = sl.event_id
  WHERE se.farm_id = :farmId
    AND se.id = :shipmentEventId
),
lineage AS (
  SELECT sg.group_id AS start_group_id, sg.group_id AS current_group_id, 0 AS depth
  FROM shipped_groups sg
  UNION ALL
  SELECT l.start_group_id, e.parent_group_id, l.depth + 1
  FROM lineage l
  JOIN pig_group_lineage_edges e
    ON e.child_group_id = l.current_group_id
   AND e.farm_id = :farmId
  WHERE l.depth < 30
),
lineage_groups AS (
  SELECT DISTINCT start_group_id, current_group_id AS group_id
  FROM lineage
)
SELECT
  lg.start_group_id,
  me.moved_at,
  ml.from_section_id,
  ml.to_section_id,
  ml.head_count,
  ml.line_type
FROM lineage_groups lg
JOIN pig_movement_lines ml
  ON ml.farm_id = :farmId
 AND (ml.source_group_id = lg.group_id OR ml.target_group_id = lg.group_id)
JOIN pig_movement_events me
  ON me.id = ml.event_id
 AND me.farm_id = :farmId
ORDER BY lg.start_group_id, me.moved_at, ml.created_at;
```

### 15-4. 성능 인덱스 권장

```sql
CREATE INDEX IF NOT EXISTS idx_lineage_child
  ON pig_group_lineage_edges (farm_id, child_group_id);

CREATE INDEX IF NOT EXISTS idx_farrowing_created_group
  ON farrowing_events (farm_id, created_group_id);

CREATE INDEX IF NOT EXISTS idx_shipment_lines_event_group
  ON shipment_lines (event_id, source_group_id);

CREATE INDEX IF NOT EXISTS idx_movement_lines_source
  ON pig_movement_lines (farm_id, source_group_id);

CREATE INDEX IF NOT EXISTS idx_movement_lines_target
  ON pig_movement_lines (farm_id, target_group_id);
```

