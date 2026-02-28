-- schedule_criterias: sortations, description 컬럼을 nullable로 변경
-- (기준 추가 시 500 나면, 이 스크립트 실행 후 다시 시도)

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedule_criterias' AND column_name = 'sortations') THEN
    ALTER TABLE schedule_criterias ALTER COLUMN sortations DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedule_criterias' AND column_name = 'description') THEN
    ALTER TABLE schedule_criterias ALTER COLUMN description DROP NOT NULL;
  END IF;
END $$;
