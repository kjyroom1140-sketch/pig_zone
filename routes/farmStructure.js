const express = require('express');
const router = express.Router();
const {
    FarmStructure,
    StructureTemplate,
    Farm,
    UserFarm,
    ScheduleItem,
    FarmScheduleItem,
    FarmScheduleTaskType,
    FarmScheduleBasisType,
    ScheduleTaskType,
    ScheduleBasisType,
    ScheduleTaskTypeStructure,
    FarmScheduleTaskTypeStructure
} = require('../models');
const { sequelize } = require('../config/database');
const { isAuthenticated } = require('../middleware/auth');
const { Op } = require('sequelize');

// 권한 확인 미들웨어
async function checkFarmPermission(req, res, next) {
    const { farmId } = req.params;

    // 최고 관리자 또는 시스템 관리자는 통과
    if (['super_admin', 'system_admin'].includes(req.session.systemRole)) {
        return next();
    }

    try {
        // 해당 농장에 대한 권한 확인 (농장 관리자 또는 관리자)
        const userFarm = await UserFarm.findOne({
            where: {
                userId: req.session.userId,
                farmId: farmId,
                role: { [Op.or]: ['farm_admin', 'manager'] },
                isActive: true
            }
        });

        if (userFarm) {
            return next();
        } else {
            return res.status(403).json({ error: '농장 구조를 관리할 권한이 없습니다.' });
        }
    } catch (error) {
        console.error('권한 확인 오류:', error);
        return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
}

// 특정 농장의 구조 목록 조회 (production 카테고리만)
router.get('/:farmId/production', isAuthenticated, checkFarmPermission, async (req, res) => {
    try {
        const { farmId } = req.params;

        // 해당 농장의 production 구조 조회
        const structures = await FarmStructure.findAll({
            where: {
                farmId,
                category: 'production'
            },
            attributes: ['id', 'templateId', 'name', 'weight', 'optimalDensity', 'description']
        });

        res.json(structures);
    } catch (error) {
        console.error('농장 구조 조회 오류:', error);
        res.status(500).json({ error: '농장 구조를 불러오는 중 오류가 발생했습니다.' });
    }
});

// 농장 구조 저장 (선택된 템플릿들로 덮어쓰기)
router.post('/:farmId/production', isAuthenticated, checkFarmPermission, async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { farmId } = req.params;
        const { templateIds } = req.body; // Array of selected template IDs

        if (!Array.isArray(templateIds)) {
            await transaction.rollback();
            return res.status(400).json({ error: '잘못된 데이터 형식입니다.' });
        }

        // 1. 해당 농장의 기존 production 구조 삭제
        await FarmStructure.destroy({
            where: {
                farmId,
                category: 'production'
            },
            transaction
        });

        // 2. 선택된 템플릿 정보 조회
        if (templateIds.length > 0) {
            const templates = await StructureTemplate.findAll({
                where: {
                    id: templateIds,
                    category: 'production'
                },
                transaction
            });

            // 3. FarmStructure 생성
            const newStructures = templates.map(template => ({
                farmId,
                templateId: template.id,
                category: template.category,
                name: template.name,
                weight: template.weight,
                optimalDensity: template.optimalDensity,
                description: template.description
            }));

            if (newStructures.length > 0) {
                await FarmStructure.bulkCreate(newStructures, { transaction });
            }
        }

        // FK 제약: farm_schedule_items가 task/basis 타입을 참조하므로 반드시 먼저 삭제 (raw DELETE로 확실히 실행)
        await sequelize.query('DELETE FROM farm_schedule_items WHERE "farmId" = :farmId', {
            replacements: { farmId },
            transaction
        });

        // 1) 농장 전용 작업 유형: 전역 schedule_task_types → farm_schedule_task_types 복사
        await FarmScheduleTaskType.destroy({ where: { farmId }, transaction });
        const globalTaskTypes = await ScheduleTaskType.findAll({
            order: [['sortOrder', 'ASC'], ['id', 'ASC']],
            transaction
        });
        if (globalTaskTypes.length > 0) {
            const farmTaskRows = globalTaskTypes.map((t, i) => ({
                farmId,
                originalId: t.id,
                code: t.code,
                name: t.name,
                category: t.category,
                description: t.description,
                sortOrder: i,
                appliesToAllStructures: t.appliesToAllStructures !== false
            }));
            await FarmScheduleTaskType.bulkCreate(farmTaskRows, { transaction });
        }

        // 2) 농장 전용 기준 유형: 전역 schedule_basis_types → farm_schedule_basis_types 복사
        await FarmScheduleBasisType.destroy({ where: { farmId }, transaction });
        const globalBasisTypes = await ScheduleBasisType.findAll({
            order: [['sortOrder', 'ASC'], ['id', 'ASC']],
            transaction
        });
        if (globalBasisTypes.length > 0) {
            const farmBasisRows = globalBasisTypes.map((b, i) => ({
                farmId,
                originalId: b.id,
                code: b.code,
                name: b.name,
                targetType: b.targetType,
                description: b.description,
                sortOrder: i
            }));
            await FarmScheduleBasisType.bulkCreate(farmBasisRows, { transaction });
        }

        // 3) originalId → 농장 테이블 id 매핑 조회 (방금 insert된 순서와 동일)
        const farmTaskTypes = await FarmScheduleTaskType.findAll({
            where: { farmId },
            order: [['sortOrder', 'ASC'], ['id', 'ASC']],
            transaction
        });
        const farmBasisTypes = await FarmScheduleBasisType.findAll({
            where: { farmId },
            order: [['sortOrder', 'ASC'], ['id', 'ASC']],
            transaction
        });
        const taskIdMap = {}; // originalId -> farm_schedule_task_types.id
        farmTaskTypes.forEach(ft => { if (ft.originalId != null) taskIdMap[ft.originalId] = ft.id; });
        const basisIdMap = {}; // originalId -> farm_schedule_basis_types.id
        farmBasisTypes.forEach(fb => { if (fb.originalId != null) basisIdMap[fb.originalId] = fb.id; });

        // 3-1) schedule_task_type_structures → farm_schedule_task_type_structures 복사 (originalId → farm task type id 매핑)
        const globalScopes = await ScheduleTaskTypeStructure.findAll({ transaction });
        if (globalScopes.length > 0) {
            const farmScopeRows = globalScopes
                .filter(s => taskIdMap[s.scheduleTaskTypeId] != null)
                .map(s => ({ farmScheduleTaskTypeId: taskIdMap[s.scheduleTaskTypeId], structureTemplateId: s.structureTemplateId }));
            if (farmScopeRows.length > 0) {
                await FarmScheduleTaskTypeStructure.bulkCreate(farmScopeRows, { transaction });
            }
        }

        // 4) 선택 시설에 해당하는 schedule_items → farm_schedule_items 복사 (task/basis는 농장 전용 id로 매핑)
        if (templateIds.length > 0) {
            const sourceItems = await ScheduleItem.findAll({
                where: {
                    structureTemplateId: { [Op.in]: templateIds }
                },
                order: [['sortOrder', 'ASC'], ['id', 'ASC']],
                transaction
            });

            if (sourceItems.length > 0) {
                const farmItems = sourceItems.map((item, index) => {
                    const mappedTaskId = item.taskTypeId != null ? taskIdMap[item.taskTypeId] : null;
                    const mappedBasisId = item.basisTypeId != null ? basisIdMap[item.basisTypeId] : null;
                    return {
                        farmId,
                        targetType: item.targetType,
                        structureTemplateId: item.structureTemplateId,
                        basisTypeId: mappedBasisId,
                        ageLabel: item.ageLabel,
                        dayMin: item.dayMin,
                        dayMax: item.dayMax,
                        taskTypeId: mappedTaskId != null ? mappedTaskId : (farmTaskTypes[0] ? farmTaskTypes[0].id : null),
                        description: item.description,
                        sortOrder: index,
                        isActive: item.isActive !== false,
                        recurrenceType: item.recurrenceType,
                        recurrenceInterval: item.recurrenceInterval,
                        recurrenceWeekdays: item.recurrenceWeekdays,
                        recurrenceMonthDay: item.recurrenceMonthDay,
                        recurrenceStartDate: item.recurrenceStartDate,
                        recurrenceEndDate: item.recurrenceEndDate
                    };
                }).filter(i => i.taskTypeId != null);
                if (farmItems.length > 0) {
                    await FarmScheduleItem.bulkCreate(farmItems, { transaction });
                }
            }
        }

        await transaction.commit();
        res.json({ message: '농장 구조가 성공적으로 저장되었습니다.' });

    } catch (error) {
        await transaction.rollback();
        console.error('농장 구조 저장 오류:', error);
        const message = error.message || '농장 구조 저장 중 오류가 발생했습니다.';
        res.status(500).json({ error: message });
    }
});

module.exports = router;
