/**
 * schedule_work_detail_types 테이블에 대상 장소·기준 FK 컬럼 추가
 * 한 번만 실행. 실행: node scripts/add_schedule_work_detail_types_place_basis.js
 */
const { sequelize } = require('../config/database');

async function up() {
    const qi = sequelize.getQueryInterface();
    const tableInfo = await qi.describeTable('schedule_work_detail_types');
    if (!tableInfo.structureTemplateId) {
        await qi.addColumn('schedule_work_detail_types', 'structureTemplateId', {
            type: sequelize.Sequelize.INTEGER,
            allowNull: true
        });
        console.log('schedule_work_detail_types.structureTemplateId 컬럼을 추가했습니다.');
    } else {
        console.log('structureTemplateId 컬럼이 이미 있습니다.');
    }
    if (!tableInfo.basisId) {
        await qi.addColumn('schedule_work_detail_types', 'basisId', {
            type: sequelize.Sequelize.INTEGER,
            allowNull: true
        });
        console.log('schedule_work_detail_types.basisId 컬럼을 추가했습니다.');
    } else {
        console.log('basisId 컬럼이 이미 있습니다.');
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
