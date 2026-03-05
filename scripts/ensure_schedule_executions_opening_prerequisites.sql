-- opening -> schedule_executions 표시를 위한 선행 스키마 보정
-- 적용 전 DB 백업 권장

BEGIN;

-- 1) opening 날짜 저장 보정
ALTER TABLE pig_groups
  ADD COLUMN IF NOT EXISTS birth_date DATE NULL;

ALTER TABLE farm_sections
  ADD COLUMN IF NOT EXISTS "entryDate" DATE;

ALTER TABLE farm_sections
  ADD COLUMN IF NOT EXISTS "birthDate" DATE;

-- 2) schedule_executions 핵심 테이블
CREATE TABLE IF NOT EXISTS schedule_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  work_plan_id INTEGER NOT NULL REFERENCES schedule_work_plans(id) ON DELETE RESTRICT,
  section_id UUID NULL REFERENCES farm_sections(id) ON DELETE SET NULL,
  execution_type VARCHAR(20) NOT NULL CHECK (execution_type IN ('birth', 'move', 'inspection')),
  scheduled_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped', 'cancelled')),
  completed_at TIMESTAMPTZ NULL,
  completed_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  result_ref_type VARCHAR(30) NULL,
  result_ref_id UUID NULL,
  idempotency_key VARCHAR(80) NULL,
  memo TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (result_ref_type IS NULL AND result_ref_id IS NULL)
    OR (result_ref_type IS NOT NULL AND result_ref_id IS NOT NULL)
  ),
  CHECK (
    status <> 'completed'
    OR (completed_at IS NOT NULL AND completed_by IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_schedule_executions_idempotency
  ON schedule_executions (farm_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_executions_farm_date_status
  ON schedule_executions (farm_id, scheduled_date, status);

CREATE INDEX IF NOT EXISTS idx_schedule_executions_farm_section_date
  ON schedule_executions (farm_id, section_id, scheduled_date);

-- 3) opening 자동 work plan 명칭 통일
UPDATE schedule_work_plans
SET work_content = '재고두수등록(초기값)',
    "updatedAt" = NOW()
WHERE work_content = '[AUTO] opening 초기값 저장'
  AND COALESCE(is_deleted, false) = false;

COMMIT;
