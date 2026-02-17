/**
 * structure_templates 테이블에 sortOrder 컬럼 추가
 * 실행: node scripts/add_structure_templates_sort_order.js
 */

const { sequelize } = require('../config/database');

async function run() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected.\n');

        await sequelize.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'structure_templates' AND column_name = 'sortOrder'
                ) THEN
                    ALTER TABLE structure_templates ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
                    COMMENT ON COLUMN structure_templates."sortOrder" IS '정렬 순서 (작을수록 위)';
                    UPDATE structure_templates SET "sortOrder" = id WHERE "sortOrder" = 0;
                END IF;
            END
            $$;
        `);
        console.log('✅ structure_templates.sortOrder 컬럼 확인/추가 완료.');
    } catch (error) {
        console.error('❌ 오류:', error.message);
        throw error;
    } finally {
        await sequelize.close();
    }
}

run();
