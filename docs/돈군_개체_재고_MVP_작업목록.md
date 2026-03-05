# 돈군·개체·재고 MVP 작업목록

기준 문서: `docs/돈군_개체_재고_MVP_기준서.md`  
목표: 정책 고정 -> DB -> API -> UI -> 검증 순으로 안전하게 구현

---

## 1단계) 정책/기준 고정

- [x] `MVP-001` 합군/분할/부분이동 정책 확정 (부분 합군은 신규 target 돈군 생성, 전량 합군은 **마리수가 많은 돈군을 target**으로 선택)
- [x] `MVP-002` ID 정책 확정 (`id(UUID)` 불변, `group_no` 표시용, `root_group_id` 계보용)
- [x] `MVP-003` 데이터 원칙 확정 (`pig_groups=현재값`, `movement/ledger=이력`)

### 확정값 (고정 정책)

- 합군 결과는 **돈군 1개**로 정리한다.
- 전량 합군 시 target 선택 규칙은 **마리수가 많은 돈군 우선**으로 한다.
- 마리수가 동일하면 tie-breaker는 **`created_at`이 더 이른 돈군 우선**으로 고정한다.
- 일정 데이터는 **계획(`schedule_work_plans`)** 과 **실행(`schedule_executions`)** 을 분리한다.
- 실행의 예정/완료는 **`schedule_executions.status`(`pending`/`completed`)** 로 운영하며, 예정/완료를 물리적으로 별도 테이블로 분리하지 않는다.
- 운영 시작 전 초기 데이터는 **농장 구조 설정 내 초기입력 단계**에서 칸 단위로 확정한다.
- 최종 확정 버튼 없이 **초기입력 모달 저장 시 섹션 단위로 즉시 검증/반영**한다.
- 교배사/임신사/분만사는 **모돈 정보 입력 필수**, 분만사는 모돈+자돈 초기값 동시 입력을 허용한다.
- 교배사/임신사는 방 단위 `housing_mode`(`stall`/`group`)를 설정해 입력/검증 규칙을 분기한다.
- 운영방식별 개수 규칙은 **군사=칸 개수**, **스톨=스톨 개수**로 고정한다.
- 방 편집은 `운영방식` 버튼 -> 통합 모달(방식 선택 + 개수 입력) UX로 운영한다.
- 운영방식 선택은 **교배사/임신사만 허용**하고, 그 외 사육시설은 **칸 갯수 변경만 허용**한다.
- API는 비대상 시설의 `housing_mode=stall` 저장 요청을 차단한다.
- 이동/분만 실행건의 위치 단위는 **칸(section)** 으로 고정하며, 캘린더 표시도 `section_id + scheduled_date` 일치 셀에만 노출한다.
- 방(room) 레벨 텍스트는 구조/요약 용도로만 사용하고 실행건(예정/완료)으로 취급하지 않는다.

### 일정 실행 파이프라인 (고정)

1. `schedule_work_plans`(계획) 기준으로 실행건 생성
2. 생성된 실행건은 `schedule_executions.status='pending'`(예정)으로 저장
3. 일정관리 화면은 `pending` 실행건을 캘린더에 표시
4. 작업자가 분만/이동 완료 처리 API 호출
5. 도메인 반영(돈군/원장/현재고) 성공 후 같은 실행건을 `completed`로 전이
6. `result_ref_type/result_ref_id`로 완료 결과(분만/이동 이벤트) 연결

---

## 2단계) DB 스키마/마이그레이션

- [x] `MVP-010` `pig_groups` 생성 (`root_group_id`, `parent_group_id` 포함)
- [x] `MVP-011` `pig_movement_events` 생성 (이동 헤더)
- [x] `MVP-012` `pig_movement_lines` 생성 (이동 라인)
- [x] `MVP-013` `section_inventory_ledger` 생성 (칸별 두수 원장)
- [x] `MVP-014` `section_inventory_balance` 생성 (현재고 스냅샷, 옵션)
- [x] `MVP-015` `farrowing_events` 생성 (`origin_sow_id`, `created_group_id`)
- [x] `MVP-016` `pig_group_lineage_edges` 생성 (계보 엣지)
- [x] `MVP-017` `shipment_events`, `shipment_lines` 생성 (출하 헤더/라인)
- [x] `MVP-018` 인덱스 적용 (`farm_id`, `child_group_id`, `source_group_id`, `target_group_id`, `occurred_at`)
- [x] `MVP-019` 테이블/컬럼 코멘트 적용 (`COMMENT ON TABLE/COLUMN`)
- [x] `MVP-020` 롤백 SQL 준비 (create/drop 쌍)
- [x] `MVP-021` `schedule_executions` 생성 (계획/실행 분리 핵심 테이블)
- [x] `MVP-022` `schedule_executions` 제약/인덱스 적용 (`farm_id, scheduled_date, status`, `idempotency_key`)
- [x] `MVP-023` `sows` 테이블 생성 (모돈 개체 마스터: `sow_no`, `current_section_id`, `status`)
- [x] `MVP-024` opening 상태 컬럼/테이블 추가 (`farm_initialized_at` 또는 bootstrap 상태 테이블)
- [x] `MVP-025` opening 반영 규약 추가 (`section_inventory_ledger.ref_type='opening'`)
- [x] `MVP-026` `farrowing_events.origin_sow_id -> sows.id` FK/인덱스 정비
- [x] `MVP-027` `farm_rooms.housing_mode` 컬럼 추가 (`stall`/`group`, room 단위)
- [ ] `MVP-028` `housing_mode` 제약/기본값/인덱스 정비 (CHECK + 조회 인덱스)
- [ ] `MVP-029` 운영중 모드 변경 가드용 상태 컬럼/검증 쿼리 정비

---

## 3단계) 백엔드 API (Go)

- [x] `MVP-030` 돈군 CRUD API 구현 (`/api/farms/:farmId/pig-groups`)
- [x] `MVP-031` 이동 이벤트 API 구현 (`/pig-movement-events`, `lines[]` 검증)
- [x] `MVP-032` 재고 조회 API 구현 (`/section-inventory/ledger`, `/section-inventory/balances`)
- [ ] `MVP-033` 분만 완료 API 구현 (돈군 생성 + 원장 IN + 후속 일정 생성)
- [ ] `MVP-034` 이동 완료 API 구현 (이벤트 저장 + 원장 OUT/IN + 돈군 상태 갱신)
- [x] `MVP-035` 출하 API 구현 (`shipment_events/lines` + 원장 OUT)
- [x] `MVP-036` 역추적 API 구현 (출하 기준 계보 재귀 + 모돈 기원 조회)
- [ ] `MVP-037` 동시성/중복 방지 적용 (row lock + idempotency key)
- [ ] `MVP-038` 권한 적용 (`super_admin`, `farm_admin`, `farm_staff`)
- [ ] `MVP-039` 에러 코드/감사 로그 표준화
- [x] `MVP-040` 일정 실행건 생성 로직 구현 (`schedule_work_plans -> schedule_executions(pending)`)
- [x] `MVP-041` 일정 실행건 조회 API 구현 (`/schedule-executions`, 기간/칸/상태 필터)
- [x] `MVP-042` 분만 완료 API를 `schedule_executions` 전이 기준으로 구현 (`pending -> completed`)
- [x] `MVP-043` 이동 완료 API를 `schedule_executions` 전이 기준으로 구현 (`pending -> completed`)
- [ ] `MVP-044` 완료 결과 연결 구현 (`result_ref_type/result_ref_id` 저장)
- [x] `MVP-045` 캘린더 예정 등록 API 구현 (`POST /schedule-executions`)
- [x] `MVP-046` 예정 없이 바로 완료 플로우 구현 (내부 pending 생성 후 completed 전이)
- [x] `MVP-047` opening 검증 API 구현 (`POST /bootstrap/opening/validate`)
- [x] `MVP-048` opening 확정 API 구현 (`POST /bootstrap/opening/commit`, 트랜잭션)
- [x] `MVP-049` opening 상태 조회/완료 API 가드 구현 (`GET /bootstrap/opening/status`)
- [x] `MVP-063` 방 수정 API에 `housing_mode` 저장/조회 반영
- [ ] `MVP-064` opening validate에 `stall/group`별 입력 검증 규칙 반영
- [ ] `MVP-065` 운영중 `housing_mode` 변경 가드 API(재고/모돈 0 검증) 반영

---

## 4단계) 프론트엔드 (Next.js)

- [ ] `MVP-050` `/farm/schedule` 분만 실행 모달 구현
- [ ] `MVP-051` `/farm/schedule` 이동 실행 모달 구현 (다중 도착 라인)
- [ ] `MVP-052` 완료 처리 UX 정리 (성공/실패/중복 피드백)
- [ ] `MVP-053` `/farm/move` 이력 목록 화면 구현 (기간/칸/돈군 필터)
- [ ] `MVP-054` `/farm/move` 이벤트 상세 라인 화면 구현
- [ ] `MVP-055` `/farm/move` 역추적 UI 구현 (계보 + 모돈 + 경로)
- [x] `MVP-056` `/farm/schedule`에 `pending` 실행건 조회/표시 연동
- [x] `MVP-057` 완료 처리 후 `completed` 전이 결과 즉시 반영 (낙관/재조회 정책 포함)
- [x] `MVP-058` 캘린더 셀 액션 구현 (날짜/칸 선택 -> 예정 등록 모달)
- [x] `MVP-059` 캘린더 셀 액션 구현 (예정 선택/바로 완료 -> 분만·이동 완료 모달)
- [x] `MVP-060` `/farm/admin` 농장 구조 설정 내 초기값 설정 모드 구현(탭 없이 동일 화면)
- [x] `MVP-061` 시설 타입별 초기입력 폼 구현 (모돈/자돈/돈군)
- [x] `MVP-062` 초기입력 모달 저장 즉시 검증/반영 UX 구현
- [x] `MVP-066` 농장 구조 설정의 방 편집에 `스톨/군사` 선택 UI 추가
- [ ] `MVP-067` 초기입력 폼을 `housing_mode`에 따라 동적 분기 (`stall=모돈 개체`, `group=돈군/두수`)
- [ ] `MVP-068` 모드 변경 시 영향 안내 모달/검증 실패 메시지 UX 추가
- [x] `MVP-081` `pig_groups.birth_date` 컬럼 추가 및 마이그레이션 반영
- [x] `MVP-082` 섹션 단위 초기값 저장 API 구현 (`POST /bootstrap/opening/sections/:sectionId/save`)
- [x] `MVP-083` 초기값 저장 시 `entry` 이동이력 반영 (`pig_movement_events/lines`)
- [x] `MVP-084` 초기입력 모달에 `전입일` + `출생일/일령` 입력 및 계산 UI 반영
- [x] `MVP-085` 초기값 저장 결과를 `schedule_executions(completed)`에 자동 반영
- [x] `MVP-086` opening 데이터 기준 후속 예정 자동 생성 로직 추가 (`schedule_work_plans -> schedule_executions(pending)`, idempotent)
- [x] `MVP-087` opening 기존 데이터 동기화 API 추가 (`POST /api/farms/:farmId/schedule-executions/sync-opening`)
- [x] `MVP-088` `/farm/schedule` 조회 전 opening 동기화 호출 + 방(room) 행 실행 텍스트 제거(섹션 셀만 표시)

---

## 최근 진행상태 (2026-02-28)

- `schedule_work_plans` 규칙을 기준으로 opening 돈군의 후속 실행건(`pending`)을 자동 생성하도록 백엔드 반영 완료.
- `criteria_content` 해석 범위를 확장해 `start_day/startDay/end_day/endDay/start_date/startDate/end_date/endDate`까지 처리.
- 기존에 저장된 opening 데이터도 재저장 없이 반영되도록 `sync-opening` API를 추가하고, 일정 페이지 조회 시 선동기화 연동 완료.
- 캘린더 정책을 section 기준으로 고정: 실행건은 `section_id + scheduled_date` 일치 셀에서만 표시, room 행은 구조/요약 전용.
- 컴파일/타입체크 통과: backend `go test ./...`, frontend `npx tsc --noEmit`.

## 다음 작업 (우선순위)

1. **동기화 가시성 강화**
   - `sync-opening` 결과(생성/스킵 건수) UI 노출 및 수동 재동기화 버튼 추가.
2. **규칙 해석 고도화**
   - `criteria_content`의 `weekly/monthly/yearly/count` 유형까지 날짜 생성 로직 확장.
3. **돈군 단위 연결 강화**
   - `schedule_executions`에 `pig_group_id` 정식 연결(컬럼/인덱스/응답) 검토 및 적용.
4. **백필/운영 도구 정리**
   - 운영 반영용 백필 SQL/Go 커맨드 표준화(`sync-opening` 대량 실행/검증 포함).
5. **검증 항목 우선 수행**
   - `MVP-075`, `MVP-076`, `MVP-077`(상태전이/idempotency/opening 정합성) 테스트 케이스 먼저 완료.

---

## 5단계) 테스트/검증/배포

- [ ] `MVP-070` 시나리오 테스트 (전량/부분/분할/합군/출하)
- [ ] `MVP-071` 정합성 테스트 (원장 합계 == 현재고, 음수 방지)
- [ ] `MVP-072` 농장 격리 테스트 (`farm_id` 크로스 접근 차단)
- [ ] `MVP-073` 성능 테스트 (재귀 조회/이력 목록 인덱스 검증)
- [x] `MVP-074` 배포 체크리스트 정리 (백업/마이그레이션/롤백)
- [ ] `MVP-075` 상태 전이 테스트 (`pending -> completed`, 중복 완료 방지)
- [ ] `MVP-076` 재처리/idempotency 테스트 (동일 key 재호출 안전성)
- [ ] `MVP-077` opening 정합성 테스트 (opening IN 합계 == balance 초기값)
- [ ] `MVP-078` 분만 사전조건 테스트 (모돈 없는 칸 분만 차단)
- [ ] `MVP-079` `housing_mode` 변경 가드 테스트 (운영중 변경 제한/예외 허용)
- [ ] `MVP-080` `stall/group`별 입력 검증 테스트 (필수값/정합성)

---

## 권장 실행 순서

1. 정책 확정 (`MVP-001~003`)
2. DB 확정 (`MVP-010~029`)
3. API 구현 (`MVP-030~049`, `MVP-063~065`)
4. UI 연결 (`MVP-050~068`)
5. 검증/배포 (`MVP-070~080`)

