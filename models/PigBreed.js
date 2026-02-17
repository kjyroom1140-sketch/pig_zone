const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PigBreed = sequelize.define('PigBreed', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    code: { // 품종 코드 (예: L, Y, D)
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    nameKo: { // 품종명 (한글)
        type: DataTypes.STRING,
        allowNull: false
    },
    nameEn: { // 품종명 (영문)
        type: DataTypes.STRING,
        allowNull: true
    },
    description: { // 품종 설명
        type: DataTypes.TEXT,
        allowNull: true
    },
    characteristics: { // 주요 특성
        type: DataTypes.TEXT,
        allowNull: true
    },
    usage: { // 용도 (예: 모계, 부계, 비육돈)
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'pig_breeds',
    timestamps: true
});

module.exports = PigBreed;
