-- 농장 우편번호, 국가, 상세주소 컬럼 추가
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "postalCode" TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "addressDetail" TEXT;
