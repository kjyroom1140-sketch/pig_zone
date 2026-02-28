-- schedule_work_plans 테이블 구조 변경
-- 사육시설·구분·작업유형·기준 선택값을 각 컬럼에, 기준내용을 criteria_content(JSONB)에 저장
-- 실행 전 기존 데이터 마이그레이션 필요 시 별도 스크립트로 처리 권장

-- 1) 선택값 FK 컬럼 추가
ALTER TABLE schedule_work_plans
  ADD COLUMN IF NOT EXISTS structure_template_id INTEGER REFERENCES structure_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sortation_id INTEGER REFERENCES schedule_sortations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS jobtype_id INTEGER REFERENCES schedule_jobtypes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS criteria_id INTEGER REFERENCES schedule_criterias(id) ON DELETE SET NULL;

COMMENT ON COLUMN schedule_work_plans.structure_template_id IS '사육시설 선택값 → structure_templates.id';
COMMENT ON COLUMN schedule_work_plans.sortation_id IS '구분 선택값 → schedule_sortations.id';
COMMENT ON COLUMN schedule_work_plans.jobtype_id IS '작업유형 선택값 → schedule_jobtypes.id';
COMMENT ON COLUMN schedule_work_plans.criteria_id IS '기준 선택값 → schedule_criterias.id';

-- 2) 기준내용(시작~종료일 / 매일 / 주말 / 월 / 년) JSONB
ALTER TABLE schedule_work_plans
  ADD COLUMN IF NOT EXISTS criteria_content JSONB;

COMMENT ON COLUMN schedule_work_plans.criteria_content IS '기준내용. type: range|daily|weekly|weekend|monthly|yearly, type별 start_date/end_date 등';

-- 3) 기존 JSON 컬럼 제거 (선택 사항 — 신규 구조만 쓸 때 실행)
-- ALTER TABLE schedule_work_plans DROP COLUMN IF EXISTS structure_templates;
-- ALTER TABLE schedule_work_plans DROP COLUMN IF EXISTS schedule_sortations;
-- ALTER TABLE schedule_work_plans DROP COLUMN IF EXISTS schedule_criterias;
-- ALTER TABLE schedule_work_plans DROP COLUMN IF EXISTS schedule_jobtypes;
-- ALTER TABLE schedule_work_plans DROP COLUMN IF EXISTS details;
