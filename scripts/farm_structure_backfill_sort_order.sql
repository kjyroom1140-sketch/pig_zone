-- 기존 farm_structure production 행에 sort_order가 동일한 값(예: 0)으로 들어가 있는 경우
-- 농장별·현재 id 순서대로 0, 1, 2, ... 새로 부여 (한 번만 실행하면 됨)

BEGIN;

UPDATE farm_structure fs
SET sort_order = sub.ord
FROM (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY "farmId" ORDER BY id)) - 1 AS ord
  FROM farm_structure
  WHERE category::text = 'production'
) sub
WHERE fs.id = sub.id AND fs.category::text = 'production';

COMMIT;
