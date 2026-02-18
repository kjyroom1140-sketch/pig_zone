/**
 * schedule_criterias 테이블에 schedule_sortations_id 컬럼 추가
 * 실행: node scripts/add_schedule_criterias_sortations_id.js
 */
const { sequelize } = require('../config/database');

async function up() {
    const qi = sequelize.getQueryInterface();
    const tableDesc = await qi.describeTable('schedule_criterias');
    if (tableDesc.schedule_sortations_id) {
        console.log('schedule_criterias.schedule_sortations_id 컬럼이 이미 있습니다.');
        return;
    }
    await qi.addColumn('schedule_criterias', 'schedule_sortations_id', {
        type: require('sequelize').DataTypes.INTEGER,
        allowNull: true
    });
    console.log('schedule_criterias.schedule_sortations_id 컬럼을 추가했습니다.');
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
