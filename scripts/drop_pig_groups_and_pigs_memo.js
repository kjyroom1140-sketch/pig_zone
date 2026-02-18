/**
 * 돈군(pig_groups), 객체(pigs) 테이블에서 memo 컬럼 제거
 * 실행: node scripts/drop_pig_groups_and_pigs_memo.js
 */

const { sequelize } = require('../config/database');

async function run() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected.\n');

        for (const table of ['pig_groups', 'pigs']) {
            const [cols] = await sequelize.query(`
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'memo';
            `, { bind: [table] });
            if (cols && cols.length > 0) {
                await sequelize.query(`ALTER TABLE ${table} DROP COLUMN IF EXISTS memo;`);
                console.log(`✅ ${table}: memo 컬럼 제거 완료.`);
            } else {
                console.log(`✅ ${table}: memo 컬럼 없음. 변경 없음.`);
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
