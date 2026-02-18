/**
 * 세부 작업유형: 대상 장소·구분 다중 선택용 조인 테이블 추가 및 기존 단일 FK 제거
 * 1) schedule_work_detail_type_structures, schedule_work_detail_type_divisions 생성
 * 2) 기존 structureTemplateId/divisionId 값으로 조인 행 추가
 * 3) structureTemplateId, divisionId 컬럼 제거
 * 한 번만 실행. 실행: node scripts/schedule_work_detail_types_multi_place_division.js
 */
const { sequelize } = require('../config/database');

async function up() {
    const qi = sequelize.getQueryInterface();
    const tableInfo = await qi.describeTable('schedule_work_detail_types');

    let structTableExists = false;
    try { await qi.describeTable('schedule_work_detail_type_structures'); structTableExists = true; } catch (_) {}
    if (!structTableExists) {
        await qi.createTable('schedule_work_detail_type_structures', {
            id: { type: sequelize.Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
            workDetailTypeId: { type: sequelize.Sequelize.INTEGER, allowNull: false, references: { model: 'schedule_work_detail_types', key: 'id' }, onDelete: 'CASCADE' },
            structureTemplateId: { type: sequelize.Sequelize.INTEGER, allowNull: false, references: { model: 'structure_templates', key: 'id' }, onDelete: 'CASCADE' }
        });
        await qi.addIndex('schedule_work_detail_type_structures', ['workDetailTypeId', 'structureTemplateId'], { unique: true });
        console.log('schedule_work_detail_type_structures 테이블을 생성했습니다.');
    }

    let divTableExists = false;
    try { await qi.describeTable('schedule_work_detail_type_divisions'); divTableExists = true; } catch (_) {}
    if (!divTableExists) {
        await qi.createTable('schedule_work_detail_type_divisions', {
            id: { type: sequelize.Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
            workDetailTypeId: { type: sequelize.Sequelize.INTEGER, allowNull: false, references: { model: 'schedule_work_detail_types', key: 'id' }, onDelete: 'CASCADE' },
            divisionId: { type: sequelize.Sequelize.INTEGER, allowNull: false, references: { model: 'schedule_divisions', key: 'id' }, onDelete: 'CASCADE' }
        });
        await qi.addIndex('schedule_work_detail_type_divisions', ['workDetailTypeId', 'divisionId'], { unique: true });
        console.log('schedule_work_detail_type_divisions 테이블을 생성했습니다.');
    }

    if (tableInfo.structureTemplateId || tableInfo.divisionId) {
        const colStr = tableInfo.structureTemplateId ? '"structureTemplateId"' : null;
        const colDiv = tableInfo.divisionId ? '"divisionId"' : null;
        const cols = ['id'].concat(colStr ? [colStr] : []).concat(colDiv ? [colDiv] : []).join(', ');
        const [rows] = await sequelize.query(`SELECT ${cols} FROM schedule_work_detail_types`);
        for (const row of rows) {
            if (row.structureTemplateId != null) {
                await sequelize.query(
                    'INSERT INTO schedule_work_detail_type_structures ("workDetailTypeId", "structureTemplateId") VALUES ($1, $2) ON CONFLICT ("workDetailTypeId", "structureTemplateId") DO NOTHING',
                    { replacements: [row.id, row.structureTemplateId] }
                ).catch(() => {});
            }
            if (row.divisionId != null) {
                await sequelize.query(
                    'INSERT INTO schedule_work_detail_type_divisions ("workDetailTypeId", "divisionId") VALUES ($1, $2) ON CONFLICT ("workDetailTypeId", "divisionId") DO NOTHING',
                    { replacements: [row.id, row.divisionId] }
                ).catch(() => {});
            }
        }
        if (tableInfo.structureTemplateId) {
            await qi.removeColumn('schedule_work_detail_types', 'structureTemplateId');
            console.log('schedule_work_detail_types.structureTemplateId 컬럼을 제거했습니다.');
        }
        if (tableInfo.divisionId) {
            await qi.removeColumn('schedule_work_detail_types', 'divisionId');
            console.log('schedule_work_detail_types.divisionId 컬럼을 제거했습니다.');
        }
    }
}

async function run() {
    try {
        await sequelize.authenticate();
        await up();
    } catch (err) {
        console.error(err);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

run();
