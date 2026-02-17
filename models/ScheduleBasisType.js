const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScheduleBasisType = sequelize.define('ScheduleBasisType', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    code: {
        type: DataTypes.STRING(50),
        allowNull: true,
        unique: true,
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
        comment: '구분: pig(돼지), facility(시설) — 일정 항목 구분과 동일'
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
    tableName: 'schedule_basis_types',
    timestamps: true,
    underscored: false
});

module.exports = ScheduleBasisType;
