-- 작업유형 정의 마스터 테이블 (작업유형 목록 선택 시 사용)
-- 구분별 작업유형 목록에 이 테이블에서 항목을 선택해 추가

CREATE TABLE IF NOT EXISTS schedule_jobtype_definitions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE schedule_jobtype_definitions IS '작업유형 정의 마스터. 작업유형 목록 선택 시 이 테이블에서 항목을 선택해 목록에 추가.';
COMMENT ON COLUMN schedule_jobtype_definitions.name IS '표시 이름';
COMMENT ON COLUMN schedule_jobtype_definitions.sort_order IS '정렬 순서 (작을수록 앞)';

-- 시드: 기본 항목 (테이블이 비어 있을 때만)
INSERT INTO schedule_jobtype_definitions (name, sort_order, "createdAt", "updatedAt")
SELECT * FROM (VALUES
  ('일상점검'::varchar, 1, now(), now()),
  ('투입'::varchar, 2, now(), now()),
  ('이동'::varchar, 3, now(), now())
) AS v(name, sort_order, "createdAt", "updatedAt")
WHERE NOT EXISTS (SELECT 1 FROM schedule_jobtype_definitions LIMIT 1);
