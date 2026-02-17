/**
 * 작업 유형 "적용 대상"(전체 시설 vs 특정 장소) 컬럼 및 연결 테이블 추가
 * 실행: node scripts/add_task_type_scope_tables.js
 */
require('dotenv').config();
const { sequelize } = require('../config/database');

async function run() {
    const q = sequelize.getQueryInterface();
    try {
        const tableSchedule = await q.describeTable('schedule_task_types');
        const hasScheduleCol = tableSchedule.appliesToAllStructures !== undefined || tableSchedule.appliestoallstructures !== undefined;
        if (!hasScheduleCol) {
            await q.addColumn('schedule_task_types', 'appliesToAllStructures', {
                type: sequelize.Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true
            });
            console.log('schedule_task_types.appliesToAllStructures 추가됨');
        }

        const tableFarm = await q.describeTable('farm_schedule_task_types');
        const hasFarmCol = tableFarm.appliesToAllStructures !== undefined || tableFarm.appliestoallstructures !== undefined;
        if (!hasFarmCol) {
            await q.addColumn('farm_schedule_task_types', 'appliesToAllStructures', {
                type: sequelize.Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true
            });
            console.log('farm_schedule_task_types.appliesToAllStructures 추가됨');
        }

        try {
            await q.describeTable('schedule_task_type_structures');
            console.log('schedule_task_type_structures 테이블 이미 존재');
        } catch (_) {
            await q.createTable('schedule_task_type_structures', {
                scheduleTaskTypeId: { type: sequelize.Sequelize.INTEGER, primaryKey: true, references: { model: 'schedule_task_types', key: 'id' }, onDelete: 'CASCADE' },
                structureTemplateId: { type: sequelize.Sequelize.INTEGER, primaryKey: true, references: { model: 'structure_templates', key: 'id' }, onDelete: 'CASCADE' }
            });
            console.log('schedule_task_type_structures 테이블 생성됨');
        }

        try {
            await q.describeTable('farm_schedule_task_type_structures');
            console.log('farm_schedule_task_type_structures 테이블 이미 존재');
        } catch (_) {
            await q.createTable('farm_schedule_task_type_structures', {
                farmScheduleTaskTypeId: { type: sequelize.Sequelize.INTEGER, primaryKey: true, references: { model: 'farm_schedule_task_types', key: 'id' }, onDelete: 'CASCADE' },
                structureTemplateId: { type: sequelize.Sequelize.INTEGER, primaryKey: true, references: { model: 'structure_templates', key: 'id' }, onDelete: 'CASCADE' }
            });
            console.log('farm_schedule_task_type_structures 테이블 생성됨');
        }

        console.log('마이그레이션 완료');
    } catch (err) {
        console.error('마이그레이션 오류:', err);
        throw err;
    } finally {
        await sequelize.close();
    }
}

run();
