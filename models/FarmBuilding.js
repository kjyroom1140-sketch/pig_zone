const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * 농장 건물 모델
 * 농장의 물리적 건물을 나타냄 (예: 1동, 2동, A동)
 */
const FarmBuilding = sequelize.define('FarmBuilding', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    farmId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'farms',
            key: 'id'
        },
        comment: '소속 농장 ID'
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: '건물명 (예: 1동, 2동, A동)'
    },
    totalFloors: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1,
        comment: '총 층수 (표시용, 돈사는 farm_barns.buildingId + floorNumber로 층 구분)'
    },
    code: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '건물 코드 (선택)'
    },
    orderIndex: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: '정렬 순서'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '건물 설명'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: '활성화 여부'
    }
}, {
    tableName: 'farm_buildings',
    timestamps: true,
    indexes: [
        {
            fields: ['farmId', 'orderIndex']
        },
        {
            fields: ['farmId', 'isActive']
        }
    ]
});

module.exports = FarmBuilding;
