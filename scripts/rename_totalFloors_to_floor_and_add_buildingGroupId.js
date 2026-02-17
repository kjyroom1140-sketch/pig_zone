const { sequelize } = require('../config/database');

/**
 * farm_buildings 테이블의 totalFloors 컬럼을 floor 로 이름 변경하고,
 * 물리적인 건물 묶음을 표현하기 위한 buildingGroupId 컬럼을 추가하는 스크립트
 *
 * - floor: INTEGER, NULL 허용, 기본값 1 (층 번호)
 * - buildingGroupId: UUID, NULL 허용
 *   - 기존 데이터는 각 행의 id 를 그대로 buildingGroupId 로 설정 (행 하나가 하나의 건물 그룹이 됨)
 */
async function migrateFarmBuildingsFloor() {
    try {
        console.log('🔄 farm_buildings 테이블 totalFloors → floor, buildingGroupId 컬럼 추가 중...\n');

        // 1) totalFloors 컬럼을 floor 로 이름 변경 (이미 변경된 경우 에러 무시)
        try {
            await sequelize.query(`
                ALTER TABLE farm_buildings
                RENAME COLUMN "totalFloors" TO "floor";
            `);
            console.log('✅ totalFloors → floor 컬럼 이름 변경 완료');
        } catch (err) {
            console.warn('⚠️ totalFloors → floor 컬럼 이름 변경 중 경고 (이미 변경되었을 수 있음):', err.message);
        }

        // 2) buildingGroupId 컬럼 추가
        await sequelize.query(`
            ALTER TABLE farm_buildings
            ADD COLUMN IF NOT EXISTS "buildingGroupId" UUID;
        `);
        console.log('✅ buildingGroupId 컬럼 추가/확인 완료');

        // 3) 기존 데이터에 대해 buildingGroupId 기본값 채우기 (없으면 자신의 id 로 설정)
        await sequelize.query(`
            UPDATE farm_buildings
            SET "buildingGroupId" = id
            WHERE "buildingGroupId" IS NULL;
        `);
        console.log('✅ 기존 행의 buildingGroupId 기본값 설정 완료');

        await sequelize.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ farm_buildings floor 마이그레이션 오류:', error);
        await sequelize.close();
        process.exit(1);
    }
}

migrateFarmBuildingsFloor();

