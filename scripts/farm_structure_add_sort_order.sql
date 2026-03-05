-- farm_structure: 사육시설 순서 저장용 sort_order 컬럼 추가
-- 적용 전 DB 백업 권장

BEGIN;

ALTER TABLE farm_structure
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN farm_structure.sort_order IS '농장별 사육시설 표시 순서. 0부터 시작';

COMMIT;
