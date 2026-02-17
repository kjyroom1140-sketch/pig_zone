/**
 * farm_schedule_items 의 taskTypeId, basisTypeId FK를
 * schedule_task_types / schedule_basis_types → farm_schedule_task_types / farm_schedule_basis_types 로 변경
 * 한 번만 실행. 실행: node scripts/fix_farm_schedule_items_fk.js
 */
require('dotenv').config();
const { sequelize } = require('../config/database');

async function run() {
    try {
        await sequelize.authenticate();
        console.log('DB 연결됨.');

        const [rows] = await sequelize.query(`
            SELECT c.conname AS "constraint_name", r.relname AS ref_table
            FROM pg_constraint c
            JOIN pg_class r ON r.oid = c.confrelid
            WHERE c.conrelid = 'farm_schedule_items'::regclass AND c.contype = 'f'
        `);

        for (const row of rows) {
            const conname = row.constraint_name;
            const refTable = row.ref_table;
            if (refTable === 'schedule_task_types' || refTable === 'schedule_basis_types') {
                await sequelize.query(`ALTER TABLE farm_schedule_items DROP CONSTRAINT IF EXISTS "${conname}"`);
                console.log('Dropped constraint:', conname);
            }
        }

        // 새 FK 추가 (이미 있으면 무시)
        try {
            await sequelize.query(`
                ALTER TABLE farm_schedule_items
                ADD CONSTRAINT farm_schedule_items_task_type_id_fkey
                FOREIGN KEY ("taskTypeId") REFERENCES farm_schedule_task_types(id) ON DELETE RESTRICT
            `);
            console.log('Added FK taskTypeId -> farm_schedule_task_types');
        } catch (e) {
            if (!e.message || !e.message.includes('already exists')) throw e;
            console.log('FK taskTypeId already points to farm_schedule_task_types');
        }
        try {
            await sequelize.query(`
                ALTER TABLE farm_schedule_items
                ADD CONSTRAINT farm_schedule_items_basis_type_id_fkey
                FOREIGN KEY ("basisTypeId") REFERENCES farm_schedule_basis_types(id) ON DELETE SET NULL
            `);
            console.log('Added FK basisTypeId -> farm_schedule_basis_types');
        } catch (e) {
            if (!e.message || !e.message.includes('already exists')) throw e;
            console.log('FK basisTypeId already points to farm_schedule_basis_types');
        }

        console.log('완료.');
    } catch (err) {
        console.error(err);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

run();
