/**
 * 세부 작업유형 ↔ 대상 장소 다대다 (schedule_work_detail_type_structures)
 * 비어 있으면 전체 장소 공통
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScheduleWorkDetailTypeStructure = sequelize.define('ScheduleWorkDetailTypeStructure', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    workDetailTypeId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'schedule_work_detail_types', key: 'id' }, onDelete: 'CASCADE' },
    structureTemplateId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'structure_templates', key: 'id' }, onDelete: 'CASCADE' }
}, {
    tableName: 'schedule_work_detail_type_structures',
    timestamps: false,
    underscored: false
});

module.exports = ScheduleWorkDetailTypeStructure;
