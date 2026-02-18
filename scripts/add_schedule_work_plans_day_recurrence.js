/**
 * schedule_work_plans 테이블에 시작일수·끝일수·반복 컬럼 추가
 * 한 번만 실행. 실행: node scripts/add_schedule_work_plans_day_recurrence.js
 */
const { sequelize } = require('../config/database');

const columns = [
    { name: 'day_min', type: sequelize.Sequelize.INTEGER, comment: '기준일로부터 시작 일수' },
    { name: 'day_max', type: sequelize.Sequelize.INTEGER, comment: '기준일로부터 끝 일수' },
    { name: 'recurrence_type', type: sequelize.Sequelize.STRING(20), comment: '반복: none|daily|weekly|monthly' },
    { name: 'recurrence_interval', type: sequelize.Sequelize.INTEGER, comment: '반복 간격 (기본 1)' },
    { name: 'recurrence_weekdays', type: sequelize.Sequelize.STRING(30), comment: '주 단위 시 요일 0=일..6=토, 콤마 구분' },
    { name: 'recurrence_month_day', type: sequelize.Sequelize.INTEGER, comment: '월 단위 시 일(1-31)' },
    { name: 'recurrence_start_date', type: sequelize.Sequelize.DATEONLY, comment: '반복 시작일' },
    { name: 'recurrence_end_date', type: sequelize.Sequelize.DATEONLY, comment: '반복 종료일; null이면 무기한' }
];

async function up() {
    const qi = sequelize.getQueryInterface();
    const tableInfo = await qi.describeTable('schedule_work_plans');
    for (const col of columns) {
        if (tableInfo[col.name]) {
            console.log(`${col.name} 컬럼이 이미 있습니다.`);
            continue;
        }
        await qi.addColumn('schedule_work_plans', col.name, {
            type: col.type,
            allowNull: true
        });
        console.log(`schedule_work_plans.${col.name} 컬럼을 추가했습니다.`);
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
