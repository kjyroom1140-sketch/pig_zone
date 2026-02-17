const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FeedType = sequelize.define('FeedType', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: { // 사료명
        type: DataTypes.STRING,
        allowNull: false
    },
    manufacturer: { // 제조사
        type: DataTypes.STRING,
        allowNull: true
    },
    description: { // 설명/특징
        type: DataTypes.TEXT,
        allowNull: true
    },
    targetStage: { // 급여 단계 (예: 포유돈, 이유자돈, 육성돈)
        type: DataTypes.STRING,
        allowNull: true
    },
    nutrients: { // 주요 영양성분 요약
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'feed_types',
    timestamps: true
});

module.exports = FeedType;
