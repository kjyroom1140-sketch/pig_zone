-- schedule_work_plans 의 sortation_id, jobtype_id, criteria_id 를
-- 목록 테이블 id 가 아닌 정의(definitions) 테이블 id 로 저장하도록 변경

-- 1) 기존 데이터 마이그레이션: 목록 행 id → 정의 id 로 변환 (변환 불가 시 NULL)
UPDATE schedule_work_plans swp
SET sortation_id = (SELECT (ss.sortations::jsonb->0->>'sortation_definition_id')::int FROM schedule_sortations ss WHERE ss.id = swp.sortation_id AND ss.sortations::jsonb->0->>'sortation_definition_id' IS NOT NULL AND ss.sortations::jsonb->0->>'sortation_definition_id' <> '')
WHERE swp.sortation_id IS NOT NULL;

UPDATE schedule_work_plans swp
SET jobtype_id = (SELECT (sj.jobtypes::jsonb->0->>'jobtype_definition_id')::int FROM schedule_jobtypes sj WHERE sj.id = swp.jobtype_id AND sj.jobtypes::jsonb->0->>'jobtype_definition_id' IS NOT NULL AND sj.jobtypes::jsonb->0->>'jobtype_definition_id' <> '')
WHERE swp.jobtype_id IS NOT NULL;

UPDATE schedule_work_plans swp
SET criteria_id = (SELECT (sc.criterias::jsonb->0->>'criteria_definition_id')::int FROM schedule_criterias sc WHERE sc.id = swp.criteria_id AND sc.criterias::jsonb->0->>'criteria_definition_id' IS NOT NULL AND sc.criterias::jsonb->0->>'criteria_definition_id' <> '')
WHERE swp.criteria_id IS NOT NULL;

-- 2) 기존 FK 제거 (PostgreSQL 기본 제약명)
ALTER TABLE schedule_work_plans DROP CONSTRAINT IF EXISTS schedule_work_plans_sortation_id_fkey;
ALTER TABLE schedule_work_plans DROP CONSTRAINT IF EXISTS schedule_work_plans_jobtype_id_fkey;
ALTER TABLE schedule_work_plans DROP CONSTRAINT IF EXISTS schedule_work_plans_criteria_id_fkey;

-- 3) 정의 테이블을 참조하는 FK 추가
ALTER TABLE schedule_work_plans
  ADD CONSTRAINT schedule_work_plans_sortation_id_fkey FOREIGN KEY (sortation_id) REFERENCES schedule_sortation_definitions(id) ON DELETE SET NULL,
  ADD CONSTRAINT schedule_work_plans_jobtype_id_fkey FOREIGN KEY (jobtype_id) REFERENCES schedule_jobtype_definitions(id) ON DELETE SET NULL,
  ADD CONSTRAINT schedule_work_plans_criteria_id_fkey FOREIGN KEY (criteria_id) REFERENCES schedule_criteria_definitions(id) ON DELETE SET NULL;

COMMENT ON COLUMN schedule_work_plans.sortation_id IS '구분 정의 id → schedule_sortation_definitions.id';
COMMENT ON COLUMN schedule_work_plans.jobtype_id IS '작업유형 정의 id → schedule_jobtype_definitions.id';
COMMENT ON COLUMN schedule_work_plans.criteria_id IS '기준 정의 id → schedule_criteria_definitions.id';
