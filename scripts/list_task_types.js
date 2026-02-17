/**
 * 작업 유형 테이블 데이터 조회
 * - schedule_task_types (전역/관리자)
 * - farm_schedule_task_types (농장별)
 * 실행: node scripts/list_task_types.js
 */
const { sequelize } = require('../config/database');
const ScheduleTaskType = require('../models/ScheduleTaskType');
const FarmScheduleTaskType = require('../models/FarmScheduleTaskType');

async function main() {
    try {
        await sequelize.authenticate();
        console.log('=== schedule_task_types (전역 작업 유형) ===\n');
        const global = await ScheduleTaskType.findAll({
            order: [['sortOrder', 'ASC'], ['id', 'ASC']],
            raw: true
        });
        if (global.length === 0) {
            console.log('  (데이터 없음)\n');
        } else {
            console.table(global.map((r) => ({
                id: r.id,
                code: r.code,
                name: r.name,
                category: r.category,
                sortOrder: r.sortOrder,
                appliesToAllStructures: r.appliesToAllStructures
            })));
        }

        console.log('=== farm_schedule_task_types (농장별 작업 유형) ===\n');
        const farmTypes = await FarmScheduleTaskType.findAll({
            order: [['farmId', 'ASC'], ['sortOrder', 'ASC'], ['id', 'ASC']],
            raw: true
        });
        if (farmTypes.length === 0) {
            console.log('  (데이터 없음)\n');
        } else {
            console.table(farmTypes.map((r) => ({
                id: r.id,
                farmId: (r.farmId || '').slice(0, 8) + '…',
                originalId: r.originalId,
                code: r.code,
                name: r.name,
                category: r.category,
                sortOrder: r.sortOrder,
                appliesToAllStructures: r.appliesToAllStructures
            })));
        }
    } catch (err) {
        console.error(err);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

main();
