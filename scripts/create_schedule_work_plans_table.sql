-- 전역 기초 일정 자료용 테이블 (농장에 적용할 마스터 데이터)
-- 기초 일정 관리 페이지에서 조회/관리하며, 나중에 농장별 farm_schedule_work_plans 등에 적용

CREATE TABLE IF NOT EXISTS schedule_work_plans (
  id SERIAL PRIMARY KEY,
  structure_templates JSONB,
  schedule_sortations JSONB,
  schedule_criterias JSONB,
  schedule_jobtypes JSONB,
  details JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE schedule_work_plans IS '기초 일정(전역 마스터). 농장별 적용 전 기준 자료.';
COMMENT ON COLUMN schedule_work_plans.structure_templates IS '대상장소(structure_templates) 참조 JSON';
COMMENT ON COLUMN schedule_work_plans.schedule_sortations IS '구분(schedule_sortations) 참조 JSON';
COMMENT ON COLUMN schedule_work_plans.schedule_criterias IS '기준(schedule_criterias) 참조 JSON, dayMin/dayMax 등';
COMMENT ON COLUMN schedule_work_plans.schedule_jobtypes IS '작업유형(schedule_jobtypes) 참조 JSON';
COMMENT ON COLUMN schedule_work_plans.details IS '반복 등 상세(recurrenceType 등) JSON';
