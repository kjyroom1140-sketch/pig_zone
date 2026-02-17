const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * 권한/직책 정의 테이블
 *
 * - 시스템 전반에서 사용하는 역할(OWNER, MANAGER, STAFF 등)을 중앙에서 관리하기 위한 테이블
 * - 화면의 "권한 (직책) 현황"에서 이 테이블의 내용을 기준으로 리스트를 보여줄 수 있습니다.
 */
const Role = sequelize.define('Role', {
    /**
     * 권한/직책 고유 ID
     *
     * - 내부 식별용 기본 키
     * - 자동 증가 정수
     */
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        comment: '권한/직책 고유 ID (PK)'
    },

    /**
     * 권한 코드
     *
     * - 영문 코드로 시스템 내부에서 사용
     * - 예: OWNER, MANAGER, STAFF, VET 등
     * - 화면상에는 name 컬럼을 주로 사용하고, 코드는 내부 로직/매핑용으로 사용
     */
    code: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        comment: '권한 코드 (예: OWNER, MANAGER, STAFF)'
    },

    /**
     * 권한/직책명 (표시용)
     *
     * - 화면에 노출되는 한글 직책명
     * - 예: 농장주, 관리자, 사육 담당, 수의사 등
     */
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: '권한/직책명 (표시용, 예: 농장주, 관리자)'
    },

    /**
     * 설명
     *
     * - 이 권한/직책이 어떤 역할을 하는지에 대한 상세 설명
     * - 예: "농장 전체 설정 변경 및 직원 관리 가능"
     */
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '권한/직책에 대한 설명'
    },

    /**
     * 권한 레벨
     *
     * - 숫자가 작을수록 높은 권한으로 해석 (예: 1 = 최고 관리자)
     * - 역할 간 대략적인 우선순위를 판단할 때 사용
     */
    level: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 10,
        comment: '권한 레벨 (숫자가 작을수록 높은 권한, 예: 1=최고)'
    },

    /**
     * 기본 부여 여부
     *
     * - true 인 경우, 새 직원/사용자 생성 시 기본 직책으로 추천하거나 자동 부여할 때 사용 가능
     */
    isDefault: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: '신규 사용자/직원 생성 시 기본 권한으로 사용할지 여부'
    },

    /**
     * 사용 여부
     *
     * - false 인 경우 더 이상 신규로 부여하지 않는 직책 (과거 데이터는 유지)
     */
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: '사용 여부 (false 인 경우 신규 부여 금지)'
    },

    /**
     * 농장 전용 직책 여부를 구분하기 위한 농장 ID
     *
     * - NULL  : 시스템 전체에서 공통으로 사용하는 직책
     * - 값 있음: 특정 농장에만 적용되는 직책
     */
    farmId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: '농장 전용 직책인 경우 해당 농장 ID (NULL이면 공통 직책)'
    },

    /**
     * 공통 직책을 기반으로 한 농장 전용 직책인 경우, 기준이 되는 공통 직책 코드
     *
     * - 예: FARM_ADMIN 을 기반으로 농장 A 에서만 이름을 다르게 쓰고 싶을 때
     */
    baseRoleCode: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '농장 전용 직책의 기준이 되는 공통 직책 코드'
    },

    /**
     * 권한 레벨 매핑용 내부 역할 코드
     *
     * - user_farms.role(farm_admin/manager/staff) 로 매핑하기 위한 값
     * - 예:
     *    - FARM_ADMIN  -> farm_admin
     *    - OPERATOR    -> manager
     *    - STAFF       -> staff
     */
    permissionRole: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: 'user_farms.role 로 매핑되는 내부 권한 코드 (farm_admin/manager/staff)'
    }
}, {
    tableName: 'roles',
    timestamps: true,
    comment: '시스템에서 사용하는 권한/직책 정의 테이블'
});

module.exports = Role;

