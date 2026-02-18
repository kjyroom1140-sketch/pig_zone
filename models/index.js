const User = require('./User');
const Farm = require('./Farm');
const UserFarm = require('./UserFarm');
const FarmStructure = require('./FarmStructure');
const Role = require('./Role');

// 새로운 농장 시설 모델
const FarmBuilding = require('./FarmBuilding');
const FarmBarn = require('./FarmBarn');
const FarmRoom = require('./FarmRoom');
const FarmSection = require('./FarmSection');

// ========================================
// 기존 관계 설정
// ========================================

// User와 Farm의 다대다 관계 (UserFarm을 통해)
User.belongsToMany(Farm, {
    through: UserFarm,
    foreignKey: 'userId',
    otherKey: 'farmId',
    as: 'farms'
});

Farm.belongsToMany(User, {
    through: UserFarm,
    foreignKey: 'farmId',
    otherKey: 'userId',
    as: 'users'
});

// Farm의 소유자 관계
Farm.belongsTo(User, {
    foreignKey: 'ownerId',
    as: 'owner'
});

User.hasMany(Farm, {
    foreignKey: 'ownerId',
    as: 'ownedFarms'
});

// UserFarm 직접 접근
User.hasMany(UserFarm, {
    foreignKey: 'userId',
    as: 'userFarms'
});

Farm.hasMany(UserFarm, {
    foreignKey: 'farmId',
    as: 'farmUsers'
});

UserFarm.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user'
});

UserFarm.belongsTo(Farm, {
    foreignKey: 'farmId',
    as: 'farm'
});

// 농장-시설(구조) 관계 (기존)
Farm.hasMany(FarmStructure, {
    foreignKey: 'farmId',
    as: 'structures'
});

FarmStructure.belongsTo(Farm, {
    foreignKey: 'farmId',
    as: 'farm'
});

// 등록자 관계
UserFarm.belongsTo(User, {
    foreignKey: 'assignedBy',
    as: 'assigner'
});

// ========================================
// 새로운 농장 시설 계층 구조 관계
// ========================================

// Farm → Buildings (1:N)
Farm.hasMany(FarmBuilding, {
    foreignKey: 'farmId',
    as: 'buildings',
    onDelete: 'CASCADE'
});

FarmBuilding.belongsTo(Farm, {
    foreignKey: 'farmId',
    as: 'farm'
});

// Building → Barns (1:N)
FarmBuilding.hasMany(FarmBarn, {
    foreignKey: 'buildingId',
    as: 'barns',
    onDelete: 'CASCADE'
});

FarmBarn.belongsTo(FarmBuilding, {
    foreignKey: 'buildingId',
    as: 'building'
});

// Farm → Barns (1:N) - 빠른 조회용
Farm.hasMany(FarmBarn, {
    foreignKey: 'farmId',
    as: 'barns',
    onDelete: 'CASCADE'
});

FarmBarn.belongsTo(Farm, {
    foreignKey: 'farmId',
    as: 'farm'
});

// Barn → Rooms (1:N)
FarmBarn.hasMany(FarmRoom, {
    foreignKey: 'barnId',
    as: 'rooms',
    onDelete: 'CASCADE'
});

FarmRoom.belongsTo(FarmBarn, {
    foreignKey: 'barnId',
    as: 'barn'
});

// Building → Rooms (1:N)
FarmBuilding.hasMany(FarmRoom, {
    foreignKey: 'buildingId',
    as: 'rooms',
    onDelete: 'CASCADE'
});

FarmRoom.belongsTo(FarmBuilding, {
    foreignKey: 'buildingId',
    as: 'building'
});

// Farm → Rooms (1:N) - 빠른 조회용
Farm.hasMany(FarmRoom, {
    foreignKey: 'farmId',
    as: 'rooms',
    onDelete: 'CASCADE'
});

FarmRoom.belongsTo(Farm, {
    foreignKey: 'farmId',
    as: 'farm'
});

// Room → Sections (1:N)
FarmRoom.hasMany(FarmSection, {
    foreignKey: 'roomId',
    as: 'sections',
    onDelete: 'CASCADE'
});

FarmSection.belongsTo(FarmRoom, {
    foreignKey: 'roomId',
    as: 'room'
});

// Barn → Sections (1:N)
FarmBarn.hasMany(FarmSection, {
    foreignKey: 'barnId',
    as: 'sections',
    onDelete: 'CASCADE'
});

FarmSection.belongsTo(FarmBarn, {
    foreignKey: 'barnId',
    as: 'barn'
});

// Building → Sections (1:N)
FarmBuilding.hasMany(FarmSection, {
    foreignKey: 'buildingId',
    as: 'sections',
    onDelete: 'CASCADE'
});

FarmSection.belongsTo(FarmBuilding, {
    foreignKey: 'buildingId',
    as: 'building'
});

// Farm → Sections (1:N) - 빠른 조회용
Farm.hasMany(FarmSection, {
    foreignKey: 'farmId',
    as: 'sections',
    onDelete: 'CASCADE'
});

FarmSection.belongsTo(Farm, {
    foreignKey: 'farmId',
    as: 'farm'
});

const StructureTemplate = require('./StructureTemplate');
const ScheduleDivision = require('./ScheduleDivision');
const ScheduleBase = require('./ScheduleBase');
const ScheduleWorkType = require('./ScheduleWorkType');
const ScheduleWorkDetailType = require('./ScheduleWorkDetailType');
const ScheduleWorkDetailTypeStructure = require('./ScheduleWorkDetailTypeStructure');
const ScheduleWorkDetailTypeDivision = require('./ScheduleWorkDetailTypeDivision');
const ScheduleDivisionStructure = require('./ScheduleDivisionStructure');
const ScheduleItem = require('./ScheduleItem');
const FarmScheduleItem = require('./FarmScheduleItem');
const FarmScheduleTaskType = require('./FarmScheduleTaskType');
const FarmScheduleBasisType = require('./FarmScheduleBasisType');
const FarmScheduleTaskTypeStructure = require('./FarmScheduleTaskTypeStructure');
const FarmScheduleWorkPlan = require('./FarmScheduleWorkPlan');
const ScheduleSortation = require('./ScheduleSortation');
const ScheduleCriteria = require('./ScheduleCriteria');
const ScheduleJobtype = require('./ScheduleJobtype');
const ScheduleWorkPlanDef = require('./ScheduleWorkPlanDef');

// 전역 일정 (docs: schedule_structure_design.md)
ScheduleDivision.hasMany(ScheduleDivisionStructure, { foreignKey: 'divisionId', as: 'structureMappings', onDelete: 'CASCADE' });
ScheduleDivisionStructure.belongsTo(ScheduleDivision, { foreignKey: 'divisionId', as: 'division' });
ScheduleDivisionStructure.belongsTo(StructureTemplate, { foreignKey: 'structureTemplateId', as: 'structureTemplate' });
StructureTemplate.hasMany(ScheduleDivisionStructure, { foreignKey: 'structureTemplateId', as: 'divisionMappings' });

ScheduleBase.belongsTo(ScheduleDivision, { foreignKey: 'divisionId', as: 'division' });
ScheduleDivision.hasMany(ScheduleBase, { foreignKey: 'divisionId', as: 'bases' });

ScheduleWorkType.belongsTo(ScheduleDivision, { foreignKey: 'divisionId', as: 'division' });
ScheduleDivision.hasMany(ScheduleWorkType, { foreignKey: 'divisionId', as: 'workTypes' });
ScheduleWorkType.hasMany(ScheduleWorkDetailType, { foreignKey: 'workTypeId', as: 'detailTypes', onDelete: 'CASCADE' });
ScheduleWorkDetailType.belongsTo(ScheduleWorkType, { foreignKey: 'workTypeId', as: 'workType' });
ScheduleWorkDetailType.hasMany(ScheduleWorkDetailTypeStructure, { foreignKey: 'workDetailTypeId', as: 'structureScopes', onDelete: 'CASCADE' });
ScheduleWorkDetailTypeStructure.belongsTo(ScheduleWorkDetailType, { foreignKey: 'workDetailTypeId', as: 'workDetailType' });
ScheduleWorkDetailTypeStructure.belongsTo(StructureTemplate, { foreignKey: 'structureTemplateId', as: 'structureTemplate' });
ScheduleWorkDetailType.hasMany(ScheduleWorkDetailTypeDivision, { foreignKey: 'workDetailTypeId', as: 'divisionScopes', onDelete: 'CASCADE' });
ScheduleWorkDetailTypeDivision.belongsTo(ScheduleWorkDetailType, { foreignKey: 'workDetailTypeId', as: 'workDetailType' });
ScheduleWorkDetailTypeDivision.belongsTo(ScheduleDivision, { foreignKey: 'divisionId', as: 'division' });

ScheduleItem.belongsTo(ScheduleDivision, { foreignKey: 'divisionId', as: 'division' });
ScheduleItem.belongsTo(StructureTemplate, { foreignKey: 'structureTemplateId', as: 'structureTemplate' });
ScheduleItem.belongsTo(ScheduleBase, { foreignKey: 'basisId', as: 'basis' });
ScheduleItem.belongsTo(ScheduleWorkDetailType, { foreignKey: 'workDetailTypeId', as: 'workDetailType' });
ScheduleDivision.hasMany(ScheduleItem, { foreignKey: 'divisionId', as: 'scheduleItems' });
StructureTemplate.hasMany(ScheduleItem, { foreignKey: 'structureTemplateId', as: 'scheduleItems' });
ScheduleBase.hasMany(ScheduleItem, { foreignKey: 'basisId', as: 'scheduleItems' });
ScheduleWorkDetailType.hasMany(ScheduleItem, { foreignKey: 'workDetailTypeId', as: 'scheduleItems' });

FarmScheduleTaskType.hasMany(FarmScheduleTaskTypeStructure, { foreignKey: 'farmScheduleTaskTypeId', as: 'structureScopes', onDelete: 'CASCADE' });
FarmScheduleTaskTypeStructure.belongsTo(FarmScheduleTaskType, { foreignKey: 'farmScheduleTaskTypeId', as: 'farmScheduleTaskType' });
FarmScheduleTaskTypeStructure.belongsTo(StructureTemplate, { foreignKey: 'structureTemplateId', as: 'structureTemplate' });
StructureTemplate.hasMany(FarmScheduleTaskTypeStructure, { foreignKey: 'structureTemplateId', as: 'farmTaskTypeStructures' });

// 농장별 작업 유형·기준 유형
Farm.hasMany(FarmScheduleTaskType, { foreignKey: 'farmId', as: 'scheduleTaskTypes', onDelete: 'CASCADE' });
FarmScheduleTaskType.belongsTo(Farm, { foreignKey: 'farmId', as: 'farm' });
Farm.hasMany(FarmScheduleBasisType, { foreignKey: 'farmId', as: 'scheduleBasisTypes', onDelete: 'CASCADE' });
FarmScheduleBasisType.belongsTo(Farm, { foreignKey: 'farmId', as: 'farm' });

// 농장별 일정: FarmScheduleItem → 농장 전용 task/basis 참조
Farm.hasMany(FarmScheduleItem, { foreignKey: 'farmId', as: 'scheduleItems', onDelete: 'CASCADE' });
FarmScheduleItem.belongsTo(Farm, { foreignKey: 'farmId', as: 'farm' });
FarmScheduleItem.belongsTo(StructureTemplate, { foreignKey: 'structureTemplateId', as: 'structureTemplate' });
FarmScheduleItem.belongsTo(FarmScheduleTaskType, { foreignKey: 'taskTypeId', as: 'taskType' });
FarmScheduleItem.belongsTo(FarmScheduleBasisType, { foreignKey: 'basisTypeId', as: 'basisTypeRef' });
FarmScheduleTaskType.hasMany(FarmScheduleItem, { foreignKey: 'taskTypeId', as: 'scheduleItems' });
FarmScheduleBasisType.hasMany(FarmScheduleItem, { foreignKey: 'basisTypeId', as: 'scheduleItems' });

// 돼지 객체·돈군·이동 (docs: pig_object_group_movement_tables.md)
const PigGroup = require('./PigGroup');
const Pig = require('./Pig');
const SectionGroupOccupancy = require('./SectionGroupOccupancy');
const PigMovement = require('./PigMovement');

Farm.hasMany(PigGroup, { foreignKey: 'farmId', as: 'pigGroups' });
PigGroup.belongsTo(Farm, { foreignKey: 'farmId', as: 'farm' });
PigGroup.belongsTo(FarmSection, { foreignKey: 'currentSectionId', as: 'currentSection' });
PigGroup.belongsTo(PigGroup, { foreignKey: 'parentGroupId', as: 'parentGroup' });
PigGroup.hasMany(PigGroup, { foreignKey: 'parentGroupId', as: 'childGroups' });

Farm.hasMany(Pig, { foreignKey: 'farmId', as: 'pigs' });
Pig.belongsTo(Farm, { foreignKey: 'farmId', as: 'farm' });
Pig.belongsTo(PigGroup, { foreignKey: 'pigGroupId', as: 'pigGroup' });
PigGroup.hasMany(Pig, { foreignKey: 'pigGroupId', as: 'pigs' });

FarmSection.hasMany(SectionGroupOccupancy, { foreignKey: 'sectionId', as: 'groupOccupancies' });
SectionGroupOccupancy.belongsTo(FarmSection, { foreignKey: 'sectionId', as: 'section' });
PigGroup.hasMany(SectionGroupOccupancy, { foreignKey: 'pigGroupId', as: 'occupancies' });
SectionGroupOccupancy.belongsTo(PigGroup, { foreignKey: 'pigGroupId', as: 'pigGroup' });

Farm.hasMany(PigMovement, { foreignKey: 'farmId', as: 'pigMovements' });
PigMovement.belongsTo(Farm, { foreignKey: 'farmId', as: 'farm' });
PigMovement.belongsTo(PigGroup, { foreignKey: 'pigGroupId', as: 'pigGroup' });
PigMovement.belongsTo(FarmSection, { foreignKey: 'fromSectionId', as: 'fromSection' });
PigMovement.belongsTo(FarmSection, { foreignKey: 'toSectionId', as: 'toSection' });
PigMovement.belongsTo(PigGroup, { foreignKey: 'sourceGroupId', as: 'sourceGroup' });
PigMovement.belongsTo(FarmScheduleItem, { foreignKey: 'scheduleItemId', as: 'scheduleItem' });
PigMovement.belongsTo(User, { foreignKey: 'movedBy', as: 'movedByUser' });
User.hasMany(PigMovement, { foreignKey: 'movedBy', as: 'pigMovements' });
FarmScheduleItem.hasMany(PigMovement, { foreignKey: 'scheduleItemId', as: 'pigMovements' });

// 작업 계획·완료 (farm_schedule_work_plans)
Farm.hasMany(FarmScheduleWorkPlan, { foreignKey: 'farmId', as: 'scheduleWorkPlans', onDelete: 'CASCADE' });
FarmScheduleWorkPlan.belongsTo(Farm, { foreignKey: 'farmId', as: 'farm' });
FarmScheduleItem.hasMany(FarmScheduleWorkPlan, { foreignKey: 'farmScheduleItemId', as: 'workPlans', onDelete: 'CASCADE' });
FarmScheduleWorkPlan.belongsTo(FarmScheduleItem, { foreignKey: 'farmScheduleItemId', as: 'scheduleItem' });
FarmRoom.hasMany(FarmScheduleWorkPlan, { foreignKey: 'roomId', as: 'scheduleWorkPlans' });
FarmScheduleWorkPlan.belongsTo(FarmRoom, { foreignKey: 'roomId', as: 'room' });
FarmSection.hasMany(FarmScheduleWorkPlan, { foreignKey: 'sectionId', as: 'scheduleWorkPlans' });
FarmScheduleWorkPlan.belongsTo(FarmSection, { foreignKey: 'sectionId', as: 'section' });
User.hasMany(FarmScheduleWorkPlan, { foreignKey: 'completedBy', as: 'completedWorkPlans' });
FarmScheduleWorkPlan.belongsTo(User, { foreignKey: 'completedBy', as: 'completedByUser' });

module.exports = {
    User,
    Farm,
    UserFarm,
    FarmStructure,
    Role,
    StructureTemplate,
    ScheduleDivision,
    ScheduleBase,
    ScheduleWorkType,
    ScheduleWorkDetailType,
    ScheduleWorkDetailTypeStructure,
    ScheduleWorkDetailTypeDivision,
    ScheduleDivisionStructure,
    ScheduleItem,
    FarmScheduleItem,
    FarmScheduleTaskType,
    FarmScheduleBasisType,
    FarmScheduleTaskTypeStructure,
    // 새로운 모델
    FarmBuilding,
    FarmBarn,
    FarmRoom,
    FarmSection,
    PigGroup,
    Pig,
    SectionGroupOccupancy,
    PigMovement,
    FarmScheduleWorkPlan,
    ScheduleSortation,
    ScheduleCriteria,
    ScheduleJobtype,
    ScheduleWorkPlanDef
};
