/**
 * schedule_bases 테이블에 설명(용어 정의) 컬럼 추가
 * 한 번만 실행. 실행: node scripts/add_schedule_bases_description.js
 */
const { sequelize } = require('../config/database');

async function up() {
    const qi = sequelize.getQueryInterface();
    const tableInfo = await qi.describeTable('schedule_bases');
    if (tableInfo.description) {
        console.log('description 컬럼이 이미 있습니다.');
        return;
    }
    await qi.addColumn('schedule_bases', 'description', {
        type: sequelize.Sequelize.STRING(500),
        allowNull: true
    });
    console.log('schedule_bases.description 컬럼을 추가했습니다.');
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
