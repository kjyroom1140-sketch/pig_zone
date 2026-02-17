const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * 돈군 관리 테이블 — 한 무리 단위, 일정·이동·사육의 기본 단위
 * docs: pig_object_group_movement_tables.md §3.1
 */
const PigGroup = sequelize.define('PigGroup', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: 'PK (DB 내부 식별자)'
    },
    farmId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'farms', key: 'id' },
        comment: '농장 ID'
    },
    groupNo: {
        type: DataTypes.STRING(30),
        allowNull: true,
        comment: '돈군 번호(사람이 보는 식별자). 생성 일시 기반'
    },
    currentSectionId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'farm_sections', key: 'id' },
        comment: '현재 있는 칸(주된 위치)'
    },
    entryDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: '입식/전입일'
    },
    daysOld: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '일령 (계산 또는 입력)'
    },
    breedType: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '대표 품종'
    },
    headcount: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '두수'
    },
    status: {
        type: DataTypes.STRING(30),
        allowNull: true,
        comment: 'active, split, merged, closed 등'
    },
    parentGroupId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'pig_groups', key: 'id' },
        comment: '분할 시 원래 돈군 참조'
    },
    memo: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '비고'
    }
}, {
    tableName: 'pig_groups',
    timestamps: true,
    underscored: true,
    comment: '돈군 — 한 무리 단위'
});

module.exports = PigGroup;
