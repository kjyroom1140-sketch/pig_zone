/**
 * schedule_items.ageLabel에서 "일령" 글자 제거 → 숫자만 저장
 * 실행: node scripts/strip_age_label_ilryeong.js
 */
const { sequelize } = require('../config/database');
const { ScheduleItem } = require('../models');

async function run() {
    try {
        await sequelize.authenticate();
        const items = await ScheduleItem.findAll({ where: {}, attributes: ['id', 'ageLabel'] });
        let updated = 0;
        for (const item of items) {
            const raw = item.ageLabel || '';
            if (!raw) continue;
            const replaced = raw.replace(/일령/g, '').trim();
            if (replaced === raw) continue;
            await item.update({ ageLabel: replaced === '' ? null : replaced });
            updated++;
        }
        console.log(`\n✅ ageLabel에서 "일령" 제거 완료. ${updated}건 수정.\n`);
    } catch (err) {
        console.error(err);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

run();
