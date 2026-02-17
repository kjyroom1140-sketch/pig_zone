const { sequelize } = require('../config/database');

/**
 * users.systemRole 값 재매핑 스크립트
 *
 * - user        → super_admin (농장 최고 관리자)
 * - super_admin → system_admin (시스템 관리자)
 *
 * 이미 ENUM 타입에는 'system_admin', 'super_admin', 'user' 값이 존재한다고 가정합니다.
 */
async function updateSystemRoleValues() {
    try {
        console.log('🔄 users.systemRole 값 재매핑 시작...\n');

        // 1) user → super_admin
        console.log('  1) user → super_admin 업데이트 중...');
        const [res1] = await sequelize.query(`
            UPDATE users
            SET "systemRole" = 'super_admin'
            WHERE "systemRole" = 'user'
        `);
        console.log('     업데이트 결과:', res1);

        // 2) super_admin → system_admin
        console.log('  2) super_admin → system_admin 업데이트 중...');
        const [res2] = await sequelize.query(`
            UPDATE users
            SET "systemRole" = 'system_admin'
            WHERE "systemRole" = 'super_admin'
        `);
        console.log('     업데이트 결과:', res2);

        console.log('\n✅ users.systemRole 재매핑 완료!');
        await sequelize.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ systemRole 값 업데이트 오류:', error);
        await sequelize.close();
        process.exit(1);
    }
}

updateSystemRoleValues();

