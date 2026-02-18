/**
 * 대분류 ↔ 대상장소 매핑 (schedule_work_type_structures)
 * docs: schedule_structure_design.md — 어떤 대분류를 어떤 대상장소에서 쓸 수 있는지
 * 비어 있으면 해당 대분류는 전 장소에서 사용 가능
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScheduleWorkTypeStructure = sequelize.define('ScheduleWorkTypeStructure', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, comment: '고유 ID' },
    workTypeId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'schedule_work_types', key: 'id' }, onDelete: 'CASCADE', comment: '대분류 (schedule_work_types.id)' },
    structureTemplateId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'structure_templates', key: 'id' }, onDelete: 'CASCADE', comment: '대상장소 (structure_templates.id)' },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, comment: '표시 순서' }
}, {
    tableName: 'schedule_work_type_structures',
    timestamps: true,
    underscored: false,
    indexes: [{ unique: true, fields: ['workTypeId', 'structureTemplateId'] }],
    comment: '대분류↔대상장소 매핑 — 어떤 작업유형 대분류를 어떤 장소에서 쓸 수 있는지'
});

module.exports = ScheduleWorkTypeStructure;
