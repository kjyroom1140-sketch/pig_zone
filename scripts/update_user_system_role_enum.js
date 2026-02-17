const { sequelize } = require('../config/database');

async function migrateSystemRoleEnum() {
    try {
        console.log('🔄 systemRole ENUM 타입 및 데이터 마이그레이션 시작...\n');

        // 1) enum_users_systemRole 타입에 system_admin, user 값이 없으면 추가
        console.log('  ➕ enum_users_systemRole 타입에 값 추가 확인/추가...');
        await sequelize.query(`
            DO $$
            BEGIN
                -- system_admin 값 추가
                IF NOT EXISTS (
                    SELECT 1 FROM pg_enum e
                    JOIN pg_type t ON e.enumtypid = t.oid
                    WHERE t.typname = 'enum_users_systemRole' AND e.enumlabel = 'system_admin'
                ) THEN
                    ALTER TYPE "public"."enum_users_systemRole" ADD VALUE 'system_admin';
                END IF;

                -- user 값이 없을 경우 대비 (기존에는 이미 존재하지만 안전하게 체크)
                IF NOT EXISTS (
                    SELECT 1 FROM pg_enum e
                    JOIN pg_type t ON e.enumtypid = t.oid
                    WHERE t.typname = 'enum_users_systemRole' AND e.enumlabel = 'user'
                ) THEN
                    ALTER TYPE "public"."enum_users_systemRole" ADD VALUE 'user';
                END IF;
            END
            $$;
        `);

        // 2) 기존 super_admin → system_admin 으로 데이터 변환
        console.log('  🔁 기존 super_admin → system_admin 으로 업데이트...');
        const [result] = await sequelize.query(`
            UPDATE users
            SET "systemRole" = 'system_admin'
            WHERE "systemRole" = 'super_admin'
        `);
        console.log('    업데이트 결과:', result);

        // 3) users 테이블의 systemRole 기본값을 system_admin → user 가 아닌지 확인 후 필요시 변경은 코드 레벨에서 처리
        console.log('\n✅ 마이그레이션 스크립트 실행 완료.');
        await sequelize.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ systemRole ENUM 마이그레이션 오류:', error);
        await sequelize.close();
        process.exit(1);
    }
}

migrateSystemRoleEnum();

