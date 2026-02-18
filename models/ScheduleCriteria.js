/**
 * 일정 기준 설정 (schedule_criterias)
 * sortations: 정렬 설정, criterias: 기준 데이터
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScheduleCriteria = sequelize.define('ScheduleCriteria', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '고유 ID'
    },
    schedule_sortations_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '구분(schedule_sortations) ID'
    },
    sortations: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '정렬(sortations) 데이터'
    },
    criterias: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '기준(criterias) 데이터'
    }
}, {
    tableName: 'schedule_criterias',
    timestamps: true,
    underscored: false,
    comment: '일정 기준 설정 — sortations, criterias'
});

module.exports = ScheduleCriteria;
