/**
 * 대분류 ↔ 구분 매핑 (schedule_work_type_divisions)
 * docs: schedule_structure_design.md — 어떤 대분류를 어떤 구분에서 쓸 수 있는지
 * 비어 있으면 해당 대분류는 appliesToScope로만 제한
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScheduleWorkTypeDivision = sequelize.define('ScheduleWorkTypeDivision', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, comment: '고유 ID' },
    workTypeId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'schedule_work_types', key: 'id' }, onDelete: 'CASCADE', comment: '대분류 (schedule_work_types.id)' },
    divisionId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'schedule_divisions', key: 'id' }, onDelete: 'CASCADE', comment: '구분 (schedule_divisions.id)' },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, comment: '표시 순서' }
}, {
    tableName: 'schedule_work_type_divisions',
    timestamps: true,
    underscored: false,
    indexes: [{ unique: true, fields: ['workTypeId', 'divisionId'] }],
    comment: '대분류↔구분 매핑 — 어떤 작업유형 대분류를 어떤 구분에서 쓸 수 있는지'
});

module.exports = ScheduleWorkTypeDivision;
