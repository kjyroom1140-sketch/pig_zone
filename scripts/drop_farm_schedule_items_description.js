/**
 * farm_schedule_items 테이블에서 description(작업내용) 컬럼 제거
 * 농장 일정 항목의 "작업 내용"은 taskTypeId로만 표시합니다.
 * 한 번만 실행. 실행: node scripts/drop_farm_schedule_items_description.js
 */
const { sequelize } = require('../config/database');

async function up() {
    const qi = sequelize.getQueryInterface();
    const tableInfo = await qi.describeTable('farm_schedule_items');
    if (!tableInfo.description) {
        console.log('description 컬럼이 없습니다.');
        return;
    }
    await qi.removeColumn('farm_schedule_items', 'description');
    console.log('farm_schedule_items.description 컬럼을 제거했습니다.');
}

async function run() {
    try {
        await sequelize.authenticate();
        await up();
    } catch (err) {
        console.error(err);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

run();
