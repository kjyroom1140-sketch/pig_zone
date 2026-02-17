/**
 * schedule_basis_types 테이블에 targetType(구분), structureTemplateId(대상 장소) 컬럼 추가
 * 한 번만 실행하면 됨. 실행: node scripts/add_basis_type_target_and_structure.js
 */
const { sequelize } = require('../config/database');

async function up() {
    const qi = sequelize.getQueryInterface();
    const tableInfo = await qi.describeTable('schedule_basis_types');

    if (!tableInfo.targetType) {
        await qi.addColumn('schedule_basis_types', 'targetType', {
            type: sequelize.Sequelize.STRING(20),
            allowNull: true
        });
        console.log('schedule_basis_types.targetType 컬럼을 추가했습니다.');
    } else {
        console.log('targetType 컬럼이 이미 있습니다.');
    }

    if (!tableInfo.structureTemplateId) {
        await qi.addColumn('schedule_basis_types', 'structureTemplateId', {
            type: sequelize.Sequelize.INTEGER,
            allowNull: true,
            references: { model: 'structure_templates', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
        });
        console.log('schedule_basis_types.structureTemplateId 컬럼을 추가했습니다.');
    } else {
        console.log('structureTemplateId 컬럼이 이미 있습니다.');
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
