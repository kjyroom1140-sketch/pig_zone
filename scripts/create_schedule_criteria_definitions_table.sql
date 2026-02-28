-- 기준 정의 마스터 테이블 (기준내용 표현 방법 정의)
-- 기준 추가 시 이 테이블에서 항목을 선택해 목록에 추가

CREATE TABLE IF NOT EXISTS schedule_criteria_definitions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  content_type VARCHAR(50) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE schedule_criteria_definitions IS '기준 정의 마스터. 기준내용 표현 방법(name, content_type) 정의.';
COMMENT ON COLUMN schedule_criteria_definitions.name IS '표시 이름 (예: 출생일(일령), 횟수, 매일)';
COMMENT ON COLUMN schedule_criteria_definitions.content_type IS '기준내용 표현 방법: range, count, daily, weekend, monthly, yearly, weekly';

-- 시드: 기본 항목 (테이블이 비어 있을 때만)
INSERT INTO schedule_criteria_definitions (name, content_type, sort_order, "createdAt", "updatedAt")
SELECT * FROM (VALUES
  ('출생일(일령)'::varchar, 'range'::varchar, 1, now(), now()),
  ('횟수', 'count', 2, now(), now()),
  ('매일', 'daily', 3, now(), now()),
  ('주말', 'weekend', 4, now(), now()),
  ('월단위', 'monthly', 5, now(), now()),
  ('년 1회', 'yearly', 6, now(), now()),
  ('N주마다 요일', 'weekly', 7, now(), now())
) AS v(name, content_type, sort_order, "createdAt", "updatedAt")
WHERE NOT EXISTS (SELECT 1 FROM schedule_criteria_definitions LIMIT 1);
