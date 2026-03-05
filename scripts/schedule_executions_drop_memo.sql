-- schedule_executions: memo 컬럼 제거
-- 적용 전 DB 백업 권장

BEGIN;

ALTER TABLE schedule_executions
  DROP COLUMN IF EXISTS memo;

COMMIT;
