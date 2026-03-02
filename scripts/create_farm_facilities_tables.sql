-- 농장 시설 트리: 건물(동) → 돈사 → 방 → 칸
-- GET/POST/PUT/DELETE /api/farm-facilities/:farmId/* 에서 사용

-- 건물(동)
CREATE TABLE IF NOT EXISTS farm_buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "farmId" UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL DEFAULT '',
  code VARCHAR(50),
  "orderIndex" INTEGER,
  description TEXT,
  "totalFloors" INTEGER DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_farm_buildings_farm_id ON farm_buildings ("farmId");

-- 돈사 (barnType = structure_templates.id 문자열로 저장 가능)
CREATE TABLE IF NOT EXISTS farm_barns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "buildingId" UUID NOT NULL REFERENCES farm_buildings(id) ON DELETE CASCADE,
  name VARCHAR(200),
  "barnType" VARCHAR(100),
  "floorNumber" INTEGER DEFAULT 1,
  "orderIndex" INTEGER,
  description TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_farm_barns_building_id ON farm_barns ("buildingId");

-- 방
CREATE TABLE IF NOT EXISTS farm_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "barnId" UUID NOT NULL REFERENCES farm_barns(id) ON DELETE CASCADE,
  name VARCHAR(200),
  "roomNumber" INTEGER,
  "housingMode" VARCHAR(20) NOT NULL DEFAULT 'group',
  "sectionCount" INTEGER,
  area DOUBLE PRECISION,
  "totalCapacity" INTEGER,
  "orderIndex" INTEGER,
  CONSTRAINT chk_farm_rooms_housing_mode CHECK ("housingMode" IN ('stall', 'group')),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_farm_rooms_barn_id ON farm_rooms ("barnId");

-- 칸
CREATE TABLE IF NOT EXISTS farm_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "roomId" UUID NOT NULL REFERENCES farm_rooms(id) ON DELETE CASCADE,
  name VARCHAR(200),
  "sectionNumber" INTEGER,
  "currentPigCount" INTEGER,
  "averageWeight" DOUBLE PRECISION,
  "entryDate" DATE,
  "birthDate" DATE,
  "breedType" VARCHAR(100),
  area DOUBLE PRECISION,
  capacity INTEGER,
  "orderIndex" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_farm_sections_room_id ON farm_sections ("roomId");
