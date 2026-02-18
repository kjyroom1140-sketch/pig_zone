/**
 * 세부 작업유형 (schedule_work_detail_types)
 * docs: schedule_structure_design.md — 분만사 이동, 교배 실시, 예방접종 등
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScheduleWorkDetailType = sequelize.define('ScheduleWorkDetailType', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, comment: '고유 ID' },
    workTypeId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'schedule_work_types', key: 'id' }, onDelete: 'CASCADE', comment: '대분류 (schedule_work_types.id)' },
    code: { type: DataTypes.STRING(20), allowNull: true, comment: '세부 코드 (WD001 등, 선택)' },
    name: { type: DataTypes.STRING(100), allowNull: false, comment: '표시명 (분만사 이동, 교배 실시, 예방접종 등)' },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, comment: '정렬 순서' }
}, {
    tableName: 'schedule_work_detail_types',
    timestamps: true,
    underscored: false,
    comment: '세부 작업유형 — 대분류 아래 실제 작업명(분만사 이동, 교배 실시 등)'
});

module.exports = ScheduleWorkDetailType;
