-- schedule_executions: 1회성(날짜 선택) 등록 지원
-- 일정 마스터(반복)는 criteria/criteria_content 사용, 일정 관리(1회성)는 기준·기준내용 제외
-- work_plan_id NULL 허용 + sortation_id, jobtype_id, work_content 직접 저장
-- 적용 전 DB 백업 권장

BEGIN;

-- 1) work_plan_id NULL 허용
ALTER TABLE schedule_executions
  ALTER COLUMN work_plan_id DROP NOT NULL;

-- 2) 1회성 등록용 컬럼 추가
ALTER TABLE schedule_executions
  ADD COLUMN IF NOT EXISTS sortation_id INTEGER REFERENCES schedule_sortation_definitions(id) ON DELETE SET NULL;

ALTER TABLE schedule_executions
  ADD COLUMN IF NOT EXISTS jobtype_id INTEGER REFERENCES schedule_jobtype_definitions(id) ON DELETE SET NULL;

ALTER TABLE schedule_executions
  ADD COLUMN IF NOT EXISTS work_content TEXT;

COMMENT ON COLUMN schedule_executions.sortation_id IS '1회성 등록 시 구분 (schedule_sortation_definitions.id). work_plan_id NULL일 때 사용';
COMMENT ON COLUMN schedule_executions.jobtype_id IS '1회성 등록 시 작업유형 (schedule_jobtype_definitions.id). work_plan_id NULL일 때 사용';
COMMENT ON COLUMN schedule_executions.work_content IS '1회성 등록 시 작업내용. work_plan_id NULL일 때 사용';

-- 3) 제약: work_plan_id NULL이면 sortation_id, jobtype_id, work_content 중 하나 이상 필수
-- (선택) CHECK 제약 추가 시 기존 work_plan_id NOT NULL 데이터는 영향 없음
-- ALTER TABLE schedule_executions
--   ADD CONSTRAINT chk_executions_oneoff_or_plan CHECK (
--     work_plan_id IS NOT NULL
--     OR (sortation_id IS NOT NULL OR jobtype_id IS NOT NULL OR (work_content IS NOT NULL AND work_content <> ''))
--   );

COMMIT;
