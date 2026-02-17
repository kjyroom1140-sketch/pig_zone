const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DiseaseCode = sequelize.define('DiseaseCode', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    code: { // 질병 코드 (예: D-001)
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    name: { // 질병명 (한글)
        type: DataTypes.STRING,
        allowNull: false
    },
    englishName: { // 질병명 (영문)
        type: DataTypes.STRING,
        allowNull: true
    },
    symptoms: { // 주요 증상
        type: DataTypes.TEXT,
        allowNull: true
    },
    prevention: { // 예방 및 관리 방안
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'disease_codes',
    timestamps: true
});

module.exports = DiseaseCode;
