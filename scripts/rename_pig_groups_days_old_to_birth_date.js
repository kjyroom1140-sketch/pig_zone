/**
 * 돈군(pig_groups) 테이블: 일령(days_old) 컬럼을 출생일(birth_date)로 변경
 * - 기존 days_old 컬럼이 있으면 제거하고 birth_date DATE 컬럼 추가
 * - 새로 만드는 DB는 create_pig_group_movement_tables.js 에서 birth_date 로 생성됨
 * 실행: node scripts/rename_pig_groups_days_old_to_birth_date.js
 */

const { sequelize } = require('../config/database');

async function run() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected.\n');

        const [cols] = await sequelize.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'pig_groups'
            AND column_name IN ('days_old', 'birth_date');
        `);
        const hasDaysOld = cols.some(r => (r.column_name || '').toLowerCase() === 'days_old');
        const hasBirthDate = cols.some(r => (r.column_name || '').toLowerCase() === 'birth_date');

        if (hasDaysOld && !hasBirthDate) {
            await sequelize.query(`
                ALTER TABLE pig_groups
                RENAME COLUMN days_old TO birth_date;
            `);
            await sequelize.query(`
                ALTER TABLE pig_groups
                ALTER COLUMN birth_date TYPE DATE USING (
                    CASE WHEN entry_date IS NOT NULL AND birth_date IS NOT NULL
                    THEN (entry_date::date - (birth_date || ' days')::interval)::date
                    ELSE NULL END
                );
            `);
            console.log('✅ pig_groups: days_old → birth_date 컬럼 이름 변경 및 타입을 DATE로 변경했습니다.');
            console.log('   (기존 일령은 출생일 = 전입일 - 일령 으로 변환되었습니다.)');
        } else if (hasBirthDate) {
            console.log('✅ pig_groups: 이미 birth_date 컬럼이 있습니다. 변경 없음.');
        } else {
            await sequelize.query(`
                ALTER TABLE pig_groups ADD COLUMN IF NOT EXISTS birth_date DATE;
                COMMENT ON COLUMN pig_groups.birth_date IS '출생일';
            `);
            console.log('✅ pig_groups: birth_date 컬럼 추가 완료.');
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
