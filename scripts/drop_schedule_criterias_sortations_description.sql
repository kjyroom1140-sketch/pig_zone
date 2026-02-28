-- schedule_criterias 테이블에서 sortations, description 컬럼 제거
-- 컬럼이 NOT NULL이면 먼저 nullable로 변경 후 제거 (에러 방지)

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_criterias' AND column_name = 'sortations') THEN
    ALTER TABLE schedule_criterias ALTER COLUMN sortations DROP NOT NULL;
    ALTER TABLE schedule_criterias DROP COLUMN sortations;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_criterias' AND column_name = 'description') THEN
    ALTER TABLE schedule_criterias ALTER COLUMN description DROP NOT NULL;
    ALTER TABLE schedule_criterias DROP COLUMN description;
  END IF;
END $$;
