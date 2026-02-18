/**
 * 구분 ↔ 대상장소 매핑 (schedule_division_structures)
 * docs: schedule_structure_design.md — 어떤 구분에 어떤 structure_templates 적용 가능한지
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScheduleDivisionStructure = sequelize.define('ScheduleDivisionStructure', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, comment: '고유 ID' },
    divisionId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'schedule_divisions', key: 'id' }, onDelete: 'CASCADE', comment: '구분 (schedule_divisions.id)' },
    structureTemplateId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'structure_templates', key: 'id' }, onDelete: 'CASCADE', comment: '대상장소 (structure_templates.id)' },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, comment: '표시 순서' }
}, {
    tableName: 'schedule_division_structures',
    timestamps: true,
    underscored: false,
    indexes: [{ unique: true, fields: ['divisionId', 'structureTemplateId'] }],
    comment: '구분↔대상장소 매핑 — 어떤 구분에 어떤 structure_templates 적용 가능한지'
});

module.exports = ScheduleDivisionStructure;
