/**
 * schedule_criterias 테이블 생성
 * 컬럼: id, schedule_sortations_id, sortations, criterias, createdAt, updatedAt
 * 실행: node scripts/create_schedule_criterias_table.js
 */
const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

async function up() {
    const qi = sequelize.getQueryInterface();
    const tableList = await qi.showAllTables();
    if (tableList.includes('schedule_criterias')) {
        console.log('schedule_criterias 테이블이 이미 있습니다.');
        return;
    }
    await qi.createTable('schedule_criterias', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        schedule_sortations_id: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        sortations: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        criterias: {
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
    console.log('schedule_criterias 테이블을 생성했습니다.');
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
