const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FarmScheduleTaskType = sequelize.define('FarmScheduleTaskType', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '농장 작업 유형 고유 ID'
    },
    farmId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'farms', key: 'id' },
        onDelete: 'CASCADE',
        comment: '농장 ID'
    },
    originalId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'schedule_task_types', key: 'id' },
        onDelete: 'SET NULL',
        comment: '복사 원본(전역 schedule_task_types.id), 농장에서 추가한 항목은 null'
    },
    code: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '작업 유형 코드 (예: VACCINE, MOVE)'
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: '작업 유형명 (예: 백신 접종, 이동)'
    },
    category: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '대분류 (vaccine, feed, move 등)'
    },
    sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        comment: '목록 정렬 순서'
    },
    appliesToAllStructures: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'true: 전체 시설, false: 특정 장소만(연결 테이블 참조)'
    }
}, {
    tableName: 'farm_schedule_task_types',
    timestamps: true,
    underscored: false,
    indexes: [
        { fields: ['farmId'] },
        { fields: ['farmId', 'originalId'] }
    ]
});

module.exports = FarmScheduleTaskType;
