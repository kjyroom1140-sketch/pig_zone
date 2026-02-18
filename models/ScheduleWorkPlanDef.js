/**
 * 일정 작업 계획 정의 (schedule_work_plans)
 * structure_templates, schedule_sortations, schedule_criterias, schedule_jobtypes, details
 * 일수·반복은 schedule_items 쪽 컬럼(dayMin, dayMax, recurrence*) 공용 — 여기서는 제거함
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScheduleWorkPlanDef = sequelize.define('ScheduleWorkPlanDef', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '고유 ID'
    },
    structure_templates: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '대상장소(structure_templates) 데이터'
    },
    schedule_sortations: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'schedule_sortations 연계 데이터'
    },
    schedule_criterias: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'schedule_criterias 연계 데이터'
    },
    schedule_jobtypes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'schedule_jobtypes 연계 데이터'
    },
    details: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '상세(details) 데이터'
    }
}, {
    tableName: 'schedule_work_plans',
    timestamps: true,
    underscored: false,
    comment: '일정 작업 계획 정의 — structure_templates, schedule_sortations, schedule_criterias, schedule_jobtypes, details'
});

module.exports = ScheduleWorkPlanDef;
