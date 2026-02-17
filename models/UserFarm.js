const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserFarm = sequelize.define('UserFarm', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    farmId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'farms',
            key: 'id'
        }
    },
    role: {
        type: DataTypes.ENUM(
            'farm_admin',
            'manager',
            'veterinarian',
            'breeder',
            'staff',
            'consultant'
        ),
        allowNull: false,
        defaultValue: 'staff'
    },
    department: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: '부서/담당 구역 (예: 1동, 분만사)'
    },
    position: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: '직책명'
    },
    employmentType: {
        type: DataTypes.ENUM('full_time', 'part_time', 'contract', 'temporary'),
        defaultValue: 'full_time'
    },
    hireDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: '입사일'
    },
    resignDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: '퇴사일'
    },
    salary: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    permissions: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {},
        comment: '세밀한 권한 제어'
    },
    assignedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        },
        comment: '누가 등록했는지'
    },
    assignedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'user_farms',
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['userId', 'farmId']
        }
    ]
});

module.exports = UserFarm;
