-- schedule_executions + opening 연계 상태 점검 쿼리

-- 1) 테이블/인덱스 존재
SELECT to_regclass('public.schedule_executions') AS schedule_executions_table;
SELECT to_regclass('public.uq_schedule_executions_idempotency') AS uq_schedule_executions_idempotency;
SELECT to_regclass('public.idx_schedule_executions_farm_date_status') AS idx_schedule_executions_farm_date_status;
SELECT to_regclass('public.idx_schedule_executions_farm_section_date') AS idx_schedule_executions_farm_section_date;

-- 2) opening 관련 보조 컬럼 존재
SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_name = 'pig_groups'
    AND column_name = 'birth_date'
) AS pig_groups_birth_date_exists;

SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_name = 'farm_sections'
    AND column_name = 'entryDate'
) AS farm_sections_entry_date_exists;

SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_name = 'farm_sections'
    AND column_name = 'birthDate'
) AS farm_sections_birth_date_exists;

-- 3) 자동 work plan 명칭 확인
SELECT
  "farmId" AS farm_id,
  id AS work_plan_id,
  work_content,
  sort_order,
  "updatedAt"
FROM schedule_work_plans
WHERE COALESCE(is_deleted, false) = false
  AND work_content IN ('재고두수등록(초기값)', '[AUTO] opening 초기값 저장')
ORDER BY "farmId", id;

-- 4) opening_section 완료 실행건 확인
SELECT
  farm_id,
  section_id,
  scheduled_date,
  status,
  result_ref_type,
  result_ref_id,
  idempotency_key,
  memo,
  completed_at
FROM schedule_executions
WHERE result_ref_type = 'opening_section'
ORDER BY scheduled_date DESC, created_at DESC
LIMIT 200;
