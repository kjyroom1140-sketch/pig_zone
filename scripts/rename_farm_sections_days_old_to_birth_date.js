/**
 * 칸(farm_sections) 테이블: 일령(days_old) 컬럼을 출생일(birth_date)로 변경
 * - 기존 days_old가 있으면 birth_date로 이름 변경 후 타입을 DATE로 변경
 * 실행: node scripts/rename_farm_sections_days_old_to_birth_date.js
 */

const { sequelize } = require('../config/database');

async function run() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected.\n');

        const [cols] = await sequelize.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'farm_sections'
            AND column_name IN ('days_old', 'birth_date');
        `);
        const hasDaysOld = cols.some(r => (r.column_name || '').toLowerCase() === 'days_old');
        const hasBirthDate = cols.some(r => (r.column_name || '').toLowerCase() === 'birth_date');

        if (hasDaysOld && !hasBirthDate) {
            await sequelize.query(`
                ALTER TABLE farm_sections
                RENAME COLUMN days_old TO birth_date;
            `);
            await sequelize.query(`
                ALTER TABLE farm_sections
                ALTER COLUMN birth_date TYPE DATE USING (
                    CASE WHEN entry_date IS NOT NULL AND birth_date IS NOT NULL
                    THEN (entry_date::date - (birth_date || ' days')::interval)::date
                    ELSE NULL END
                );
            `);
            await sequelize.query(`
                COMMENT ON COLUMN farm_sections.birth_date IS '출생일';
            `);
            console.log('✅ farm_sections: days_old → birth_date 컬럼 이름 변경 및 타입을 DATE로 변경했습니다.');
            console.log('   (기존 일령은 출생일 = 입주일(entry_date) - 일령 으로 변환되었습니다.)');
        } else if (hasBirthDate) {
            console.log('✅ farm_sections: 이미 birth_date 컬럼이 있습니다. 변경 없음.');
        } else {
            await sequelize.query(`
                ALTER TABLE farm_sections ADD COLUMN IF NOT EXISTS birth_date DATE;
                COMMENT ON COLUMN farm_sections.birth_date IS '출생일';
            `);
            console.log('✅ farm_sections: birth_date 컬럼 추가 완료.');
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
