const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScheduleItem = sequelize.define('ScheduleItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '일정 항목 고유 ID'
    },
    targetType: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'pig',
        comment: '구분: pig(돼지), facility(시설)'
    },
    structureTemplateId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'structure_templates', key: 'id' },
        comment: '대상장소 (structure_templates FK)'
    },
    basisTypeId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'schedule_basis_types', key: 'id' },
        comment: '기준 (schedule_basis_types FK)'
    },
    ageLabel: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '일령 표시 (예: 0~21일령, 포유자돈)'
    },
    dayMin: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '날짜(시작) - 일수'
    },
    dayMax: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '날짜(끝) - 일수'
    },
    taskTypeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'schedule_task_types', key: 'id' },
        comment: '작업유형 (schedule_task_types FK)'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '작업내용'
    },
    sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        comment: '정렬 순서'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: '사용 여부'
    },
    // ----- 반복 일정 (구글 캘린더식). null/없으면 1회성 -----
    recurrenceType: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: 'none|daily|weekly|monthly|yearly'
    },
    recurrenceInterval: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '간격(기본 1, 2주마다=2)'
    },
    recurrenceWeekdays: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: '주간 시 요일 0=일..6=토 예: 1,4=월목'
    },
    recurrenceMonthDay: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '월간 시 일(1-31)'
    },
    recurrenceStartDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: '반복 시작일'
    },
    recurrenceEndDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: '반복 종료일(null=무기한)'
    }
}, {
    tableName: 'schedule_items',
    timestamps: true,
    underscored: false
});

module.exports = ScheduleItem;
