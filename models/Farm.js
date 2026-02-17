const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Farm = sequelize.define('Farm', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    farmName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: '농장명'
    },
    farmCode: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        comment: '농장 코드 (예: FARM-001)'
    },
    ownerName: {
        type: DataTypes.STRING(80),
        allowNull: true,
        comment: '대표자/소유자명 (선택)'
    },
    businessNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: '사업자등록번호'
    },

    // 연락처 정보
    phone: {
        type: DataTypes.STRING(30),
        allowNull: true,
        comment: '전화번호'
    },
    email: {
        type: DataTypes.STRING(120),
        allowNull: true,
        comment: '이메일'
    },

    // 주소 정보
    address: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '기본 주소'
    },
    addressDetail: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '상세 주소'
    },
    postalCode: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: '우편번호'
    },

    // 위치 정보 (GPS)
    latitude: {
        type: DataTypes.DOUBLE,
        allowNull: true,
        comment: '위도'
    },
    longitude: {
        type: DataTypes.DOUBLE,
        allowNull: true,
        comment: '경도'
    },

    // 타임존
    timezone: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'Asia/Seoul',
        comment: '타임존'
    },

    // 농장 규모

    capacity: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '최대 사육 두수'
    },

    // 상태 관리
    status: {
        type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'DELETED'),
        allowNull: false,
        defaultValue: 'ACTIVE',
        comment: 'ACTIVE: 운영중, INACTIVE: 일시중단, DELETED: 삭제됨'
    },

    // 기존 isActive 필드 (하위 호환성 유지)
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: '활성 여부 (deprecated: status 사용 권장)'
    },

    // 메모
    note: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '비고/메모'
    },

    // 소유자 (등록한 사용자)
    ownerId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        },
        comment: '농장을 등록한 사용자 ID'
    }
}, {
    tableName: 'farms',
    timestamps: true,
    indexes: [
        {
            fields: ['farmCode']
        },
        {
            fields: ['ownerId']
        },
        {
            fields: ['status']
        }
    ]
});

module.exports = Farm;

