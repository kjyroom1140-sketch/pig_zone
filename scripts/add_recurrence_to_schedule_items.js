/**
 * schedule_items 테이블에 반복 일정용 컬럼 추가
 * 한 번만 실행. 실행: node scripts/add_recurrence_to_schedule_items.js
 */
const { sequelize } = require('../config/database');

const columns = [
    { name: 'recurrenceType', type: sequelize.Sequelize.STRING(20), comment: 'none|daily|weekly|monthly|yearly' },
    { name: 'recurrenceInterval', type: sequelize.Sequelize.INTEGER, comment: '간격(기본 1, 2주마다=2)' },
    { name: 'recurrenceWeekdays', type: sequelize.Sequelize.STRING(20), comment: '주간 시 요일 0=일..6=토 예: 1,4=월목' },
    { name: 'recurrenceMonthDay', type: sequelize.Sequelize.INTEGER, comment: '월간 시 일(1-31)' },
    { name: 'recurrenceStartDate', type: sequelize.Sequelize.DATEONLY, comment: '반복 시작일' },
    { name: 'recurrenceEndDate', type: sequelize.Sequelize.DATEONLY, comment: '반복 종료일(null=무기한)' }
];

async function up() {
    const qi = sequelize.getQueryInterface();
    const tableInfo = await qi.describeTable('schedule_items');
    for (const col of columns) {
        if (tableInfo[col.name]) {
            console.log(`${col.name} 컬럼이 이미 있습니다.`);
            continue;
        }
        await qi.addColumn('schedule_items', col.name, {
            type: col.type,
            allowNull: true
        });
        console.log(`schedule_items.${col.name} 컬럼을 추가했습니다.`);
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
