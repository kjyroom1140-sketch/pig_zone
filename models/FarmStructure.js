const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// 개별 농장별 시설 구조 정보를 저장하는 테이블
// structure_templates 와 동일한 컬럼 구조에
// farmId(농장 ID) + templateId(structure_templates.id) 추가
const FarmStructure = sequelize.define('FarmStructure', {
    // 어떤 농장에 속한 시설인지
    farmId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'farms',
            key: 'id'
        },
        comment: '해당 시설이 속한 농장 ID'
    },

    // 어떤 구조 템플릿으로부터 생성되었는지 (structure_templates.id)
    templateId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'structure_templates',
            key: 'id'
        },
        comment: '참조하는 구조 템플릿 ID'
    },

    // 시설 구분 (StructureTemplate 와 동일)
    category: {
        type: DataTypes.ENUM('production', 'general'),
        allowNull: false,
        defaultValue: 'production',
        comment: '시설 분류 (production: 사육시설, general: 일반시설)'
    },

    // 시설 이름
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '시설 이름 (예: 비육사, 분만사, 자돈사 등)'
    },

    // 체중/상태
    weight: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '체중/상태 (예: 1~7kg, 성돈 등)'
    },

    // 두수당 적정 면적 (밀사율)
    optimalDensity: {
        type: DataTypes.FLOAT,
        allowNull: true,
        comment: '두수당 적정 면적 (m²/head) - 사육시설인 경우 사용'
    },

    // 설명
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '시설 설명'
    }
}, {
    tableName: 'farm_structure',
    timestamps: true
});

module.exports = FarmStructure;

