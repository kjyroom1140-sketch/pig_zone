/**
 * schedule_work_types 테이블에 divisionId(구분) 컬럼 추가
 * 트리 구조: 구분(division) 아래에 작업유형(work_type)이 연결됨. NULL = 전 구분 공통.
 * 한 번만 실행. 실행: node scripts/add_schedule_work_types_division_id.js
 */
const { sequelize } = require('../config/database');

async function up() {
    const qi = sequelize.getQueryInterface();
    const tableInfo = await qi.describeTable('schedule_work_types');
    if (tableInfo.divisionId) {
        console.log('divisionId 컬럼이 이미 있습니다.');
        return;
    }
    await qi.addColumn('schedule_work_types', 'divisionId', {
        type: sequelize.Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'schedule_divisions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
    });
    console.log('schedule_work_types.divisionId 컬럼을 추가했습니다.');
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
