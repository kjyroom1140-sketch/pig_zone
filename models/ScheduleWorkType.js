/**
 * 작업유형 대분류 (schedule_work_types)
 * docs: schedule_structure_design.md — W01 이동, W02 사양, … W10 시설
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScheduleWorkType = sequelize.define('ScheduleWorkType', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, comment: '고유 ID' },
    code: { type: DataTypes.STRING(10), allowNull: true, comment: '대분류 코드 (W01~W10)' },
    name: { type: DataTypes.STRING(100), allowNull: false, comment: '표시명 (이동, 사양, 번식, 환경 등)' },
    description: { type: DataTypes.STRING(255), allowNull: true, comment: '설명 (선택)' },
    appliesToScope: { type: DataTypes.STRING(20), allowNull: true, defaultValue: 'pig', comment: '적용 대상: pig(개체만) | facility(시설만) | both(둘 다)' },
    divisionId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'schedule_divisions', key: 'id' }, onDelete: 'SET NULL', comment: '구분(트리): NULL=전 구분 공통, 값 있음=해당 구분 전용' },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, comment: '정렬 순서' }
}, {
    tableName: 'schedule_work_types',
    timestamps: true,
    underscored: false,
    comment: '작업유형 대분류 — 트리: 구분(divisionId) 아래에 위치'
});

module.exports = ScheduleWorkType;
