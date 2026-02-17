const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcrypt');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        validate: {
            len: [3, 50],
            isAlphanumeric: true
        }
    },
    email: {
        type: DataTypes.STRING(100),
        allowNull: true,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    fullName: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    phone: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    // 직원/사용자 기본 정보 확장
    birthDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: '생년월일'
    },
    gender: {
        type: DataTypes.ENUM('male', 'female', 'other'),
        allowNull: true,
        comment: '성별 (male/female/other)'
    },
    /**
     * 국적/체류 정보
     *
     * - nationalityType: domestic(내국인) / foreign(외국인)
     * - 외국인인 경우만 nationality/visaType/visaExpiry 사용
     */
    nationalityType: {
        type: DataTypes.ENUM('domestic', 'foreign'),
        allowNull: false,
        defaultValue: 'domestic',
        comment: '내국인/외국인 구분'
    },
    nationality: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: '국적 (외국인인 경우)'
    },
    visaType: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '비자 종류 (예: E-9, E-7 등)'
    },
    visaExpiry: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: '체류기간 만료일'
    },
    // 주소 정보
    postalCode: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: '우편번호'
    },
    address: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: '기본 주소'
    },
    addressDetail: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: '상세 주소'
    },
    profileImage: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    /**
     * 시스템 권한
     *
     * - system_admin : 시스템 관리자 (플랫폼 전체 관리, admin.html 사용)
     * - super_admin  : 농장 최고 관리자 (자신의 농장 및 직원 관리)
     * - user         : 일반 사용자/직원
     */
    systemRole: {
        type: DataTypes.ENUM('system_admin', 'super_admin', 'user'),
        defaultValue: 'user',
        allowNull: false
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    lastLogin: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'users',
    timestamps: true,
    hooks: {
        // 비밀번호 저장 전 자동 해싱
        beforeCreate: async (user) => {
            if (user.password) {
                user.password = await bcrypt.hash(user.password, 10);
            }
        },
        beforeUpdate: async (user) => {
            if (user.changed('password')) {
                user.password = await bcrypt.hash(user.password, 10);
            }
        }
    }
});

// 비밀번호 검증 메서드
User.prototype.validatePassword = async function (password) {
    return await bcrypt.compare(password, this.password);
};

// JSON 변환 시 비밀번호 제외
User.prototype.toJSON = function () {
    const values = Object.assign({}, this.get());
    delete values.password;
    return values;
};

module.exports = User;
