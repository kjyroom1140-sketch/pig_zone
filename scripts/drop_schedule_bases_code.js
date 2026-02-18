/**
 * schedule_bases 테이블에서 code 컬럼 제거 (한 번만 실행)
 * 모델에서 code 제거 후 DB와 맞추기 위해 실행
 */
require('dotenv').config();
const { sequelize } = require('../config/database');

async function main() {
    const queryInterface = sequelize.getQueryInterface();
    const tableDesc = await queryInterface.describeTable('schedule_bases');
    if (!tableDesc || !tableDesc.code) {
        console.log('schedule_bases.code 컬럼이 없습니다. 이미 제거되었거나 테이블이 없습니다.');
        process.exit(0);
        return;
    }
    await queryInterface.removeColumn('schedule_bases', 'code');
    console.log('schedule_bases.code 컬럼을 제거했습니다.');
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
