-- Admin(전역) 일정관리 마스터 테이블/컬럼을 "현재 코드 기준"으로 맞추는 보정 스크립트
-- 목표:
-- - schedule_sortations / schedule_jobtypes 테이블이 없으면 생성
-- - schedule_sortations.sortations / schedule_jobtypes.jobtypes / schedule_criterias.criterias 를 JSONB로 정규화
-- - sort_order 컬럼이 없으면 추가
-- - 계층(구분 → 작업유형 → 기준)용 FK 컬럼이 없으면 추가
-- - schedule_work_plans 의 새 구조 컬럼(선택값 + criteria_content/work_content/sort_order) 없으면 추가
--
-- 실행: node scripts/run_sql.js scripts/ensure_admin_schedule_masters_tables.sql

-- 1) schedule_sortations (시설별 구분 목록)
CREATE TABLE IF NOT EXISTS schedule_sortations (
  id SERIAL PRIMARY KEY,
  structure_template_id INTEGER REFERENCES structure_templates(id) ON DELETE SET NULL,
  sortations JSONB,
  sort_order INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) schedule_jobtypes (구분별 작업유형 목록)
CREATE TABLE IF NOT EXISTS schedule_jobtypes (
  id SERIAL PRIMARY KEY,
  sortation_id INTEGER REFERENCES schedule_sortations(id) ON DELETE SET NULL,
  jobtypes JSONB,
  sort_order INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) schedule_sortations / schedule_jobtypes / schedule_criterias 컬럼 보정
ALTER TABLE schedule_sortations
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE schedule_jobtypes
  ADD COLUMN IF NOT EXISTS sortation_id INTEGER REFERENCES schedule_sortations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE schedule_criterias
  ADD COLUMN IF NOT EXISTS jobtype_id INTEGER REFERENCES schedule_jobtypes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- JSON → JSONB 변환(컬럼 타입이 TEXT일 때만 안전하게 변환)
DO $$
DECLARE ct text;
BEGIN
  SELECT data_type INTO ct FROM information_schema.columns WHERE table_schema='public' AND table_name='schedule_sortations' AND column_name='sortations';
  IF ct IS NOT NULL AND ct <> 'jsonb' THEN
    EXECUTE 'ALTER TABLE schedule_sortations ALTER COLUMN sortations TYPE JSONB USING (CASE WHEN sortations IS NULL THEN NULL WHEN trim(sortations::text) = '''' THEN NULL ELSE sortations::text::jsonb END)';
  END IF;

  SELECT data_type INTO ct FROM information_schema.columns WHERE table_schema='public' AND table_name='schedule_jobtypes' AND column_name='jobtypes';
  IF ct IS NOT NULL AND ct <> 'jsonb' THEN
    EXECUTE 'ALTER TABLE schedule_jobtypes ALTER COLUMN jobtypes TYPE JSONB USING (CASE WHEN jobtypes IS NULL THEN NULL WHEN trim(jobtypes::text) = '''' THEN NULL ELSE jobtypes::text::jsonb END)';
  END IF;

  SELECT data_type INTO ct FROM information_schema.columns WHERE table_schema='public' AND table_name='schedule_criterias' AND column_name='criterias';
  IF ct IS NOT NULL AND ct <> 'jsonb' THEN
    EXECUTE 'ALTER TABLE schedule_criterias ALTER COLUMN criterias TYPE JSONB USING (CASE WHEN criterias IS NULL THEN NULL WHEN trim(criterias::text) = '''' THEN NULL ELSE criterias::text::jsonb END)';
  END IF;
END $$;

-- 4) schedule_work_plans 새 구조 컬럼 보정
CREATE TABLE IF NOT EXISTS schedule_work_plans (
  id SERIAL PRIMARY KEY,
  structure_template_id INTEGER REFERENCES structure_templates(id) ON DELETE SET NULL,
  sortation_id INTEGER REFERENCES schedule_sortation_definitions(id) ON DELETE SET NULL,
  jobtype_id INTEGER REFERENCES schedule_jobtype_definitions(id) ON DELETE SET NULL,
  criteria_id INTEGER REFERENCES schedule_criteria_definitions(id) ON DELETE SET NULL,
  criteria_content JSONB,
  work_content TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE schedule_work_plans
  ADD COLUMN IF NOT EXISTS structure_template_id INTEGER REFERENCES structure_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sortation_id INTEGER,
  ADD COLUMN IF NOT EXISTS jobtype_id INTEGER,
  ADD COLUMN IF NOT EXISTS criteria_id INTEGER,
  ADD COLUMN IF NOT EXISTS criteria_content JSONB,
  ADD COLUMN IF NOT EXISTS work_content TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- FK를 "정의(definitions) 테이블"로 맞춤 (이미 다른 FK가 있으면 교체)
ALTER TABLE schedule_work_plans DROP CONSTRAINT IF EXISTS schedule_work_plans_sortation_id_fkey;
ALTER TABLE schedule_work_plans DROP CONSTRAINT IF EXISTS schedule_work_plans_jobtype_id_fkey;
ALTER TABLE schedule_work_plans DROP CONSTRAINT IF EXISTS schedule_work_plans_criteria_id_fkey;

ALTER TABLE schedule_work_plans
  ADD CONSTRAINT schedule_work_plans_sortation_id_fkey FOREIGN KEY (sortation_id) REFERENCES schedule_sortation_definitions(id) ON DELETE SET NULL;
ALTER TABLE schedule_work_plans
  ADD CONSTRAINT schedule_work_plans_jobtype_id_fkey FOREIGN KEY (jobtype_id) REFERENCES schedule_jobtype_definitions(id) ON DELETE SET NULL;
ALTER TABLE schedule_work_plans
  ADD CONSTRAINT schedule_work_plans_criteria_id_fkey FOREIGN KEY (criteria_id) REFERENCES schedule_criteria_definitions(id) ON DELETE SET NULL;

