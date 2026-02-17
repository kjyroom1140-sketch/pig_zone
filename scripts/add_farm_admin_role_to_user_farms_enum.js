const { sequelize } = require('../config/database');

/**
 * user_farms.role ENUM 타입에 farm_admin 값을 추가하고,
 * 기존 owner 값을 farm_admin 으로 변경하는 스크립트
 *
 * - enum 타입명: enum_user_farms_role (로그에서 사용 중)
 */
async function addFarmAdminRole() {
    try {
        console.log('🔄 enum_user_farms_role 타입에 farm_admin 값 추가 중...\\n');

        // 1) ENUM 타입에 farm_admin 값 추가 (이미 있으면 건너뜀)
        await sequelize.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_type t
                    JOIN pg_enum e ON t.oid = e.enumtypid
                    WHERE t.typname = 'enum_user_farms_role'
                      AND e.enumlabel = 'farm_admin'
                ) THEN
                    ALTER TYPE enum_user_farms_role ADD VALUE 'farm_admin';
                END IF;
            END $$;
        `);

        console.log('✅ farm_admin ENUM 값 추가/확인 완료');

        // 2) 기존 owner 역할을 farm_admin 으로 변경 (선택 사항이지만, 일관성을 위해 수행)
        await sequelize.query(`
            UPDATE user_farms
            SET "role" = 'farm_admin'
            WHERE "role" = 'owner';
        `);

        console.log('✅ user_farms.role 값 owner → farm_admin 변경 완료');

        await sequelize.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ farm_admin 역할 추가/변경 스크립트 오류:', error);
        await sequelize.close();
        process.exit(1);
    }
}

addFarmAdminRole();

