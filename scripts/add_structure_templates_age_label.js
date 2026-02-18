/**
 * structure_templates 테이블에 ageLabel(일령) 컬럼 추가 및
 * 기존 시설명(자돈사, 육성사, 비육사, 비육사(출하시))에 일령 값 일괄 저장
 * 실행: node scripts/add_structure_templates_age_label.js
 */

const { sequelize } = require('../config/database');

const FACILITY_AGE_MAP = [
    { name: '자돈사', ageLabel: '0~28' },
    { name: '육성사', ageLabel: '29~70' },
    { name: '비육사', ageLabel: '71~120' },
    { name: '비육사(출하시)', ageLabel: '출하시' }
];

async function run() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected.\n');

        // 1. ageLabel 컬럼 추가 (없을 때만)
        await sequelize.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'structure_templates' AND column_name = 'ageLabel'
                ) THEN
                    ALTER TABLE structure_templates ADD COLUMN "ageLabel" VARCHAR(50);
                    COMMENT ON COLUMN structure_templates."ageLabel" IS '일령 표시 (예: 0~28, 29~70, 71~120, 출하시) - 사육시설인 경우 사용';
                END IF;
            END
            $$;
        `);
        console.log('✅ structure_templates.ageLabel 컬럼 확인/추가 완료.');

        // 2. 시설명별 일령 값 업데이트
        for (const { name, ageLabel } of FACILITY_AGE_MAP) {
            await sequelize.query(
                `UPDATE structure_templates SET "ageLabel" = $1 WHERE name = $2`,
                { bind: [ageLabel, name] }
            );
            console.log(`   시설명 '${name}' → 일령 '${ageLabel}' 반영`);
        }

        console.log('\n✅ 일령 컬럼 추가 및 기존 시설 일령 반영 완료.');
    } catch (error) {
        console.error('❌ 오류:', error.message);
        throw error;
    } finally {
        await sequelize.close();
    }
}

run();
