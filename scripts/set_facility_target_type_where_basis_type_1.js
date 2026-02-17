/**
 * schedule_items: basisTypeId가 1인 행의 targetType을 'facility'(시설)로 변경
 * (basisTypeId 1 = 시설용 기준 유형으로 간주)
 *
 * 실행: node scripts/set_facility_target_type_where_basis_type_1.js
 */
const { ScheduleItem } = require('../models');
const { FarmScheduleItem } = require('../models');
const { sequelize } = require('../config/database');

async function run() {
    try {
        await sequelize.authenticate();
        console.log('DB 연결 확인\n');

        const [scheduleUpdated] = await ScheduleItem.update(
            { targetType: 'facility' },
            { where: { basisTypeId: 1 } }
        );
        console.log(`schedule_items: basisTypeId=1 인 행 ${scheduleUpdated}건을 targetType='facility'(시설)로 변경했습니다.`);

        const [farmUpdated] = await FarmScheduleItem.update(
            { targetType: 'facility' },
            { where: { basisTypeId: 1 } }
        );
        console.log(`farm_schedule_items: basisTypeId=1 인 행 ${farmUpdated}건을 targetType='facility'(시설)로 변경했습니다.`);

        console.log('\n완료.');
    } catch (err) {
        console.error('오류:', err);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

run();
