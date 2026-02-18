const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FarmScheduleBasisType = sequelize.define('FarmScheduleBasisType', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '농장 기준 유형 고유 ID'
    },
    farmId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'farms', key: 'id' },
        onDelete: 'CASCADE',
        comment: '농장 ID'
    },
    originalId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'schedule_bases', key: 'id' },
        onDelete: 'SET NULL',
        comment: '복사 원본(전역 기준), 농장에서 추가한 항목은 null'
    },
    code: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '기준 코드 (예: ENTRY_DAY, FARROWING_DAY, DAILY)'
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: '기준명 (예: 전입일, 출산일, 매일)'
    },
    targetType: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: '구분: pig(돼지), facility(시설)'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '설명'
    },
    sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        comment: '목록 정렬 순서'
    }
}, {
    tableName: 'farm_schedule_basis_types',
    timestamps: true,
    underscored: false,
    indexes: [
        { fields: ['farmId'] },
        { fields: ['farmId', 'originalId'] }
    ]
});

module.exports = FarmScheduleBasisType;
