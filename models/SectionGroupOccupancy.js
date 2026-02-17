const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * (선택) 칸–돈군 배치 — 한 칸에 여러 돈군이 함께 있을 때 재적/이력
 * 사육 두수: WHERE section_id = ? AND ended_at IS NULL 인 headcount 합계
 * docs: pig_object_group_movement_tables.md §3.2
 */
const SectionGroupOccupancy = sequelize.define('SectionGroupOccupancy', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: 'PK'
    },
    sectionId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'farm_sections', key: 'id' },
        comment: '칸 ID'
    },
    pigGroupId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'pig_groups', key: 'id' },
        comment: '돈군 ID'
    },
    headcount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '해당 칸에서 이 돈군의 두수'
    },
    startedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '해당 칸 입주 시점'
    },
    endedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '해당 칸 퇴거 시점 (NULL이면 현재 재적)'
    }
}, {
    tableName: 'section_group_occupancy',
    timestamps: true,
    underscored: true,
    comment: '칸–돈군 배치 (선택). 사육 두수·이력'
});

module.exports = SectionGroupOccupancy;
