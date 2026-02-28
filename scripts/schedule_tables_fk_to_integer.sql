-- 구분/기준/작업유형 테이블의 FK 컬럼을 INTEGER로 통일
-- 규칙: ID·FK 컬럼은 DB는 INTEGER, 앱은 숫자 타입으로만 사용

-- 1) 구분: structure_template_id → INTEGER (TEXT면 변환)
DO $$
DECLARE
  ct text;
BEGIN
  SELECT data_type INTO ct FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'schedule_sortations' AND column_name = 'structure_template_id';
  IF ct IS NOT NULL AND ct <> 'integer' THEN
    EXECUTE 'ALTER TABLE schedule_sortations ALTER COLUMN structure_template_id TYPE INTEGER USING structure_template_id::integer';
    RAISE NOTICE 'schedule_sortations.structure_template_id → INTEGER';
  END IF;
END $$;

-- 2) 기준: schedule_sortations_id → INTEGER (TEXT면 변환)
DO $$
DECLARE
  ct text;
BEGIN
  SELECT data_type INTO ct FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'schedule_criterias' AND column_name = 'schedule_sortations_id';
  IF ct IS NOT NULL AND ct <> 'integer' THEN
    EXECUTE 'ALTER TABLE schedule_criterias ALTER COLUMN schedule_sortations_id TYPE INTEGER USING schedule_sortations_id::integer';
    RAISE NOTICE 'schedule_criterias.schedule_sortations_id → INTEGER';
  END IF;
END $$;

-- 3) 작업유형: schedule_criterias_id → INTEGER (TEXT면 변환)
DO $$
DECLARE
  ct text;
BEGIN
  SELECT data_type INTO ct FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'schedule_jobtypes' AND column_name = 'schedule_criterias_id';
  IF ct IS NOT NULL AND ct <> 'integer' THEN
    EXECUTE 'ALTER TABLE schedule_jobtypes ALTER COLUMN schedule_criterias_id TYPE INTEGER USING schedule_criterias_id::integer';
    RAISE NOTICE 'schedule_jobtypes.schedule_criterias_id → INTEGER';
  END IF;
END $$;
