const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * 이동 관리 테이블 — 이동 1건 = 1행, 돈군 단위 기록
 * docs: pig_object_group_movement_tables.md §4.2
 */
const PigMovement = sequelize.define('PigMovement', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: 'PK'
    },
    farmId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'farms', key: 'id' },
        comment: '농장 ID (사별/농장별 조회용)'
    },
    pigGroupId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'pig_groups', key: 'id' },
        comment: '이동한 돈군. NULL이면 돈군 미지정 두수 이동 등'
    },
    fromSectionId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'farm_sections', key: 'id' },
        comment: '출발 칸 (전입은 NULL 가능)'
    },
    toSectionId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'farm_sections', key: 'id' },
        comment: '도착 칸 (출하·폐사는 NULL 가능)'
    },
    movedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: '이동 일시'
    },
    headcount: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '이동 두수'
    },
    splitPercentage: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '분할 시 원 돈군 대비 이 목적지(to)로 간 비율(0~100). 일반이동/전입/출하 시 NULL'
    },
    movementType: {
        type: DataTypes.STRING(30),
        allowNull: true,
        comment: 'transfer(일반이동), entry(전입), shipment(출하), merge, split 등'
    },
    sourceGroupId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'pig_groups', key: 'id' },
        comment: '분할 시 원 돈군 id. 같은 분할 이벤트 행 묶을 때 사용'
    },
    scheduleItemId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'farm_schedule_items', key: 'id' },
        comment: '일정 연계 (해당 시 선택)'
    },
    movedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        comment: '실행자'
    },
    memo: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '비고'
    }
}, {
    tableName: 'pig_movements',
    timestamps: true,
    updatedAt: false,
    underscored: true,
    comment: '이동 이벤트 1건 = 1행. 사별(칸/방/돈사) 조회 가능'
});

module.exports = PigMovement;
