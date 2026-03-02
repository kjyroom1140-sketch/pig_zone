-- 성오농장 시설명/방명/칸명 정규화
-- 주의: 구조 삭제/병합 없이 표시 이름만 정리

BEGIN;

-- 1) 사육시설(Barn 기본값) 이름을 템플릿명으로 보정
UPDATE farm_barns ba
SET
  name = (
    SELECT st.name
    FROM structure_templates st
    WHERE st.id = NULLIF(ba."barnType", '')::int
    LIMIT 1
  ),
  "updatedAt" = NOW()
FROM farm_buildings b
WHERE ba."buildingId" = b.id
  AND b."farmId" = (
    SELECT id FROM farms WHERE "farmName" = '성오농장' LIMIT 1
  )
  AND (
    ba.name IS NULL
    OR BTRIM(ba.name) = ''
    OR LOWER(BTRIM(ba.name)) = 'barn'
  )
  AND ba."barnType" ~ '^[0-9]+$'
  AND EXISTS (
    SELECT 1
    FROM structure_templates st
    WHERE st.id = NULLIF(ba."barnType", '')::int
  );

-- 2) 일반시설인데 이름이 Barn/공백인 경우 일반시설로 보정
UPDATE farm_barns ba
SET
  name = '일반시설',
  "updatedAt" = NOW()
FROM farm_buildings b
WHERE ba."buildingId" = b.id
  AND b."farmId" = (
    SELECT id FROM farms WHERE "farmName" = '성오농장' LIMIT 1
  )
  AND (
    ba.name IS NULL
    OR BTRIM(ba.name) = ''
    OR LOWER(BTRIM(ba.name)) = 'barn'
  )
  AND (
    ba."barnType" IS NULL
    OR ba."barnType" = ''
    OR ba."barnType" !~ '^[0-9]+$'
  );

-- 3) 방 이름 정규화: roomNumber 있으면 N번방으로 통일
UPDATE farm_rooms r
SET
  name = CONCAT(r."roomNumber", '번방'),
  "updatedAt" = NOW()
FROM farm_barns ba
JOIN farm_buildings b
  ON b.id = ba."buildingId"
WHERE r."barnId" = ba.id
  AND b."farmId" = (
    SELECT id FROM farms WHERE "farmName" = '성오농장' LIMIT 1
  )
  AND r."roomNumber" IS NOT NULL
  AND (
    r.name IS NULL
    OR BTRIM(r.name) = ''
    OR r.name !~ '^[0-9]+번방$'
    OR r.name LIKE '%踰%'
  );

-- 4) 칸 이름 정규화: sectionNumber 있으면 N번칸으로 통일
UPDATE farm_sections s
SET
  name = CONCAT(s."sectionNumber", '번칸'),
  "updatedAt" = NOW()
FROM farm_rooms r
JOIN farm_barns ba
  ON ba.id = r."barnId"
JOIN farm_buildings b
  ON b.id = ba."buildingId"
WHERE s."roomId" = r.id
  AND b."farmId" = (
    SELECT id FROM farms WHERE "farmName" = '성오농장' LIMIT 1
  )
  AND s."sectionNumber" IS NOT NULL
  AND (
    s.name IS NULL
    OR BTRIM(s.name) = ''
    OR s.name !~ '^[0-9]+번칸$'
    OR s.name LIKE '%踰%'
  );

COMMIT;

