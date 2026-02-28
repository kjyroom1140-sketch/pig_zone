-- structure_templates 테이블에 색상 컬럼(themeColor) 추가
-- 형식: #RRGGBB

ALTER TABLE structure_templates
  ADD COLUMN IF NOT EXISTS "themeColor" VARCHAR(7);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'structure_templates_themeColor_hex_chk'
  ) THEN
    ALTER TABLE structure_templates
      ADD CONSTRAINT structure_templates_themeColor_hex_chk
      CHECK ("themeColor" IS NULL OR "themeColor" ~ '^#[0-9A-Fa-f]{6}$');
  END IF;
END
$$;

-- 기존 데이터 초기값 채우기 (themeColor가 비어있는 경우만)
UPDATE structure_templates
SET "themeColor" = CASE
  WHEN name ILIKE '%분만%' THEN '#FB7185'
  WHEN name ILIKE '%임신%' THEN '#38BDF8'
  WHEN name ILIKE '%자돈%' THEN '#F59E0B'
  WHEN name ILIKE '%육성%' THEN '#22C55E'
  WHEN name ILIKE '%비육%' THEN '#8B5CF6'
  WHEN name ILIKE '%후보%' THEN '#EC4899'
  WHEN name ILIKE '%교배%' OR name ILIKE '%종돈%' THEN '#06B6D4'
  WHEN LOWER(category::text) = 'support' THEN '#94A3B8'
  ELSE '#38BDF8'
END
WHERE "themeColor" IS NULL OR BTRIM("themeColor") = '';

