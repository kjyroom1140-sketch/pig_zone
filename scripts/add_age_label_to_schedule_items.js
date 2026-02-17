/**
 * schedule_items 테이블에 ageLabel(일령) 컬럼 추가
 * 한 번만 실행. 실행: node scripts/add_age_label_to_schedule_items.js
 */
const { sequelize } = require('../config/database');

async function up() {
    const qi = sequelize.getQueryInterface();
    const tableInfo = await qi.describeTable('schedule_items');
    if (tableInfo.ageLabel) {
        console.log('ageLabel 컬럼이 이미 있습니다.');
        return;
    }
    await qi.addColumn('schedule_items', 'ageLabel', {
        type: sequelize.Sequelize.STRING(50),
        allowNull: true
    });
    console.log('schedule_items.ageLabel 컬럼을 추가했습니다.');
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
