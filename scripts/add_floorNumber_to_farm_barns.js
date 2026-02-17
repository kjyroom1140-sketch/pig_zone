const { sequelize } = require('../config/database');

/**
 * FarmBarn(돈사동) 모델에 floorNumber(층 번호) 컬럼을 추가하는 마이그레이션 스크립트
 *
 * - INTEGER, NULL 허용
 * - 의미: 해당 돈사동이 몇 층에 위치하는지 나타냄 (예: 1층, 2층)
 * - 기존 데이터는 NULL 그대로 두고, 트리/화면에서는 NULL을 1층으로 간주해서 표시
 */
async function addFloorNumberColumn() {
    try {
        console.log('🔄 farm_barns 테이블에 floorNumber 컬럼 추가 중...\n');

        await sequelize.query(`
            ALTER TABLE farm_barns
            ADD COLUMN IF NOT EXISTS "floorNumber" INTEGER;
        `);

        console.log('✅ floorNumber 컬럼 추가/확인 완료');

        await sequelize.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ floorNumber 컬럼 추가 오류:', error);
        await sequelize.close();
        process.exit(1);
    }
}

addFloorNumberColumn();

