-- 구분 → 작업유형 → 기준 계층 변경 (저장 데이터 전부 제거 후 스키마만 변경)
-- 실행 전 백업 권장.

-- 1) 데이터 제거 (자식 → 부모)
TRUNCATE schedule_criterias RESTART IDENTITY CASCADE;
TRUNCATE schedule_jobtypes RESTART IDENTITY CASCADE;
TRUNCATE schedule_sortations RESTART IDENTITY CASCADE;

-- 2) schedule_jobtypes: 기준 FK 제거, 구분 FK 추가
ALTER TABLE schedule_jobtypes DROP COLUMN IF EXISTS schedule_criterias_id;
ALTER TABLE schedule_jobtypes ADD COLUMN IF NOT EXISTS sortation_id INTEGER REFERENCES schedule_sortations(id) ON DELETE SET NULL;
COMMENT ON COLUMN schedule_jobtypes.sortation_id IS '구분 FK → schedule_sortations.id';

-- 3) schedule_criterias: 구분 FK 제거, 작업유형 FK 추가
ALTER TABLE schedule_criterias DROP COLUMN IF EXISTS schedule_sortations_id;
ALTER TABLE schedule_criterias ADD COLUMN IF NOT EXISTS jobtype_id INTEGER REFERENCES schedule_jobtypes(id) ON DELETE SET NULL;
COMMENT ON COLUMN schedule_criterias.jobtype_id IS '작업유형 FK → schedule_jobtypes.id';
