/**
 * schedule_criterias 테이블 실제 컬럼 확인
 * 실행: node scripts/describe_schedule_criterias.js
 */
const { sequelize } = require('../config/database');

async function run() {
    try {
        await sequelize.authenticate();
        const qi = sequelize.getQueryInterface();
        const desc = await qi.describeTable('schedule_criterias');
        console.log('schedule_criterias 컬럼:', Object.keys(desc));
        console.log(JSON.stringify(desc, null, 2));
    } catch (err) {
        console.error(err);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

run();
