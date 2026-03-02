-- 전역 schedule_* 테이블을 공통/농장 공용으로 통합
-- 정책:
-- - farmId IS NULL   : 전역(시스템 공통) 데이터
-- - farmId = UUID    : 특정 농장 데이터
-- - is_deleted=true  : 화면상 삭제(소프트 삭제)
--
-- 실행: node scripts/run_sql.js scripts/unify_schedule_tables_with_farm_scope.sql

-- 1) 대상 테이블에 farmId/is_deleted 컬럼 추가
ALTER TABLE schedule_sortation_definitions
  ADD COLUMN IF NOT EXISTS "farmId" UUID REFERENCES farms(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE schedule_jobtype_definitions
  ADD COLUMN IF NOT EXISTS "farmId" UUID REFERENCES farms(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE schedule_criteria_definitions
  ADD COLUMN IF NOT EXISTS "farmId" UUID REFERENCES farms(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE schedule_sortations
  ADD COLUMN IF NOT EXISTS "farmId" UUID REFERENCES farms(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE schedule_jobtypes
  ADD COLUMN IF NOT EXISTS "farmId" UUID REFERENCES farms(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE schedule_criterias
  ADD COLUMN IF NOT EXISTS "farmId" UUID REFERENCES farms(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE schedule_work_plans
  ADD COLUMN IF NOT EXISTS "farmId" UUID REFERENCES farms(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

-- 2) 조회 성능용 인덱스
CREATE INDEX IF NOT EXISTS idx_schedule_sortation_definitions_farm_scope ON schedule_sortation_definitions ("farmId", is_deleted, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_schedule_jobtype_definitions_farm_scope ON schedule_jobtype_definitions ("farmId", is_deleted, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_schedule_criteria_definitions_farm_scope ON schedule_criteria_definitions ("farmId", is_deleted, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_schedule_sortations_farm_scope ON schedule_sortations ("farmId", is_deleted, structure_template_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_schedule_jobtypes_farm_scope ON schedule_jobtypes ("farmId", is_deleted, sortation_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_schedule_criterias_farm_scope ON schedule_criterias ("farmId", is_deleted, jobtype_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_schedule_work_plans_farm_scope ON schedule_work_plans ("farmId", is_deleted, structure_template_id, sort_order, id);

-- 3) (선택) 기존 f_schedule_* 데이터를 schedule_*로 이관
-- - 전역 행은 유지되고, farmId가 있는 행만 추가됩니다.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='f_schedule_sortation_definitions') THEN
    INSERT INTO schedule_sortation_definitions ("farmId", name, sort_order, is_deleted, "createdAt", "updatedAt")
    SELECT "formId", name, sort_order, false, "createdAt", "updatedAt"
    FROM f_schedule_sortation_definitions fs
    WHERE NOT EXISTS (
      SELECT 1 FROM schedule_sortation_definitions sd
      WHERE sd."farmId" = fs."formId" AND sd.name = fs.name
    );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='f_schedule_jobtype_definitions') THEN
    INSERT INTO schedule_jobtype_definitions ("farmId", name, sort_order, is_deleted, "createdAt", "updatedAt")
    SELECT "formId", name, sort_order, false, "createdAt", "updatedAt"
    FROM f_schedule_jobtype_definitions fs
    WHERE NOT EXISTS (
      SELECT 1 FROM schedule_jobtype_definitions sd
      WHERE sd."farmId" = fs."formId" AND sd.name = fs.name
    );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='f_schedule_criteria_definitions') THEN
    INSERT INTO schedule_criteria_definitions ("farmId", name, content_type, sort_order, is_deleted, "createdAt", "updatedAt")
    SELECT "formId", name, content_type, sort_order, false, "createdAt", "updatedAt"
    FROM f_schedule_criteria_definitions fs
    WHERE NOT EXISTS (
      SELECT 1 FROM schedule_criteria_definitions sd
      WHERE sd."farmId" = fs."formId" AND sd.name = fs.name
    );
  END IF;
END $$;

