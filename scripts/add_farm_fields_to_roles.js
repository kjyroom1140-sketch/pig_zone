const { sequelize } = require('../config/database');

async function addFarmFieldsToRoles() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected.');

        // farmId 컬럼 추가 (없을 때만)
        await sequelize.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'roles'
                      AND column_name = 'farmId'
                ) THEN
                    ALTER TABLE "roles"
                        ADD COLUMN "farmId" UUID NULL;

                    COMMENT ON COLUMN "roles"."farmId"
                        IS '농장 전용 직책인 경우 해당 농장 ID (NULL이면 공통 직책)';
                END IF;
            END
            $$;
        `);
        console.log('✅ roles.farmId 컬럼 확인/추가 완료');

        // baseRoleCode 컬럼 추가 (없을 때만)
        await sequelize.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'roles'
                      AND column_name = 'baseRoleCode'
                ) THEN
                    ALTER TABLE "roles"
                        ADD COLUMN "baseRoleCode" VARCHAR(50) NULL;

                    COMMENT ON COLUMN "roles"."baseRoleCode"
                        IS '농장 전용 직책의 기준이 되는 공통 직책 코드';
                END IF;
            END
            $$;
        `);
        console.log('✅ roles.baseRoleCode 컬럼 확인/추가 완료');

        // permissionRole 컬럼 추가 (없을 때만)
        await sequelize.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'roles'
                      AND column_name = 'permissionRole'
                ) THEN
                    ALTER TABLE "roles"
                        ADD COLUMN "permissionRole" VARCHAR(20) NULL;

                    COMMENT ON COLUMN "roles"."permissionRole"
                        IS 'user_farms.role 로 매핑되는 내부 권한 코드 (farm_admin/manager/staff)';
                END IF;
            END
            $$;
        `);
        console.log('✅ roles.permissionRole 컬럼 확인/추가 완료');

        console.log('🎉 roles 테이블 농장 관련 필드 추가 완료');
    } catch (error) {
        console.error('❌ roles 테이블 필드 추가 중 오류:', error);
    } finally {
        await sequelize.close();
        process.exit(0);
    }
}

addFarmFieldsToRoles();

