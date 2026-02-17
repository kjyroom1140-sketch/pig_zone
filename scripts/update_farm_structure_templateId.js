const { sequelize } = require('../config/database');

async function addTemplateIdColumn() {
    try {
        console.log('🔄 farm_structure 테이블에 templateId 컬럼 추가 시작...\n');

        const sql = `
            ALTER TABLE farm_structure
            ADD COLUMN IF NOT EXISTS "templateId" INTEGER
            REFERENCES structure_templates(id);
        `;

        await sequelize.query(sql);
        console.log('✅ templateId 컬럼 추가/확인 완료');

        // 최종 구조 확인
        const [columns] = await sequelize.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'farm_structure'
            ORDER BY ordinal_position;
        `);

        console.table(columns);

        await sequelize.close();
        console.log('\n✅ farm_structure 마이그레이션 완료!');
        process.exit(0);
    } catch (error) {
        console.error('❌ farm_structure 마이그레이션 오류:', error);
        await sequelize.close();
        process.exit(1);
    }
}

addTemplateIdColumn();

