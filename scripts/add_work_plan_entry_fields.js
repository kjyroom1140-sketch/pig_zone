/**
 * farm_schedule_work_plans 테이블에 전입처(entry_source), 전입 두수(entry_count) 컬럼 추가
 * 실행: node scripts/add_work_plan_entry_fields.js
 */
const { sequelize } = require('../config/database');

async function main() {
    try {
        await sequelize.authenticate();
        console.log('DB connected');
        await sequelize.query(`ALTER TABLE farm_schedule_work_plans ADD COLUMN IF NOT EXISTS "entrySource" VARCHAR(200);`);
        await sequelize.query(`ALTER TABLE farm_schedule_work_plans ADD COLUMN IF NOT EXISTS "entryCount" INTEGER;`);
        console.log('farm_schedule_work_plans: entrySource, entryCount columns added (if not exists).');
    } catch (err) {
        console.error(err);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

main();
