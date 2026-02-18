/**
 * schedule_work_plans 테이블 생성
 * 컬럼: id, structure_templates, schedule_sortations, schedule_criterias, schedule_jobtypes, details, createdAt, updatedAt
 * 실행: node scripts/create_schedule_work_plans_table.js
 */
const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

async function up() {
    const qi = sequelize.getQueryInterface();
    const tableList = await qi.showAllTables();
    if (tableList.includes('schedule_work_plans')) {
        console.log('schedule_work_plans 테이블이 이미 있습니다.');
        return;
    }
    await qi.createTable('schedule_work_plans', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        structure_templates: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        schedule_sortations: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        schedule_criterias: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        schedule_jobtypes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        details: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false
        }
    });
    console.log('schedule_work_plans 테이블을 생성했습니다.');
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
