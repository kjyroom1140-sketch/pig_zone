-- schedule_work_plans 테이블에 작업내용(work_content) 컬럼 추가
-- 컬럼 존재 여부 확인: SELECT column_name FROM information_schema.columns WHERE table_name = 'schedule_work_plans' AND column_name = 'work_content';
ALTER TABLE schedule_work_plans
  ADD COLUMN IF NOT EXISTS work_content TEXT;

COMMENT ON COLUMN schedule_work_plans.work_content IS '작업내용. 기준내용 유형 아래에서 입력한 텍스트';
