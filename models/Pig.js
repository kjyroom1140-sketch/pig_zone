const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * 돼지 객체(개체) 테이블 — RFID 등으로 개별 식별된 마리만 등록
 * docs: pig_object_group_movement_tables.md §2.1
 */
const Pig = sequelize.define('Pig', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: 'PK'
    },
    farmId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'farms', key: 'id' },
        comment: '농장 ID'
    },
    pigGroupId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'pig_groups', key: 'id' },
        comment: '소속 돈군. NULL = 미편입/돈군 미사용'
    },
    individualNo: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '개체 번호(귀표 등)'
    },
    earTagType: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: "귀표 유형. 'rfid', 'barcode', 'none' 등"
    },
    rfidTagId: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'RFID 전자이표 ID. NULL이면 비RFID/미등록'
    },
    breedType: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '품종 (pig_breeds 참조 또는 코드)'
    },
    gender: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: '성별 (암컷/수컷 등)'
    },
    birthDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: '출생일'
    },
    entryDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: '전입/입식일'
    },
    status: {
        type: DataTypes.STRING(30),
        allowNull: true,
        comment: '상태 (사육중, 출하, 폐사 등)'
    },
    memo: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '비고'
    }
}, {
    tableName: 'pigs',
    timestamps: true,
    underscored: true,
    comment: '돼지 객체(개체) — RFID 등 개별 식별된 마리만 등록'
});

module.exports = Pig;
