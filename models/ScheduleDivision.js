/**
 * 일정 구분 마스터 (schedule_divisions)
 * docs: schedule_structure_design.md — 모돈, 옹돈, 자돈, 비번식돈, 시설
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScheduleDivision = sequelize.define('ScheduleDivision', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, comment: '고유 ID' },
    code: { type: DataTypes.STRING(50), allowNull: true, comment: '구분 코드 (sow, boar, piglet, non_breeding, facility)' },
    name: { type: DataTypes.STRING(100), allowNull: false, comment: '표시명 (모돈, 옹돈, 자돈, 비번식돈, 시설)' },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, comment: '정렬 순서' }
}, {
    tableName: 'schedule_divisions',
    timestamps: true,
    underscored: false,
    comment: '일정 구분 마스터 — 모돈/옹돈/자돈/비번식돈/시설'
});

module.exports = ScheduleDivision;
