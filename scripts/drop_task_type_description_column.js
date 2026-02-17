/**
 * schedule_task_types, farm_schedule_task_types 테이블에서 description 컬럼 제거
 * (미사용으로 모델·API·프론트에서 이미 제거됨. DB 스키마 정리용)
 *
 * 한 번만 실행. 실행: node scripts/drop_task_type_description_column.js
 */
const { sequelize } = require('../config/database');

async function run() {
    const qi = sequelize.getQueryInterface();
    try {
        await sequelize.authenticate();
        console.log('DB 연결 확인\n');

        const tables = [
            { name: 'schedule_task_types', label: 'schedule_task_types' },
            { name: 'farm_schedule_task_types', label: 'farm_schedule_task_types' }
        ];

        for (const { name, label } of tables) {
            const tableInfo = await qi.describeTable(name);
            if (tableInfo.description) {
                await qi.removeColumn(name, 'description');
                console.log(label + '.description 컬럼을 제거했습니다.');
            } else {
                console.log(label + '에 description 컬럼이 없습니다.');
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
