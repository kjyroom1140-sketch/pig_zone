const { sequelize } = require('../config/database');

/**
 * users 테이블에 직원 관리용 확장 컬럼 추가 스크립트
 *
 * - birthDate, gender
 * - nationalityType, nationality, visaType, visaExpiry
 * - postalCode, address, addressDetail
 *
 * 이미 컬럼이 존재하면 넘어가도록 idempotent 하게 작성.
 */
async function addStaffFieldsToUsers() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected.\n');

        // 1) birthDate
        await sequelize.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'birthDate'
                ) THEN
                    ALTER TABLE "users"
                        ADD COLUMN "birthDate" DATE NULL;
                    COMMENT ON COLUMN "users"."birthDate" IS '생년월일';
                END IF;
            END
            $$;
        `);
        console.log('✅ users.birthDate 컬럼 확인/추가 완료');

        // 2) gender
        await sequelize.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'gender'
                ) THEN
                    ALTER TABLE "users"
                        ADD COLUMN "gender" VARCHAR(10) NULL;
                    COMMENT ON COLUMN "users"."gender" IS '성별 (male/female/other)';
                END IF;
            END
            $$;
        `);
        console.log('✅ users.gender 컬럼 확인/추가 완료');

        // 3) nationalityType
        await sequelize.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'nationalityType'
                ) THEN
                    ALTER TABLE "users"
                        ADD COLUMN "nationalityType" VARCHAR(20) NOT NULL DEFAULT 'domestic';
                    COMMENT ON COLUMN "users"."nationalityType" IS '내국인/외국인 구분 (domestic/foreign)';
                END IF;
            END
            $$;
        `);
        console.log('✅ users.nationalityType 컬럼 확인/추가 완료');

        // 4) nationality
        await sequelize.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'nationality'
                ) THEN
                    ALTER TABLE "users"
                        ADD COLUMN "nationality" VARCHAR(100) NULL;
                    COMMENT ON COLUMN "users"."nationality" IS '국적 (외국인인 경우)';
                END IF;
            END
            $$;
        `);
        console.log('✅ users.nationality 컬럼 확인/추가 완료');

        // 5) visaType
        await sequelize.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'visaType'
                ) THEN
                    ALTER TABLE "users"
                        ADD COLUMN "visaType" VARCHAR(50) NULL;
                    COMMENT ON COLUMN "users"."visaType" IS '비자 종류 (예: E-9, E-7 등)';
                END IF;
            END
            $$;
        `);
        console.log('✅ users.visaType 컬럼 확인/추가 완료');

        // 6) visaExpiry
        await sequelize.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'visaExpiry'
                ) THEN
                    ALTER TABLE "users"
                        ADD COLUMN "visaExpiry" DATE NULL;
                    COMMENT ON COLUMN "users"."visaExpiry" IS '체류기간 만료일';
                END IF;
            END
            $$;
        `);
        console.log('✅ users.visaExpiry 컬럼 확인/추가 완료');

        // 7) postalCode
        await sequelize.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'postalCode'
                ) THEN
                    ALTER TABLE "users"
                        ADD COLUMN "postalCode" VARCHAR(20) NULL;
                    COMMENT ON COLUMN "users"."postalCode" IS '우편번호';
                END IF;
            END
            $$;
        `);
        console.log('✅ users.postalCode 컬럼 확인/추가 완료');

        // 8) address
        await sequelize.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'address'
                ) THEN
                    ALTER TABLE "users"
                        ADD COLUMN "address" VARCHAR(255) NULL;
                    COMMENT ON COLUMN "users"."address" IS '기본 주소';
                END IF;
            END
            $$;
        `);
        console.log('✅ users.address 컬럼 확인/추가 완료');

        // 9) addressDetail
        await sequelize.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'addressDetail'
                ) THEN
                    ALTER TABLE "users"
                        ADD COLUMN "addressDetail" VARCHAR(255) NULL;
                    COMMENT ON COLUMN "users"."addressDetail" IS '상세 주소';
                END IF;
            END
            $$;
        `);
        console.log('✅ users.addressDetail 컬럼 확인/추가 완료');

        console.log('\n✅ users 테이블 직원 관리용 확장 컬럼 추가/확인 완료');
        await sequelize.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ users 테이블 확장 중 오류 발생:', error);
        process.exit(1);
    }
}

addStaffFieldsToUsers();

