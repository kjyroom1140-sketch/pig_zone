ALTER TABLE farm_sections
  ADD COLUMN IF NOT EXISTS "entryDate" DATE;

ALTER TABLE farm_sections
  ADD COLUMN IF NOT EXISTS "birthDate" DATE;
