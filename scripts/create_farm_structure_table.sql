-- 농장별 사육시설(운영 시설) 선택 저장. GET/POST /api/farm-structure/:farmId/production 에서 사용
-- structure_templates (category=production) 중 선택한 템플릿을 이 테이블에 저장

CREATE TABLE IF NOT EXISTS farm_structure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "farmId" UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  "templateId" INTEGER NOT NULL REFERENCES structure_templates(id) ON DELETE CASCADE,
  category VARCHAR(32) NOT NULL DEFAULT 'production',
  name VARCHAR(200),
  weight VARCHAR(100),
  "optimalDensity" DOUBLE PRECISION,
  description TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("farmId", "templateId", category)
);

CREATE INDEX IF NOT EXISTS idx_farm_structure_farm_id ON farm_structure ("farmId");
CREATE INDEX IF NOT EXISTS idx_farm_structure_category ON farm_structure (category);

COMMENT ON TABLE farm_structure IS '농장별 선택한 사육시설(production) 템플릿. structure_templates.id 참조';
COMMENT ON COLUMN farm_structure."farmId" IS '농장 UUID';
COMMENT ON COLUMN farm_structure."templateId" IS 'structure_templates.id (category=production)';
