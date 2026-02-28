-- schedule_sortations.sortations, schedule_jobtypes.jobtypes, schedule_criterias.criterias
-- 를 JSONB로 통일. (현재 TEXT인 경우 변환, 이미 JSONB면 유지)
-- 장기적으로 JSON 저장 컬럼은 JSONB로 통일해 스캔/쿼리 일관성 유지.

-- 1) schedule_sortations.sortations → JSONB
ALTER TABLE schedule_sortations
  ALTER COLUMN sortations TYPE JSONB
  USING (
    CASE
      WHEN sortations IS NULL THEN NULL
      WHEN trim(sortations::text) = '' THEN NULL
      ELSE sortations::text::jsonb
    END
  );

COMMENT ON COLUMN schedule_sortations.sortations IS '구분 데이터 JSON (JSONB). 예: [{"name":"구분명"}]';

-- 2) schedule_jobtypes.jobtypes → JSONB
ALTER TABLE schedule_jobtypes
  ALTER COLUMN jobtypes TYPE JSONB
  USING (
    CASE
      WHEN jobtypes IS NULL THEN NULL
      WHEN trim(jobtypes::text) = '' THEN NULL
      ELSE jobtypes::text::jsonb
    END
  );

COMMENT ON COLUMN schedule_jobtypes.jobtypes IS '작업유형 데이터 JSON (JSONB). 예: [{"name":"작업명","detail":"내용"}]';

-- 3) schedule_criterias.criterias → JSONB
ALTER TABLE schedule_criterias
  ALTER COLUMN criterias TYPE JSONB
  USING (
    CASE
      WHEN criterias IS NULL THEN NULL
      WHEN trim(criterias::text) = '' THEN NULL
      ELSE criterias::text::jsonb
    END
  );

COMMENT ON COLUMN schedule_criterias.criterias IS '기준 데이터 JSON (JSONB). 예: [{"name":"기준이름"}]';
