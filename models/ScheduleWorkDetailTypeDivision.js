/**
 * 세부 작업유형 ↔ 구분 다대다 (schedule_work_detail_type_divisions)
 * 비어 있으면 전 구분 공통
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScheduleWorkDetailTypeDivision = sequelize.define('ScheduleWorkDetailTypeDivision', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    workDetailTypeId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'schedule_work_detail_types', key: 'id' }, onDelete: 'CASCADE' },
    divisionId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'schedule_divisions', key: 'id' }, onDelete: 'CASCADE' }
}, {
    tableName: 'schedule_work_detail_type_divisions',
    timestamps: false,
    underscored: false
});

module.exports = ScheduleWorkDetailTypeDivision;
