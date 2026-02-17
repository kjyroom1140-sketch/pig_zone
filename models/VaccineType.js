const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const VaccineType = sequelize.define('VaccineType', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: { // 백신명
        type: DataTypes.STRING,
        allowNull: false
    },
    targetDisease: { // 대상 질병
        type: DataTypes.STRING,
        allowNull: false
    },
    manufacturer: { // 제조사
        type: DataTypes.STRING,
        allowNull: true
    },
    method: { // 접종 방법 (근육, 피하 등)
        type: DataTypes.STRING,
        allowNull: true
    },
    dosage: { // 접종 용량
        type: DataTypes.STRING,
        allowNull: true
    },
    timing: { // 접종 시기 (권장)
        type: DataTypes.STRING,
        allowNull: true
    },
    description: { // 상세 설명 및 주의사항
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'vaccine_types',
    timestamps: true
});

module.exports = VaccineType;
