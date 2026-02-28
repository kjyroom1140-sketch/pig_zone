-- 구분(schedule_sortations), 기준(schedule_criterias)에 순서 컬럼 추가

-- 1) 구분: sort_order (표시 순서, 기본 0)
ALTER TABLE schedule_sortations
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN schedule_sortations.sort_order IS '표시 순서 (작을수록 앞)';

-- 2) 기준: sort_order (표시 순서, 기본 0)
ALTER TABLE schedule_criterias
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN schedule_criterias.sort_order IS '표시 순서 (작을수록 앞)';

-- 3) 작업유형: sort_order (표시 순서, 기본 0)
ALTER TABLE schedule_jobtypes
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN schedule_jobtypes.sort_order IS '표시 순서 (작을수록 앞)';
