/**
 * schedule_items 테이블에 basisTypeId 컬럼 추가 (schedule_basis_types FK)
 * 한 번만 실행하면 됨. 실행: node scripts/add_schedule_basis_type_id.js
 */
const { sequelize } = require('../config/database');

async function up() {
    const qi = sequelize.getQueryInterface();
    const tableInfo = await qi.describeTable('schedule_items');
    if (tableInfo.basisTypeId) {
        console.log('basisTypeId 컬럼이 이미 있습니다.');
        return;
    }
    await qi.addColumn('schedule_items', 'basisTypeId', {
        type: sequelize.Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'schedule_basis_types', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
    });
    console.log('schedule_items.basisTypeId 컬럼을 추가했습니다.');
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
