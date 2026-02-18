/**
 * 일정 정렬 설정 (schedule_sortations)
 * structure_template_id: 대상장소, sortations: 정렬 설정(구분 이름 등)
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScheduleSortation = sequelize.define('ScheduleSortation', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '고유 ID'
    },
    structure_template_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '대상장소(structure_template) ID'
    },
    sortations: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '정렬(sortations) 데이터 — 구분 이름 등'
    }
}, {
    tableName: 'schedule_sortations',
    timestamps: true,
    underscored: false,
    comment: '일정 정렬 설정 — structure_template_id, sortations'
});

module.exports = ScheduleSortation;
