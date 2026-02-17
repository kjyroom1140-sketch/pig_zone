/**
 * farm_buildings 테이블에서 buildingGroupId 컬럼 제거
 * (설계 변경: 1동 = 1 row, buildingGroupId 불필요)
 *
 * 실행: node scripts/drop_buildingGroupId_from_farm_buildings.js
 */
const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');

async function run() {
    try {
        const cols = await sequelize.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'farm_buildings'
        `, { type: QueryTypes.SELECT });
        const colNames = Array.isArray(cols) ? cols.map(c => c.column_name) : [];

        if (colNames.includes('buildingGroupId')) {
            await sequelize.query(`ALTER TABLE farm_buildings DROP COLUMN "buildingGroupId";`);
            console.log('✅ farm_buildings.buildingGroupId 컬럼 제거 완료');
        } else {
            console.log('⚠️ buildingGroupId 컬럼이 없습니다. (이미 제거됨)');
        }

        await sequelize.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ 오류:', error);
        await sequelize.close();
        process.exit(1);
    }
}

run();
