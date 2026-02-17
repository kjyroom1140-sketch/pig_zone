/**
 * 기준 유형(schedule_basis_types)에 시설 반복용 매일, 매주, 매월 추가
 * 실행: node scripts/seed_facility_recurrence_basis_types.js
 */
const { ScheduleBasisType } = require('../models');
const { sequelize } = require('../config/database');

const FACILITY_RECURRENCE_BASIS = [
    { code: 'DAILY', name: '매일', targetType: 'facility', sortOrder: 100 },
    { code: 'WEEKLY', name: '매주', targetType: 'facility', sortOrder: 101 },
    { code: 'MONTHLY', name: '매월', targetType: 'facility', sortOrder: 102 }
];

async function run() {
    try {
        await sequelize.authenticate();
        console.log('✅ DB 연결 확인\n');

        for (const row of FACILITY_RECURRENCE_BASIS) {
            const [rec, created] = await ScheduleBasisType.findOrCreate({
                where: { code: row.code },
                defaults: {
                    name: row.name,
                    targetType: row.targetType,
                    sortOrder: row.sortOrder
                }
            });
            if (created) {
                console.log(`  추가: ${row.name} (code=${row.code})`);
            } else {
                if (rec.name !== row.name || rec.targetType !== row.targetType) {
                    await rec.update({ name: row.name, targetType: row.targetType, sortOrder: row.sortOrder });
                    console.log(`  수정: ${row.name} (code=${row.code})`);
                }
            }
        }
        console.log('\n✅ 시설 반복 기준 유형(매일/매주/매월) 반영 완료');
        process.exit(0);
    } catch (e) {
        console.error('❌ 오류:', e);
        process.exit(1);
    }
}

run();
