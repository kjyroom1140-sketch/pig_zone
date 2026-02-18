/**
 * schedule_work_detail_types: 기준(basisId) → 구분(divisionId) 변경
 * - divisionId 컬럼 추가, basisId 컬럼 제거
 * 한 번만 실행. 실행: node scripts/schedule_work_detail_types_basis_to_division.js
 */
const { sequelize } = require('../config/database');

async function up() {
    const qi = sequelize.getQueryInterface();
    const tableInfo = await qi.describeTable('schedule_work_detail_types');
    if (!tableInfo.divisionId) {
        await qi.addColumn('schedule_work_detail_types', 'divisionId', {
            type: sequelize.Sequelize.INTEGER,
            allowNull: true
        });
        console.log('schedule_work_detail_types.divisionId 컬럼을 추가했습니다.');
    } else {
        console.log('divisionId 컬럼이 이미 있습니다.');
    }
    if (tableInfo.basisId) {
        await qi.removeColumn('schedule_work_detail_types', 'basisId');
        console.log('schedule_work_detail_types.basisId 컬럼을 제거했습니다.');
    } else {
        console.log('basisId 컬럼이 없습니다.');
    }
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
