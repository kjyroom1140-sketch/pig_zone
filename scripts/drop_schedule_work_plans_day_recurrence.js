/**
 * schedule_work_plans 테이블에서 일수·반복 컬럼 제거 (schedule_items 쪽만 공용 사용)
 * 한 번만 실행. 실행: node scripts/drop_schedule_work_plans_day_recurrence.js
 */
const { sequelize } = require('../config/database');

const columns = [
    'day_min',
    'day_max',
    'recurrence_type',
    'recurrence_interval',
    'recurrence_weekdays',
    'recurrence_month_day',
    'recurrence_start_date',
    'recurrence_end_date'
];

async function down() {
    const qi = sequelize.getQueryInterface();
    const tableInfo = await qi.describeTable('schedule_work_plans');
    for (const name of columns) {
        if (!tableInfo[name]) {
            console.log(`${name} 컬럼이 없습니다.`);
            continue;
        }
        await qi.removeColumn('schedule_work_plans', name);
        console.log(`schedule_work_plans.${name} 컬럼을 제거했습니다.`);
    }
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
