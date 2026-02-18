/**
 * 기준 유형(schedule_basis_types) + 작업 유형(schedule_task_types) → schedule_item_types 통합 마이그레이션
 * 실행: node scripts/migrate_to_schedule_item_types.js
 *
 * 1. schedule_item_types 테이블 생성
 * 2. schedule_basis_types → kind='basis' 이전, ID 매핑 저장
 * 3. schedule_task_types → kind='task' 이전, ID 매핑 저장
 * 4. schedule_items.basisTypeId, taskTypeId 새 ID로 갱신
 * 5. schedule_task_type_structures.scheduleTaskTypeId 갱신
 * 6. farm_schedule_basis_types.originalId, farm_schedule_task_types.originalId 갱신
 * 7. 기존 FK 제거 후 schedule_item_types 로 FK 추가
 * 8. 기존 테이블 백업명으로 변경
 */

const { sequelize } = require('../config/database');

const BACKUP_SUFFIX = '_backup';

async function run() {
    const basisOldToNew = {}; // old schedule_basis_types.id → new schedule_item_types.id
    const taskOldToNew = {};  // old schedule_task_types.id → new schedule_item_types.id

    try {
        await sequelize.authenticate();
        console.log('✅ DB 연결됨\n');

        const [[{ exists: basisTableExists }]] = await sequelize.query(`
            SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='schedule_basis_types')
        `);
        const [[{ exists: unifiedExists }]] = await sequelize.query(`
            SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='schedule_item_types')
        `);
        if (unifiedExists && !basisTableExists) {
            console.log('이미 통합 마이그레이션이 적용된 상태입니다. (schedule_item_types 존재, schedule_basis_types 없음)');
            await sequelize.close();
            return;
        }
        if (!basisTableExists) {
            console.log('schedule_basis_types 테이블이 없습니다. 백업에서 복구하거나 기존 DB를 확인하세요.');
            await sequelize.close();
            return;
        }
        if (unifiedExists) {
            const [[{ count }]] = await sequelize.query(`SELECT COUNT(*)::int AS count FROM schedule_item_types`);
            if (count > 0) {
                console.log('schedule_item_types에 이미 데이터가 있습니다. 재실행을 위해 비운 후 다시 채웁니다.');
                await sequelize.query(`TRUNCATE schedule_item_types RESTART IDENTITY CASCADE`);
            }
        }

        // ----- 1. schedule_item_types 테이블 생성 -----
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS schedule_item_types (
                id SERIAL PRIMARY KEY,
                kind VARCHAR(10) NOT NULL,
                code VARCHAR(50),
                name VARCHAR(100) NOT NULL,
                "targetType" VARCHAR(20),
                description TEXT,
                category VARCHAR(50),
                "sortOrder" INTEGER DEFAULT 0,
                "appliesToAllStructures" BOOLEAN DEFAULT true,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
            COMMENT ON TABLE schedule_item_types IS '일정 기준 유형·작업 유형 통합 (kind: basis | task)';
            COMMENT ON COLUMN schedule_item_types.kind IS 'basis=기준, task=작업';
        `);
        console.log('1. schedule_item_types 테이블 생성 완료');

        // ----- 2. schedule_basis_types → schedule_item_types (kind=basis) -----
        const [basisRows] = await sequelize.query(
            `SELECT id, code, name, "targetType", description, "sortOrder", "createdAt", "updatedAt" FROM schedule_basis_types ORDER BY id`
        );
        for (const row of basisRows) {
            const [inserted] = await sequelize.query(
                `INSERT INTO schedule_item_types (kind, code, name, "targetType", description, "sortOrder", "appliesToAllStructures", "createdAt", "updatedAt")
                 VALUES ('basis', $1, $2, $3, $4, $5, true, $6, $7)
                 RETURNING id`,
                {
                    bind: [
                        row.code || null,
                        row.name,
                        row.targetType || null,
                        row.description || null,
                        row.sortOrder != null ? row.sortOrder : 0,
                        row.createdAt || new Date(),
                        row.updatedAt || new Date()
                    ]
                }
            );
            const newId = inserted[0].id;
            basisOldToNew[row.id] = newId;
        }
        console.log(`2. 기준 유형 이전 완료: ${basisRows.length}건`);

        // ----- 3. schedule_task_types → schedule_item_types (kind=task) -----
        const [taskRows] = await sequelize.query(
            `SELECT id, code, name, category, "sortOrder", "appliesToAllStructures", "createdAt", "updatedAt" FROM schedule_task_types ORDER BY id`
        );
        for (const row of taskRows) {
            const [inserted] = await sequelize.query(
                `INSERT INTO schedule_item_types (kind, code, name, category, "sortOrder", "appliesToAllStructures", "createdAt", "updatedAt")
                 VALUES ('task', $1, $2, $3, $4, $5, $6, $7)
                 RETURNING id`,
                {
                    bind: [
                        row.code || null,
                        row.name,
                        row.category || null,
                        row.sortOrder != null ? row.sortOrder : 0,
                        row.appliesToAllStructures !== false,
                        row.createdAt || new Date(),
                        row.updatedAt || new Date()
                    ]
                }
            );
            const newId = inserted[0].id;
            taskOldToNew[row.id] = newId;
        }
        console.log(`3. 작업 유형 이전 완료: ${taskRows.length}건`);

        // ----- 3.5. 기존 FK 제거 (ID 갱신 전에 제거해야 함) -----
        const dropFkByRefTable = async (tableName, refTableName) => {
            const [rows] = await sequelize.query(`
                SELECT c.conname FROM pg_constraint c
                JOIN pg_class r ON r.oid = c.confrelid
                WHERE c.conrelid = $1::regclass AND c.contype = 'f' AND r.relname = $2
            `, { bind: [tableName, refTableName] });
            for (const r of rows) {
                await sequelize.query(`ALTER TABLE "${tableName}" DROP CONSTRAINT IF EXISTS "${r.conname}"`);
            }
        };
        await dropFkByRefTable('schedule_items', 'schedule_basis_types');
        await dropFkByRefTable('schedule_items', 'schedule_task_types');
        await dropFkByRefTable('schedule_task_type_structures', 'schedule_task_types');
        await dropFkByRefTable('farm_schedule_basis_types', 'schedule_basis_types');
        await dropFkByRefTable('farm_schedule_task_types', 'schedule_task_types');
        console.log('3.5. 기존 FK 제거 완료');

        // ----- 4. schedule_items FK 값 갱신 -----
        const [scheduleItemRows] = await sequelize.query(`SELECT id, "basisTypeId", "taskTypeId" FROM schedule_items`);
        for (const row of scheduleItemRows) {
            const newBasisId = row.basisTypeId != null ? basisOldToNew[row.basisTypeId] : null;
            const newTaskId = row.taskTypeId != null ? taskOldToNew[row.taskTypeId] : null;
            if (newBasisId !== undefined || newTaskId !== undefined) {
                await sequelize.query(
                    `UPDATE schedule_items SET "basisTypeId" = $1, "taskTypeId" = $2 WHERE id = $3`,
                    { bind: [newBasisId != null ? newBasisId : row.basisTypeId, newTaskId != null ? newTaskId : row.taskTypeId, row.id] }
                );
            }
        }
        console.log(`4. schedule_items 참조 갱신 완료: ${scheduleItemRows.length}건`);

        // ----- 5. schedule_task_type_structures 갱신 -----
        const [sttsRows] = await sequelize.query(`SELECT "scheduleTaskTypeId", "structureTemplateId" FROM schedule_task_type_structures`);
        for (const row of sttsRows) {
            const newTaskId = taskOldToNew[row.scheduleTaskTypeId];
            if (newTaskId != null) {
                await sequelize.query(
                    `UPDATE schedule_task_type_structures SET "scheduleTaskTypeId" = $1 WHERE "scheduleTaskTypeId" = $2 AND "structureTemplateId" = $3`,
                    { bind: [newTaskId, row.scheduleTaskTypeId, row.structureTemplateId] }
                );
            }
        }
        console.log(`5. schedule_task_type_structures 참조 갱신 완료: ${sttsRows.length}건`);

        // ----- 6. farm_schedule_basis_types.originalId, farm_schedule_task_types.originalId 갱신 -----
        const [farmBasisRows] = await sequelize.query(`SELECT id, "originalId" FROM farm_schedule_basis_types WHERE "originalId" IS NOT NULL`);
        for (const row of farmBasisRows) {
            const newId = basisOldToNew[row.originalId];
            if (newId != null) {
                await sequelize.query(`UPDATE farm_schedule_basis_types SET "originalId" = $1 WHERE id = $2`, { bind: [newId, row.id] });
            }
        }
        const [farmTaskRows] = await sequelize.query(`SELECT id, "originalId" FROM farm_schedule_task_types WHERE "originalId" IS NOT NULL`);
        for (const row of farmTaskRows) {
            const newId = taskOldToNew[row.originalId];
            if (newId != null) {
                await sequelize.query(`UPDATE farm_schedule_task_types SET "originalId" = $1 WHERE id = $2`, { bind: [newId, row.id] });
            }
        }
        console.log(`6. farm_schedule_basis_types/farm_schedule_task_types originalId 갱신 완료`);

        // ----- 7. schedule_item_types 로 새 FK 추가 -----
        await sequelize.query(`
            ALTER TABLE schedule_items ADD CONSTRAINT schedule_items_basis_type_id_fkey FOREIGN KEY ("basisTypeId") REFERENCES schedule_item_types(id) ON DELETE SET NULL;
            ALTER TABLE schedule_items ADD CONSTRAINT schedule_items_task_type_id_fkey FOREIGN KEY ("taskTypeId") REFERENCES schedule_item_types(id) ON DELETE RESTRICT;
        `);
        await sequelize.query(`
            ALTER TABLE schedule_task_type_structures ADD CONSTRAINT schedule_task_type_structures_type_id_fkey FOREIGN KEY ("scheduleTaskTypeId") REFERENCES schedule_item_types(id) ON DELETE CASCADE;
        `);
        await sequelize.query(`
            ALTER TABLE farm_schedule_basis_types ADD CONSTRAINT farm_schedule_basis_types_original_id_fkey FOREIGN KEY ("originalId") REFERENCES schedule_item_types(id) ON DELETE SET NULL;
        `);
        await sequelize.query(`
            ALTER TABLE farm_schedule_task_types ADD CONSTRAINT farm_schedule_task_types_original_id_fkey FOREIGN KEY ("originalId") REFERENCES schedule_item_types(id) ON DELETE SET NULL;
        `);
        console.log('7. FK 재설정 완료');

        // ----- 8. 기존 테이블 백업명 변경 -----
        const [[{ exists: basisExists }]] = await sequelize.query(`
            SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='schedule_basis_types')
        `);
        const [[{ exists: taskExists }]] = await sequelize.query(`
            SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='schedule_task_types')
        `);
        if (basisExists) {
            await sequelize.query(`ALTER TABLE schedule_basis_types RENAME TO schedule_basis_types${BACKUP_SUFFIX}`);
            console.log('   schedule_basis_types → schedule_basis_types_backup');
        }
        if (taskExists) {
            await sequelize.query(`ALTER TABLE schedule_task_types RENAME TO schedule_task_types${BACKUP_SUFFIX}`);
            console.log('   schedule_task_types → schedule_task_types_backup');
        }
        console.log('8. 기존 테이블 백업 완료');

        console.log('\n✅ 통합 마이그레이션 완료.');
    } catch (err) {
        console.error('❌ 오류:', err.message);
        throw err;
    } finally {
        await sequelize.close();
    }
}

run();
