/**
 * 일정 기준 유형·작업 유형 통합 테이블 (schedule_item_types)
 * kind: 'basis' = 기준 유형, 'task' = 작업 유형
 * 마이그레이션: scripts/migrate_to_schedule_item_types.js
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScheduleItemType = sequelize.define('ScheduleItemType', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '통합 유형 ID'
    },
    kind: {
        type: DataTypes.STRING(10),
        allowNull: false,
        comment: 'basis=기준 유형, task=작업 유형'
    },
    code: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '코드 (ENTRY_DAY, DAILY, VACCINE 등)'
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: '표시명'
    },
    targetType: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: '구분: pig, facility (기준 유형용)'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '설명 (기준 유형용)'
    },
    category: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '대분류 (작업 유형용: vaccine, move 등)'
    },
    sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        comment: '정렬 순서'
    },
    appliesToAllStructures: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: '전체 시설 적용 여부 (작업 유형용)'
    }
}, {
    tableName: 'schedule_item_types',
    timestamps: true,
    underscored: false,
    indexes: [
        { fields: ['kind'] },
        { fields: ['kind', 'sortOrder'] }
    ]
});

module.exports = ScheduleItemType;
