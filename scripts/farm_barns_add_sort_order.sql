-- farm_barns: 사육시설 순서 저장용 sort_order 컬럼 추가
-- FarmFacilitiesTree / FarmBarnsReorder 에서 사용. 적용 전 DB 백업 권장.

BEGIN;

ALTER TABLE farm_barns
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- 기존 행은 NULL 허용, 정렬 시 999999로 취급되므로 기존 orderIndex 유지
COMMENT ON COLUMN farm_barns.sort_order IS '건물 내 사육시설 표시 순서. 작을수록 앞';

COMMIT;
