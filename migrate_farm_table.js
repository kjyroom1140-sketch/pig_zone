const { sequelize } = require('./config/database');

async function addFarmColumns() {
    try {
        console.log('🔄 Farm 테이블에 새 컬럼 추가 시작...\n');

        // 새 컬럼들을 하나씩 추가 (이미 존재하면 무시)
        const columns = [
            {
                name: 'ownerName',
                sql: `ALTER TABLE farms ADD COLUMN IF NOT EXISTS "ownerName" VARCHAR(80);`
            },
            {
                name: 'addressDetail',
                sql: `ALTER TABLE farms ADD COLUMN IF NOT EXISTS "addressDetail" TEXT;`
            },
            {
                name: 'postalCode',
                sql: `ALTER TABLE farms ADD COLUMN IF NOT EXISTS "postalCode" VARCHAR(20);`
            },
            {
                name: 'latitude',
                sql: `ALTER TABLE farms ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;`
            },
            {
                name: 'longitude',
                sql: `ALTER TABLE farms ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;`
            },
            {
                name: 'timezone',
                sql: `ALTER TABLE farms ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Seoul' NOT NULL;`
            },
            {
                name: 'status',
                sql: `DO $$ 
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_farms_status') THEN
                        CREATE TYPE enum_farms_status AS ENUM ('ACTIVE', 'INACTIVE', 'DELETED');
                    END IF;
                END $$;
                ALTER TABLE farms ADD COLUMN IF NOT EXISTS status enum_farms_status DEFAULT 'ACTIVE' NOT NULL;`
            },
            {
                name: 'note',
                sql: `ALTER TABLE farms ADD COLUMN IF NOT EXISTS note TEXT;`
            }
        ];

        for (const column of columns) {
            try {
                console.log(`  ➕ ${column.name} 컬럼 추가 중...`);
                await sequelize.query(column.sql);
                console.log(`  ✅ ${column.name} 추가 완료`);
            } catch (error) {
                if (error.message.includes('already exists')) {
                    console.log(`  ⏭️  ${column.name} 이미 존재함`);
                } else {
                    console.error(`  ❌ ${column.name} 추가 실패:`, error.message);
                }
            }
        }

        // address 컬럼 타입 변경 (VARCHAR → TEXT)
        try {
            console.log('\n  🔄 address 컬럼 타입 변경 중...');
            await sequelize.query(`ALTER TABLE farms ALTER COLUMN address TYPE TEXT;`);
            console.log('  ✅ address 타입 변경 완료');
        } catch (error) {
            console.log('  ⏭️  address 타입 변경 스킵:', error.message);
        }

        // email 컬럼 길이 확장
        try {
            console.log('  🔄 email 컬럼 길이 확장 중...');
            await sequelize.query(`ALTER TABLE farms ALTER COLUMN email TYPE VARCHAR(120);`);
            console.log('  ✅ email 길이 확장 완료');
        } catch (error) {
            console.log('  ⏭️  email 길이 확장 스킵:', error.message);
        }

        // phone 컬럼 길이 확장
        try {
            console.log('  🔄 phone 컬럼 길이 확장 중...');
            await sequelize.query(`ALTER TABLE farms ALTER COLUMN phone TYPE VARCHAR(30);`);
            console.log('  ✅ phone 길이 확장 완료');
        } catch (error) {
            console.log('  ⏭️  phone 길이 확장 스킵:', error.message);
        }

        // 인덱스 추가
        const indexes = [
            {
                name: 'idx_farms_status',
                sql: `CREATE INDEX IF NOT EXISTS idx_farms_status ON farms(status);`
            }
        ];

        console.log('\n  📊 인덱스 추가 중...');
        for (const index of indexes) {
            try {
                await sequelize.query(index.sql);
                console.log(`  ✅ ${index.name} 추가 완료`);
            } catch (error) {
                console.log(`  ⏭️  ${index.name} 스킵:`, error.message);
            }
        }

        // 최종 테이블 구조 확인
        console.log('\n📋 Farm 테이블 최종 구조:\n');
        const [columns_info] = await sequelize.query(`
            SELECT 
                column_name,
                data_type,
                character_maximum_length,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'farms'
            ORDER BY ordinal_position;
        `);

        console.table(columns_info);

        await sequelize.close();
        console.log('\n✅ 마이그레이션 완료!');
        process.exit(0);

    } catch (error) {
        console.error('❌ 마이그레이션 오류:', error);
        await sequelize.close();
        process.exit(1);
    }
}

addFarmColumns();
