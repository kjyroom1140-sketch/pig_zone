/**
 * 일정 기준 마스터 (schedule_bases)
 * docs: schedule_structure_design.md — 전입일, 입식일, 교배일, 분만일 등
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScheduleBase = sequelize.define('ScheduleBase', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, comment: '고유 ID' },
    name: { type: DataTypes.STRING(100), allowNull: false, comment: '표시명 (전입일, 입식일, 교배일, 분만일 등)' },
    description: { type: DataTypes.STRING(500), allowNull: true, comment: '용어 정의·설명' },
    divisionId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'schedule_divisions', key: 'id' }, onDelete: 'SET NULL', comment: '주로 쓰는 구분; NULL이면 전 구분 공통' },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, comment: '정렬 순서' }
}, {
    tableName: 'schedule_bases',
    timestamps: true,
    underscored: false,
    comment: '일정 기준 마스터 — 전입일/입식일/교배일/분만일 등 기준일·기준 사건'
});

module.exports = ScheduleBase;
