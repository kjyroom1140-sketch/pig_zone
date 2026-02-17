const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * 농장 방 모델
 * 돈사 내의 개별 방을 나타냄 (예: 1번방, 2번방)
 * 각 방마다 칸 수가 다를 수 있음
 */
const FarmRoom = sequelize.define('FarmRoom', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    barnId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'farm_barns',
            key: 'id'
        },
        comment: '소속 돈사 ID'
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
        comment: '방 이름 (예: 1번방, 2번방, A방)'
    },
    roomNumber: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '방 번호 (정렬용)'
    },
    sectionCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: '이 방의 칸 수 (방마다 다를 수 있음)'
    },
    area: {
        type: DataTypes.FLOAT,
        allowNull: true,
        comment: '이 방의 면적 (m²)'
    },
    areaPerSection: {
        type: DataTypes.FLOAT,
        allowNull: true,
        comment: '칸당 면적 (m²)'
    },
    capacityPerSection: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '칸당 수용 두수'
    },
    totalCapacity: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '이 방의 총 수용 두수'
    },
    orderIndex: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: '정렬 순서'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '방 설명'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: '활성화 여부'
    }
}, {
    tableName: 'farm_rooms',
    timestamps: true,
    indexes: [
        {
            fields: ['barnId', 'orderIndex']
        },
        {
            fields: ['farmId']
        },
        {
            fields: ['farmId', 'isActive']
        }
    ]
});

module.exports = FarmRoom;
