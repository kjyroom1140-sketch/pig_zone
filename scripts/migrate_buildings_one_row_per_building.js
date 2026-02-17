/**
 * 설계 변경: 건물 1 row = 1동, 층 정보는 farm_barns.buildingId + floorNumber 로만 표현
 *
 * 1. totalFloors 컬럼 추가 (없으면)
 * 2. buildingGroupId 기준 그룹별로 한 row만 남기고, farm_barns를 해당 건물 id + 층번호로 연결
 * 3. buildingGroupId, floor 컬럼 제거
 *
 * 실행: node scripts/migrate_buildings_one_row_per_building.js
 */
const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');

async function run() {
    try {
        console.log('🔄 설계 변경: farm_buildings 1 row = 1동, 층은 farm_barns.floorNumber 로만 표현\n');

        const [cols] = await sequelize.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'farm_buildings'
        `, { type: QueryTypes.SELECT });
        const colNames = (cols || []).map(c => c.column_name);
        const hasFloor = colNames.includes('floor');
        const hasGroupId = colNames.includes('buildingGroupId');
        const hasTotalFloors = colNames.includes('totalFloors');

        if (!hasFloor && !hasGroupId) {
            if (!hasTotalFloors) {
                await sequelize.query(`
                    ALTER TABLE farm_buildings ADD COLUMN IF NOT EXISTS "totalFloors" INTEGER DEFAULT 1;
                `);
                console.log('✅ totalFloors 컬럼 추가 완료');
            } else {
                console.log('⚠️ 이미 새 설계 적용됨 (totalFloors 있음, floor/buildingGroupId 없음)');
            }
            await sequelize.close();
            process.exit(0);
            return;
        }

        if (!hasTotalFloors) {
            await sequelize.query(`
                ALTER TABLE farm_buildings ADD COLUMN IF NOT EXISTS "totalFloors" INTEGER DEFAULT 1;
            `);
            console.log('✅ totalFloors 컬럼 추가 완료');
        }

        // 그룹별 건물 row 목록 (buildingGroupId, id, floor)
        const rows = await sequelize.query(`
            SELECT id, "buildingGroupId", COALESCE(floor, 1) AS floor
            FROM farm_buildings
            ORDER BY "buildingGroupId" NULLS LAST, floor ASC, id ASC
        `, { type: QueryTypes.SELECT });

        const groupMap = new Map();
        for (const r of rows || []) {
            const gid = r.buildingGroupId || r.id;
            if (!groupMap.has(gid)) groupMap.set(gid, []);
            groupMap.get(gid).push({ id: r.id, floor: r.floor });
        }

        for (const [, list] of groupMap) {
            if (list.length === 0) continue;
            const keep = list[0];
            const totalFloors = list.length;
            await sequelize.query(
                `UPDATE farm_buildings SET "totalFloors" = :n WHERE id = :id`,
                { replacements: { n: totalFloors, id: keep.id } }
            );
            for (let i = 1; i < list.length; i++) {
                const { id: oldId, floor: floorNum } = list[i];
                await sequelize.query(
                    `UPDATE farm_barns SET "buildingId" = :keepId, "floorNumber" = :floorNum WHERE "buildingId" = :oldId`,
                    { replacements: { keepId: keep.id, floorNum, oldId } }
                );
                await sequelize.query(`DELETE FROM farm_buildings WHERE id = :oldId`, { replacements: { oldId } });
            }
        }

        // 단일 row (buildingGroupId 없음) totalFloors = 1
        await sequelize.query(`
            UPDATE farm_buildings SET "totalFloors" = 1 WHERE "totalFloors" IS NULL
        `);

        console.log('✅ 건물 그룹 통합 및 farm_barns 층번호 반영 완료');

        if (hasGroupId) {
            await sequelize.query(`ALTER TABLE farm_buildings DROP COLUMN IF EXISTS "buildingGroupId";`);
            console.log('✅ buildingGroupId 컬럼 제거 완료');
        }
        if (hasFloor) {
            await sequelize.query(`ALTER TABLE farm_buildings DROP COLUMN IF EXISTS "floor";`);
            console.log('✅ floor 컬럼 제거 완료');
        }

        await sequelize.close();
        console.log('\n✅ 마이그레이션 완료');
        process.exit(0);
    } catch (error) {
        console.error('❌ 마이그레이션 오류:', error);
        await sequelize.close();
        process.exit(1);
    }
}

run();
