const { sequelize } = require('../config/database');

/**
 * farm_barns 테이블에서 defaultSectionsPerRoom, totalArea 컬럼 제거
 * - UI/API에서 제거된 필드와 DB 스키마 일치
 */
async function dropColumns() {
    try {
        console.log('🔄 farm_barns에서 defaultSectionsPerRoom, totalArea 컬럼 제거 중...\n');

        await sequelize.query(`
            ALTER TABLE farm_barns
            DROP COLUMN IF EXISTS "defaultSectionsPerRoom",
            DROP COLUMN IF EXISTS "totalArea";
        `);

        console.log('✅ 컬럼 제거 완료');

        await sequelize.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ 컬럼 제거 오류:', error);
        await sequelize.close();
        process.exit(1);
    }
}

dropColumns();
