/**
 * schedule_basis_types 테이블에서 structureTemplateId 컬럼 제거
 * 한 번만 실행. 실행: node scripts/remove_basis_type_structure_template_id.js
 */
const { sequelize } = require('../config/database');

async function down() {
    const qi = sequelize.getQueryInterface();
    const tableInfo = await qi.describeTable('schedule_basis_types');
    if (!tableInfo.structureTemplateId) {
        console.log('structureTemplateId 컬럼이 이미 없습니다.');
        return;
    }
    await qi.removeColumn('schedule_basis_types', 'structureTemplateId');
    console.log('schedule_basis_types.structureTemplateId 컬럼을 제거했습니다.');
}

async function run() {
    try {
        await sequelize.authenticate();
        await down();
    } catch (err) {
        console.error(err);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

run();
