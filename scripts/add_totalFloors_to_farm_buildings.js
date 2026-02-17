const { sequelize } = require('../config/database');

/**
 * FarmBuilding 모델에 totalFloors(층수) 컬럼을 추가하는 마이그레이션 스크립트
 *
 * - INTEGER, NULL 허용, 기본값 1
 * - 기존 데이터에는 NULL 또는 1로 두고, 신규 건물 추가 시 층수를 입력받아 설정
 */
async function addTotalFloorsColumn() {
    try {
        console.log('🔄 farm_buildings 테이블에 totalFloors 컬럼 추가 중...\n');

        await sequelize.query(`
            ALTER TABLE farm_buildings
            ADD COLUMN IF NOT EXISTS "totalFloors" INTEGER DEFAULT 1;
        `);

        console.log('✅ totalFloors 컬럼 추가/확인 완료');

        await sequelize.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ totalFloors 컬럼 추가 오류:', error);
        await sequelize.close();
        process.exit(1);
    }
}

addTotalFloorsColumn();

