-- schedule_work_plans: 작업유형이 "이동"일 때 이동 대상 시설 저장
-- 일정 마스터에서 "이동 대상 사육시설" 선택 시 사용 (target_structure_template_id)

ALTER TABLE schedule_work_plans
  ADD COLUMN IF NOT EXISTS target_structure_template_id INTEGER REFERENCES structure_templates(id) ON DELETE SET NULL;

COMMENT ON COLUMN schedule_work_plans.target_structure_template_id IS '이동 작업일 때만 사용. 이동 대상 시설 → structure_templates.id';
