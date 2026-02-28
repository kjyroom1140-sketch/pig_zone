-- schedule_work_plans 테이블에서 사용하지 않는 컬럼 제거
-- 현재 API는 id, structure_template_id, sortation_id, jobtype_id, criteria_id, criteria_content, "createdAt", "updatedAt" 만 사용
-- 제거 대상: 구 구조 JSON 컬럼 (structure_templates, schedule_sortations, schedule_criterias, schedule_jobtypes, details)

ALTER TABLE schedule_work_plans
  DROP COLUMN IF EXISTS structure_templates,
  DROP COLUMN IF EXISTS schedule_sortations,
  DROP COLUMN IF EXISTS schedule_criterias,
  DROP COLUMN IF EXISTS schedule_jobtypes,
  DROP COLUMN IF EXISTS details;
