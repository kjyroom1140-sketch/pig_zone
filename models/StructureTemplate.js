const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const StructureTemplate = sequelize.define('StructureTemplate', {
    // 1. 시설 구분 (Category)
    category: {
        type: DataTypes.ENUM('production', 'general'),
        allowNull: false,
        defaultValue: 'production',
        comment: '시설 분류 (production: 사육시설, general: 일반시설)'
    },
    // 2. 시설 이름 (Name)
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '시설 이름 (예: 비육사, 분만사, 자돈사) - buildingType 대체'
    },
    // 3. 체중/상태 (Weight / Status)
    weight: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '체중/상태 (예: 1~7kg, 성돈 등)'
    },
    // 4. 두수당 밀사율 (Optimal Density)
    // 두수당 필요한 면적으로 해석 (m²/head)
    optimalDensity: {
        type: DataTypes.FLOAT,
        allowNull: true,
        comment: '두수당 적정 면적 (m²/head) - 사육시설인 경우 사용'
    },
    // 5. 일령 (사육시설)
    ageLabel: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '일령 표시 (예: 0~28, 29~70, 71~120, 출하시) - 사육시설인 경우 사용'
    },

    // 부가 설명
    description: {
        type: DataTypes.TEXT,
        comment: '설명'
    },

    // 목록 표시 순서 (농장 구조 템플릿 시설기준 테이블에서 위/아래 이동 시 사용)
    sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '정렬 순서 (작을수록 위)'
    }
}, {
    tableName: 'structure_templates',
    timestamps: true
});

module.exports = StructureTemplate;
