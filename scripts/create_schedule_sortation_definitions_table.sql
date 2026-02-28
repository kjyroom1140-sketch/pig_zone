-- 구분 정의 마스터 테이블 (구분 추가 시 선택용)
-- 구분 추가 시 이 테이블에서 항목을 선택해 시설별 구분 목록에 추가

CREATE TABLE IF NOT EXISTS schedule_sortation_definitions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE schedule_sortation_definitions IS '구분 정의 마스터. 구분 추가 시 이 테이블에서 항목을 선택해 목록에 추가.';
COMMENT ON COLUMN schedule_sortation_definitions.name IS '표시 이름 (예: 비육, 모돈, 이동)';
COMMENT ON COLUMN schedule_sortation_definitions.sort_order IS '정렬 순서 (작을수록 앞)';

-- 시드: 기본 항목 (테이블이 비어 있을 때만)
INSERT INTO schedule_sortation_definitions (name, sort_order, "createdAt", "updatedAt")
SELECT * FROM (VALUES
  ('비육'::varchar, 1, now(), now()),
  ('모돈'::varchar, 2, now(), now()),
  ('이동'::varchar, 3, now(), now())
) AS v(name, sort_order, "createdAt", "updatedAt")
WHERE NOT EXISTS (SELECT 1 FROM schedule_sortation_definitions LIMIT 1);
