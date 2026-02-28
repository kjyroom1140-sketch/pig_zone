-- 기준(schedule_criterias) 테이블 — 구분(schedule_sortations)별 기준 목록
-- schedule_sortations_id: 선택한 구분(schedule_sortations.id), criterias: 기준 이름 등 JSON

CREATE TABLE IF NOT EXISTS schedule_criterias (
  id SERIAL PRIMARY KEY,
  schedule_sortations_id INTEGER REFERENCES schedule_sortations(id) ON DELETE SET NULL,
  criterias TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE schedule_criterias IS '기준. 구분(schedule_sortations)별 기준 목록.';
COMMENT ON COLUMN schedule_criterias.schedule_sortations_id IS '구분 FK → schedule_sortations.id';
COMMENT ON COLUMN schedule_criterias.criterias IS '기준 데이터 JSON (예: [{"name":"기준이름"}])';
