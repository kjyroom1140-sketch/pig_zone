const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * 농장 작업 계획·완료 테이블 (farm_schedule_work_plans)
 * 일정 정의(farm_schedule_items)와 분리하여, 예정 시작/종료일과 완료 일자를 관리.
 * docs/dashboard_schedule_register_and_completion.md 참고.
 */
const FarmScheduleWorkPlan = sequelize.define('FarmScheduleWorkPlan', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '고유 ID'
    },
    farmId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'farms', key: 'id' },
        onDelete: 'CASCADE',
        comment: '농장 (권한·파티션용)'
    },
    farmScheduleItemId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'farm_schedule_items', key: 'id' },
        onDelete: 'CASCADE',
        comment: '해당 일정 항목'
    },
    taskTypeCategory: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '작업 유형 대분류 (이동/환경 등). farm_schedule_task_types.category와 동일. 이동만/환경만 필터용.'
    },
    roomId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'farm_rooms', key: 'id' },
        onDelete: 'SET NULL',
        comment: '대상 방 (이벤트/대상 단위 시)'
    },
    sectionId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'farm_sections', key: 'id' },
        onDelete: 'SET NULL',
        comment: '대상 칸 (이벤트/대상 단위 시)'
    },
    plannedStartDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: '예정 시작일'
    },
    plannedEndDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: '예정 종료일 (며칠 계획이든 시작·끝 표현)'
    },
    entrySource: {
        type: DataTypes.STRING(200),
        allowNull: true,
        comment: '전입처 (사육두수 없을 때 전입 작업 추가 시)'
    },
    entryCount: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '전입 두수 (사육두수 없을 때 전입 작업 추가 시)'
    },
    completedDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: '완료 일자 (완료 체크 시 기록)'
    },
    completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '완료 체크 시각'
    },
    completedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        comment: '완료 체크한 사용자 (감사·통계용)'
    }
}, {
    tableName: 'farm_schedule_work_plans',
    timestamps: true,
    underscored: false
    // 인덱스는 이미 DB에 생성됨. Sequelize sync 시 중복 생성 오류 방지를 위해 모델에서는 제외.
    // 필요 시: (farmId, plannedStartDate, plannedEndDate), (farmScheduleItemId, plannedStartDate), (roomId, sectionId), (farmId, taskTypeCategory)
});

module.exports = FarmScheduleWorkPlan;
