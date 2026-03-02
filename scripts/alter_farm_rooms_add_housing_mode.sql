BEGIN;

ALTER TABLE farm_rooms
  ADD COLUMN IF NOT EXISTS "housingMode" VARCHAR(20);

UPDATE farm_rooms
SET "housingMode" = 'group'
WHERE "housingMode" IS NULL
   OR BTRIM("housingMode") = '';

UPDATE farm_rooms
SET "housingMode" = LOWER("housingMode");

UPDATE farm_rooms
SET "housingMode" = 'group'
WHERE "housingMode" NOT IN ('stall', 'group');

ALTER TABLE farm_rooms
  ALTER COLUMN "housingMode" SET DEFAULT 'group';

ALTER TABLE farm_rooms
  ALTER COLUMN "housingMode" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_farm_rooms_housing_mode'
  ) THEN
    ALTER TABLE farm_rooms
      ADD CONSTRAINT chk_farm_rooms_housing_mode
      CHECK ("housingMode" IN ('stall', 'group'));
  END IF;
END $$;

COMMIT;
