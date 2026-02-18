const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScheduleTaskTypeStructure = sequelize.define('ScheduleTaskTypeStructure', {
    scheduleTaskTypeId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: { model: 'schedule_item_types', key: 'id' },
        onDelete: 'CASCADE',
        comment: '작업 유형 ID (schedule_item_types.id, kind=task)'
    },
    structureTemplateId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: { model: 'structure_templates', key: 'id' },
        onDelete: 'CASCADE',
        comment: '적용 대상 구조 템플릿 ID'
    }
}, {
    tableName: 'schedule_task_type_structures',
    timestamps: false,
    underscored: false
});

module.exports = ScheduleTaskTypeStructure;
