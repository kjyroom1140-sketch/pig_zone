# schedule_executions 적용 체크리스트 (1~8)

목표: `농장 구조 설정 > 초기값 저장` 결과가 `일정관리`에서 `재고두수등록(초기값)` 완료건으로 표시되도록 운영 반영한다.

---

## 1) DB 백업

- 운영/스테이징 DB 백업 수행
- 백업 확인 후 다음 단계 진행

예시(환경별 값 치환):

```bash
pg_dump -h <HOST> -p <PORT> -U <USER> -d <DB_NAME> -Fc -f backup_before_schedule_executions.dump
```

---

## 2) 필수 테이블 생성

- `scripts/ensure_schedule_executions_opening_prerequisites.sql` 실행
  - `schedule_executions` 생성
  - 관련 인덱스/제약 생성
  - `pig_groups.birth_date`, `farm_sections.entryDate/birthDate` 보정

실행 방법:

- `psql` 사용 시:
  - `psql -h <HOST> -p <PORT> -U <USER> -d <DB_NAME> -f scripts/ensure_schedule_executions_opening_prerequisites.sql`
- `psql`이 없으면(권장 대안):
  - `cd backend`
  - `go run ./cmd/run-sql ../scripts/ensure_schedule_executions_opening_prerequisites.sql`

---

## 3) 보완 마이그레이션

- 레거시 환경이면 아래 추가 적용
  - `scripts/alter_farm_sections_add_entry_birth_date.sql`
  - `scripts/alter_pig_groups_add_birth_date.sql`

---

## 4) 테이블/인덱스 검증

- `scripts/check_schedule_executions_opening.sql` 실행
- 아래가 모두 정상인지 확인
  - `schedule_executions` 테이블 존재
  - `uq_schedule_executions_idempotency` 존재
  - `idx_schedule_executions_farm_date_status` 존재
  - `idx_schedule_executions_farm_section_date` 존재

실행 방법:

- `psql` 사용 시:
  - `psql -h <HOST> -p <PORT> -U <USER> -d <DB_NAME> -f scripts/check_schedule_executions_opening.sql`
- `psql`이 없으면(권장 대안):
  - `cd backend`
  - `go run ./cmd/check-schedule-rollout`

---

## 5) API 재시작 + opening 저장 테스트

- 백엔드 재시작
- 테스트 농장에서 특정 칸에 초기값 저장 1회 수행
- `schedule_executions`에 아래 조건 행 생성 확인
  - `status='completed'`
  - `result_ref_type='opening_section'`
  - `scheduled_date=entryDate`

---

## 6) 일정관리 화면 확인

- `/dashboard/schedule` 이동
- 해당 날짜/칸 셀에 완료 배지 표시 확인
- 완료 배지 클릭 시 상세(전입일/두수/돈군번호/출생일/일령) 확인

---

## 7) 기존 데이터 백필(선택)

- 과거 opening 저장분 표시가 필요하면:
  - `scripts/backfill_opening_schedule_executions.sql` 실행
- 실행 후 다시 `scripts/check_schedule_executions_opening.sql`로 확인

실행 방법:

- `psql` 사용 시:
  - `psql -h <HOST> -p <PORT> -U <USER> -d <DB_NAME> -f scripts/backfill_opening_schedule_executions.sql`
- `psql`이 없으면(권장 대안):
  - `cd backend`
  - `go run ./cmd/run-sql ../scripts/backfill_opening_schedule_executions.sql`
  - `go run ./cmd/check-schedule-rollout`

---

## 8) 문서 동기화

- 자동 work plan 명칭을 문서에서 통일:
  - 이전: `[AUTO] opening 초기값 저장`
  - 현재: `재고두수등록(초기값)`

