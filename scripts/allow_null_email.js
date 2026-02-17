const { sequelize } = require('../config/database');

/**
 * users.email 컬럼 NOT NULL 제거 (이메일 선택 입력으로 변경)
 */
async function allowNullEmail() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected.\n');

        await sequelize.query(`
            ALTER TABLE "users"
            ALTER COLUMN "email" DROP NOT NULL;
        `);
        console.log('✅ users.email NOT NULL 제거 완료');

        await sequelize.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ 오류:', error.message);
        process.exit(1);
    }
}

allowNullEmail();
