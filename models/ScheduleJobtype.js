/**
 * 일정 작업유형 설정 (schedule_jobtypes)
 * criterias: 기준 데이터, jobtypes: 작업유형 데이터
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScheduleJobtype = sequelize.define('ScheduleJobtype', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '고유 ID'
    },
    criterias: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '기준(criterias) 데이터'
    },
    jobtypes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '작업유형(jobtypes) 데이터'
    }
}, {
    tableName: 'schedule_jobtypes',
    timestamps: true,
    underscored: false,
    comment: '일정 작업유형 설정 — criterias, jobtypes'
});

module.exports = ScheduleJobtype;
