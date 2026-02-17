const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * 농장 운영돈사 모델
 * 건물 내의 사육 시설을 나타냄 (예: 비육사, 분만사, 자돈사)
 */
const FarmBarn = sequelize.define('FarmBarn', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    buildingId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'farm_buildings',
            key: 'id'
        },
        comment: '소속 건물 ID'
    },
    farmId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'farms',
            key: 'id'
        },
        comment: '소속 농장 ID (빠른 조회용)'
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: '돈사명 (예: 비육사, 분만사, 자돈사)'
    },
    floorNumber: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '층 번호 (건물 내 몇 층에 위치하는 돈사동인지, 예: 1, 2, 3)'
    },
    barnType: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: '돈사 종류 (fattening, farrowing, nursery 등)'
    },
    orderIndex: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: '정렬 순서'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '돈사 설명'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: '활성화 여부'
    }
}, {
    tableName: 'farm_barns',
    timestamps: true,
    indexes: [
        {
            fields: ['buildingId', 'orderIndex']
        },
        {
            fields: ['farmId']
        },
        {
            fields: ['farmId', 'isActive']
        }
    ]
});

module.exports = FarmBarn;
