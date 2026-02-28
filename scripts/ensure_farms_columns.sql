-- farms 테이블에 API에서 사용하는 모든 컬럼이 있도록 추가 (없으면 추가, 있으면 무시)
-- 실행: psql -U <user> -d <dbname> -f scripts/ensure_farms_columns.sql

-- 기본 컬럼 (테이블이 최소 구조만 있을 때)
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT now();

-- 농장 정보 확장 (대표자, 연락처, 사업자번호, 주소 등)
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "ownerName" TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "businessNumber" TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "farmType" TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "postalCode" TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "addressDetail" TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "contactName" TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "officePhone" TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "faxNumber" TEXT;
