/**
 * schedule_sortations 테이블에서 facilities 컬럼 삭제
 * 실행: node scripts/drop_schedule_sortations_facilities.js
 */
const { sequelize } = require('../config/database');

async function up() {
    const qi = sequelize.getQueryInterface();
    const tableDesc = await qi.describeTable('schedule_sortations');
    if (!tableDesc.facilities) {
        console.log('schedule_sortations.facilities 컬럼이 이미 없습니다.');
        return;
    }
    await qi.removeColumn('schedule_sortations', 'facilities');
    console.log('schedule_sortations.facilities 컬럼을 삭제했습니다.');
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
