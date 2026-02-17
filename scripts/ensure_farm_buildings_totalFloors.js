/**
 * farm_buildings 테이블에 totalFloors 컬럼이 없으면 추가
 * 실행: node scripts/ensure_farm_buildings_totalFloors.js
 */
const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');

async function run() {
    try {
        const cols = await sequelize.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'farm_buildings'
        `, { type: QueryTypes.SELECT });
        const names = Array.isArray(cols) ? cols.map(c => c.column_name) : [];
        if (names.includes('totalFloors')) {
            console.log('totalFloors 컬럼이 이미 있습니다.');
        } else {
            await sequelize.query(`
                ALTER TABLE farm_buildings ADD COLUMN "totalFloors" INTEGER DEFAULT 1;
            `);
            console.log('farm_buildings.totalFloors 컬럼 추가 완료');
        }
        await sequelize.close();
        process.exit(0);
    } catch (e) {
        console.error(e);
        await sequelize.close();
        process.exit(1);
    }
}

run();
