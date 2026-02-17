const { sequelize } = require('../config/database');

async function fixSchema() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        // Add optimalDensity column to farm_structure table if not exists
        await sequelize.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='farm_structure' AND column_name='optimalDensity') THEN
                    ALTER TABLE "farm_structure" ADD COLUMN "optimalDensity" DOUBLE PRECISION;
                    COMMENT ON COLUMN "farm_structure"."optimalDensity" IS '두수당 적정 면적 (m²/head) - 사육시설인 경우 사용';
                END IF;
            END
            $$;
        `);
        console.log('Added optimalDensity column to farm_structure.');

        // Add templateId column if not exists (just in case)
        await sequelize.query(`
             DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='farm_structure' AND column_name='templateId') THEN
                    ALTER TABLE "farm_structure" ADD COLUMN "templateId" INTEGER;
                    COMMENT ON COLUMN "farm_structure"."templateId" IS '참조하는 구조 템플릿 ID';
                END IF;
            END
            $$;
        `);
        console.log('Checked templateId column.');

        console.log('Schema fix completed.');
    } catch (error) {
        console.error('Error fixing schema:', error);
    } finally {
        await sequelize.close();
    }
}

fixSchema();
