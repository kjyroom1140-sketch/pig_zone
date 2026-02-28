-- schedule_work_plans 테이블에 표시 순서(sort_order) 컬럼 추가
ALTER TABLE schedule_work_plans
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

COMMENT ON COLUMN schedule_work_plans.sort_order IS '목록 표시 순서. 작을수록 위에 표시';

-- 기존 행에 id 기준 순서 부여 (선택)
-- UPDATE schedule_work_plans SET sort_order = id WHERE sort_order IS NULL;
