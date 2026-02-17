/**
 * schedule_items, farm_schedule_items 테이블에서 basisType 컬럼 제거
 * (기준 식별은 basisTypeId FK만 사용. basisType은 레거시/미사용으로 삭제)
 *
 * 한 번만 실행. 실행: node scripts/remove_schedule_basis_type_column.js
 */
const { sequelize } = require('../config/database');

async function run() {
    const qi = sequelize.getQueryInterface();
    try {
        await sequelize.authenticate();
        console.log('DB 연결 확인\n');

        const tables = [
            { name: 'schedule_items', label: 'schedule_items' },
            { name: 'farm_schedule_items', label: 'farm_schedule_items' }
        ];

        for (const { name, label } of tables) {
            const tableInfo = await qi.describeTable(name);
            if (tableInfo.basisType) {
                await qi.removeColumn(name, 'basisType');
                console.log(`${label}.basisType 컬럼을 제거했습니다.`);
            } else {
                console.log(`${label}에 basisType 컬럼이 없습니다.`);
            }
        }

        console.log('\n완료.');
    } catch (err) {
        console.error('오류:', err);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

run();
