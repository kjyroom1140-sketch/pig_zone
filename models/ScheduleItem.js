/**
 * 전역 일정 항목 (schedule_items)
 * docs: schedule_structure_design.md — 구분·대상장소·기준·작업유형(세부) + 일수·반복
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScheduleItem = sequelize.define('ScheduleItem', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, comment: '고유 ID' },
    divisionId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'schedule_divisions', key: 'id' }, onDelete: 'CASCADE', comment: '구분 (schedule_divisions.id)' },
    structureTemplateId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'structure_templates', key: 'id' }, onDelete: 'SET NULL', comment: '대상장소; 전체 시설 반복 시 null' },
    basisId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'schedule_bases', key: 'id' }, onDelete: 'RESTRICT', comment: '기준 (schedule_bases.id)' },
    workDetailTypeId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'schedule_work_detail_types', key: 'id' }, onDelete: 'RESTRICT', comment: '작업 내용 (schedule_work_detail_types.id)' },
    dayMin: { type: DataTypes.INTEGER, allowNull: true, comment: '기준일로부터 시작 일수' },
    dayMax: { type: DataTypes.INTEGER, allowNull: true, comment: '기준일로부터 끝 일수' },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, comment: '정렬 순서' },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, comment: '사용 여부' },
    appliesToAllStructures: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false, comment: '전체 시설 반복 일정 여부' },
    recurrenceType: { type: DataTypes.STRING(20), allowNull: true, comment: '반복: none|daily|weekly|monthly' },
    recurrenceInterval: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 1, comment: '반복 간격 (기본 1)' },
    recurrenceWeekdays: { type: DataTypes.STRING(30), allowNull: true, comment: '주 단위 시 요일 0=일..6=토, 콤마 구분' },
    recurrenceMonthDay: { type: DataTypes.INTEGER, allowNull: true, comment: '월 단위 시 일(1-31)' },
    recurrenceStartDate: { type: DataTypes.DATEONLY, allowNull: true, comment: '반복 시작일' },
    recurrenceEndDate: { type: DataTypes.DATEONLY, allowNull: true, comment: '반복 종료일; null이면 무기한' }
}, {
    tableName: 'schedule_items',
    timestamps: true,
    underscored: false,
    comment: '전역 일정 항목 — 구분·대상장소·기준·작업유형(세부) + 일수·반복'
});

module.exports = ScheduleItem;
