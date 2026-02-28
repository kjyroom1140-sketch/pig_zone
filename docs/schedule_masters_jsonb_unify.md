# schedule_sortations / schedule_jobtypes / schedule_criterias JSON 컬럼 JSONB 통일

## 이유

- `schedule_sortations.sortations`, `schedule_jobtypes.jobtypes`, `schedule_criterias.criterias`가 **TEXT**로만 있으면:
  - 스캔 시 타입에 따라 `*string` / `*[]byte`를 나눠 써야 하고
  - JOIN하는 `schedule_work_plans` 목록 등에서 타입 불일치로 행이 빠지는 문제가 생길 수 있음.
- **JSONB로 통일**하면:
  - DB에서 JSON 타입·연산이 일정해지고
  - 백엔드에서 `*[]byte`로만 읽/쓰면 되어 장기적으로 유지보수가 쉬움.

## 적용 순서 (완료한 경우)

- ✅ **1. 마이그레이션 실행** — `run_schedule_masters_json_to_jsonb.js` 실행 완료 시, 세 컬럼이 JSONB로 변경됨.
- ✅ **2. 백엔드** — 이미 JSONB 기준으로 수정되어 있음. API 서버 재시작 후 반영됨.
- **3. 동작 확인** — 기초 일정 관리 > 작업 목록, 구분/작업유형/기준 목록·추가·수정 확인.

---

## 적용 순서 (처음 적용할 때)

1. **마이그레이션 실행**  
   아래 중 하나로 JSON 컬럼을 JSONB로 바꿉니다.

   ```bash
   node scripts/run_schedule_masters_json_to_jsonb.js
   ```

   또는 PostgreSQL에서 `scripts/schedule_masters_json_columns_to_jsonb.sql` 내용을 직접 실행.

2. **백엔드 배포**  
   이번에 수정한 백엔드(구분/작업유형/기준 목록·추가·수정이 JSONB `*[]byte` 기준)를 배포합니다.

3. **동작 확인**  
   - 기초 일정 관리 > 작업 목록이 정상적으로 나오는지
   - 구분/작업유형/기준 목록·추가·수정이 정상인지 확인합니다.

## 변경 대상 컬럼

| 테이블 | 컬럼 | 변경 |
|--------|------|------|
| schedule_sortations | sortations | TEXT → JSONB |
| schedule_jobtypes | jobtypes | TEXT → JSONB |
| schedule_criterias | criterias | TEXT → JSONB |

기존 값은 `::text::jsonb`로 변환하며, NULL·빈 문자열은 NULL로 둡니다. 이미 JSONB인 경우도 같은 스크립트로 다시 실행해도 됩니다.
