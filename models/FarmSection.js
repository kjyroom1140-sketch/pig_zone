const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * 농장 칸 모델
 * 방 내의 개별 칸을 나타냄 (실제 사육 단위)
 * 실시간 돼지 데이터가 이 레벨에 저장됨
 */
const FarmSection = sequelize.define('FarmSection', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    roomId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'farm_rooms',
            key: 'id'
        },
        comment: '소속 방 ID'
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
        allowNull: true,
        comment: '칸 이름 (예: 1칸, 2칸) - 자동 생성 가능'
    },
    sectionNumber: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '방 내 칸 번호 (1, 2, 3, ...)'
    },
    // 실시간 사육 데이터
    currentPigCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: '현재 사육 두수'
    },
    averageWeight: {
        type: DataTypes.FLOAT,
        allowNull: true,
        comment: '평균 체중 (kg)'
    },
    entryDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: '입식일'
    },
    daysOld: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '일령 (days)'
    },
    breedType: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: '품종'
    },
    // 물리적 정보
    area: {
        type: DataTypes.FLOAT,
        allowNull: true,
        comment: '칸 면적 (m²)'
    },
    capacity: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '수용 가능 두수'
    },
    // 메타데이터
    orderIndex: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: '정렬 순서'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: '활성화 여부'
    }
}, {
    tableName: 'farm_sections',
    timestamps: true,
    indexes: [
        {
            fields: ['roomId', 'sectionNumber'],
            unique: true,
            name: 'unique_room_section'
        },
        {
            fields: ['barnId']
        },
        {
            fields: ['farmId']
        },
        {
            fields: ['farmId', 'isActive']
        }
    ]
});

module.exports = FarmSection;
