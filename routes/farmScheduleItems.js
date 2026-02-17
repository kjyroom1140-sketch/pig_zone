const express = require('express');
const router = express.Router();
const { FarmScheduleItem, FarmScheduleWorkPlan, StructureTemplate, FarmScheduleTaskType, FarmScheduleBasisType, UserFarm, FarmRoom, FarmSection, PigGroup, PigMovement } = require('../models');
const { sequelize } = require('../config/database');
const { isAuthenticated } = require('../middleware/auth');
const { Op } = require('sequelize');

async function checkFarmPermission(req, res, next) {
    const farmId = req.params.farmId;
    if (['super_admin', 'system_admin'].includes(req.session.systemRole)) {
        return next();
    }
    try {
        const userFarm = await UserFarm.findOne({
            where: {
                userId: req.session.userId,
                farmId,
                role: { [Op.or]: ['farm_admin', 'manager'] },
                isActive: true
            }
        });
        if (userFarm) return next();
        return res.status(403).json({ error: '농장 일정을 관리할 권한이 없습니다.' });
    } catch (err) {
        console.error('권한 확인 오류:', err);
        return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
}

function parseRecurrence(body) {
    const recurrenceType = (body.recurrenceType || '').trim() || null;
    return {
        recurrenceType,
        recurrenceInterval: recurrenceType && body.recurrenceInterval != null ? parseInt(body.recurrenceInterval, 10) : null,
        recurrenceWeekdays: recurrenceType && body.recurrenceWeekdays != null ? String(body.recurrenceWeekdays).trim() || null : null,
        recurrenceMonthDay: recurrenceType && body.recurrenceMonthDay !== '' && body.recurrenceMonthDay != null ? parseInt(body.recurrenceMonthDay, 10) : null,
        recurrenceStartDate: null,
        recurrenceEndDate: null
    };
}

/** 전입 완료 시 일정이 없을 때 사용할 기본 전입 일정 항목 찾기 또는 생성 */
async function ensureDefaultEntryScheduleItem(farmId) {
    let taskType = await FarmScheduleTaskType.findOne({
        where: { farmId, category: 'entry' }
    });
    if (!taskType) {
        taskType = await FarmScheduleTaskType.create({
            farmId,
            name: '전입',
            code: 'ENTRY',
            category: 'entry',
            sortOrder: 0,
            appliesToAllStructures: true
        });
    }
    let scheduleItem = await FarmScheduleItem.findOne({
        where: { farmId, taskTypeId: taskType.id }
    });
    if (!scheduleItem) {
        scheduleItem = await FarmScheduleItem.create({
            farmId,
            targetType: 'pig',
            taskTypeId: taskType.id,
            description: '전입',
            sortOrder: 0,
            isActive: true
        });
    }
    return { scheduleItem, taskType };
}

const includeOpts = [
    { model: StructureTemplate, as: 'structureTemplate', attributes: ['id', 'name', 'category'] },
    { model: FarmScheduleTaskType, as: 'taskType', attributes: ['id', 'code', 'name', 'category'] },
    { model: FarmScheduleBasisType, as: 'basisTypeRef', attributes: ['id', 'code', 'name', 'targetType'] }
];

router.get('/:farmId/pig-groups', isAuthenticated, checkFarmPermission, async (req, res) => {
    try {
        const { farmId } = req.params;
        const groups = await PigGroup.findAll({
            where: { farmId, status: 'active' },
            attributes: ['id', 'groupNo', 'entryDate', 'headcount', 'currentSectionId', 'memo'],
            order: [['createdAt', 'DESC']],
            raw: true
        });
        res.json(groups || []);
    } catch (err) {
        console.error('돈군 목록 조회 오류:', err);
        res.status(500).json({ error: '돈군 목록을 불러오는 중 오류가 발생했습니다.' });
    }
});

router.get('/:farmId/schedule-items', isAuthenticated, checkFarmPermission, async (req, res) => {
    try {
        const { farmId } = req.params;
        const { targetType, structureTemplateId, taskTypeId, basisTypeId } = req.query;
        const where = { farmId };
        if (targetType) where.targetType = targetType;
        if (structureTemplateId) where.structureTemplateId = structureTemplateId;
        if (taskTypeId) where.taskTypeId = taskTypeId;
        if (basisTypeId) where.basisTypeId = basisTypeId;

        const list = await FarmScheduleItem.findAll({
            where,
            include: includeOpts,
            order: [['sortOrder', 'ASC'], ['id', 'ASC']]
        });
        res.json(list);
    } catch (error) {
        console.error('농장 일정 조회 오류:', error);
        res.status(500).json({ error: '농장 일정 목록을 불러오는 중 오류가 발생했습니다.' });
    }
});

router.post('/:farmId/schedule-items', isAuthenticated, checkFarmPermission, async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { farmId } = req.params;
        const { targetType, structureTemplateId, basisTypeId, ageLabel, dayMin, dayMax, taskTypeId, description, sortOrder, isActive } = req.body;
        const recurrence = parseRecurrence(req.body);
        const insertOrder = sortOrder != null ? parseInt(sortOrder, 10) : 0;

        // 삽입 위치에 맞춰 기존 항목의 sortOrder를 +1씩 밀기 (+ 버튼으로 특정 위치 삽입 시)
        await FarmScheduleItem.update(
            { sortOrder: sequelize.literal('"sortOrder" + 1') },
            { where: { farmId, sortOrder: { [Op.gte]: insertOrder } }, transaction }
        );

        const created = await FarmScheduleItem.create({
            farmId,
            targetType: targetType || 'pig',
            structureTemplateId: structureTemplateId || null,
            basisTypeId: basisTypeId || null,
            ageLabel: ageLabel != null && String(ageLabel).trim() !== '' ? String(ageLabel).trim() : null,
            dayMin: dayMin != null ? parseInt(dayMin, 10) : null,
            dayMax: dayMax != null ? parseInt(dayMax, 10) : null,
            taskTypeId,
            description: description || null,
            sortOrder: insertOrder,
            isActive: isActive !== false,
            ...recurrence
        }, { transaction });

        await transaction.commit();
        const withInclude = await FarmScheduleItem.findByPk(created.id, { include: includeOpts });
        res.status(201).json(withInclude);
    } catch (error) {
        await transaction.rollback();
        console.error('농장 일정 추가 오류:', error);
        res.status(500).json({ error: '농장 일정 추가 중 오류가 발생했습니다.' });
    }
});

router.put('/:farmId/schedule-items/:id', isAuthenticated, checkFarmPermission, async (req, res) => {
    try {
        const { farmId, id } = req.params;
        const { targetType, structureTemplateId, basisTypeId, ageLabel, dayMin, dayMax, taskTypeId, description, sortOrder, isActive } = req.body;

        const row = await FarmScheduleItem.findOne({ where: { id, farmId } });
        if (!row) return res.status(404).json({ error: '농장 일정 항목을 찾을 수 없습니다.' });

        const recurrence = parseRecurrence(req.body);
        await row.update({
            targetType: targetType ?? row.targetType,
            structureTemplateId: structureTemplateId || null,
            basisTypeId: basisTypeId || null,
            ageLabel: ageLabel != null && String(ageLabel).trim() !== '' ? String(ageLabel).trim() : null,
            dayMin: dayMin != null ? parseInt(dayMin, 10) : null,
            dayMax: dayMax != null ? parseInt(dayMax, 10) : null,
            taskTypeId: taskTypeId ?? row.taskTypeId,
            description: description ?? row.description,
            sortOrder: sortOrder != null ? parseInt(sortOrder, 10) : row.sortOrder,
            isActive: isActive !== false,
            ...recurrence
        });

        const withInclude = await FarmScheduleItem.findByPk(row.id, { include: includeOpts });
        res.json(withInclude);
    } catch (error) {
        console.error('농장 일정 수정 오류:', error);
        res.status(500).json({ error: '농장 일정 수정 중 오류가 발생했습니다.' });
    }
});

router.delete('/:farmId/schedule-items/:id', isAuthenticated, checkFarmPermission, async (req, res) => {
    try {
        const { farmId, id } = req.params;
        const row = await FarmScheduleItem.findOne({ where: { id, farmId } });
        if (!row) return res.status(404).json({ error: '농장 일정 항목을 찾을 수 없습니다.' });
        await row.destroy();
        res.json({ message: '삭제되었습니다.' });
    } catch (error) {
        console.error('농장 일정 삭제 오류:', error);
        res.status(500).json({ error: '농장 일정 삭제 중 오류가 발생했습니다.' });
    }
});

// ----- 작업 계획 (farm_schedule_work_plans) -----
const workPlanInclude = [
    { model: FarmScheduleItem, as: 'scheduleItem', required: false, include: [{ model: FarmScheduleTaskType, as: 'taskType', attributes: ['id', 'code', 'name', 'category'] }] }
];

router.get('/:farmId/schedule-work-plans', isAuthenticated, checkFarmPermission, async (req, res) => {
    try {
        const { farmId } = req.params;
        const { from, to, taskTypeCategory, scheduleItemId, roomId, sectionId } = req.query;
        const where = { farmId };
        if (from && to) {
            where.plannedStartDate = { [Op.lte]: to };
            where.plannedEndDate = { [Op.gte]: from };
        }
        if (taskTypeCategory) where.taskTypeCategory = taskTypeCategory;
        if (scheduleItemId) where.farmScheduleItemId = scheduleItemId;
        if (roomId) where.roomId = roomId;
        if (sectionId) where.sectionId = sectionId;

        const list = await FarmScheduleWorkPlan.findAll({
            where,
            include: workPlanInclude,
            order: [['plannedStartDate', 'ASC'], ['id', 'ASC']]
        });
        res.json(list);
    } catch (error) {
        console.error('작업 계획 조회 오류:', error);
        res.status(500).json({ error: '작업 계획 목록을 불러오는 중 오류가 발생했습니다.' });
    }
});

router.post('/:farmId/schedule-work-plans', isAuthenticated, checkFarmPermission, async (req, res) => {
    try {
        const { farmId } = req.params;
        let farmScheduleItemId = req.body.farmScheduleItemId != null && req.body.farmScheduleItemId !== '' ? parseInt(req.body.farmScheduleItemId, 10) : null;
        let plannedStartDate = req.body.plannedStartDate != null ? String(req.body.plannedStartDate).trim() : '';
        let plannedEndDate = req.body.plannedEndDate != null ? String(req.body.plannedEndDate).trim() : '';
        const roomId = req.body.roomId;
        const sectionId = req.body.sectionId;
        const entrySource = req.body.entrySource;
        const entryCount = req.body.entryCount;
        const completedDate = req.body.completedDate;
        const bodyBreedType = req.body.breedType;

        const hasEntrySource = entrySource != null && String(entrySource).trim() !== '';
        const hasEntryCount = entryCount != null && entryCount !== '' && Number(entryCount) > 0;
        const hasPlannedDate = req.body.plannedDate != null && String(req.body.plannedDate).trim() !== '';
        const hasCompletedDate = completedDate != null && String(completedDate).trim() !== '';
        const hasRoomOrSection = (roomId != null && roomId !== '') || (sectionId != null && sectionId !== '');
        const isEntryRequest = hasEntrySource || hasEntryCount || hasPlannedDate || hasCompletedDate || (!farmScheduleItemId && hasRoomOrSection);

        if (isEntryRequest) {
            if (!plannedStartDate && hasPlannedDate) plannedStartDate = String(req.body.plannedDate).trim();
            if (!plannedStartDate && hasCompletedDate) plannedStartDate = String(completedDate).trim();
            if (!plannedStartDate) plannedStartDate = new Date().toISOString().slice(0, 10);
            if (!plannedEndDate) plannedEndDate = plannedStartDate;
        } else {
            if (!plannedStartDate && hasPlannedDate) plannedStartDate = String(req.body.plannedDate).trim();
            if (!plannedEndDate && plannedStartDate) plannedEndDate = plannedStartDate;
            if (!plannedStartDate && hasCompletedDate) {
                plannedStartDate = String(completedDate).trim();
                if (!plannedEndDate) plannedEndDate = plannedStartDate;
            }
        }

        const isEntryWithoutItem = !farmScheduleItemId && isEntryRequest;
        if (isEntryWithoutItem) {
            const { scheduleItem: defaultItem } = await ensureDefaultEntryScheduleItem(farmId);
            farmScheduleItemId = defaultItem.id;
        }

        if (!farmScheduleItemId) {
            return res.status(400).json({ error: '일정 항목을 찾을 수 없습니다.' });
        }
        if (!plannedStartDate || !plannedEndDate) {
            plannedStartDate = plannedStartDate || new Date().toISOString().slice(0, 10);
            plannedEndDate = plannedEndDate || plannedStartDate;
        }
        if (plannedStartDate > plannedEndDate) {
            return res.status(400).json({ error: '예정 시작일은 예정 종료일 이전이어야 합니다.' });
        }

        const scheduleItem = await FarmScheduleItem.findOne({
            where: { id: farmScheduleItemId, farmId },
            include: [{ model: FarmScheduleTaskType, as: 'taskType', attributes: ['id', 'code', 'name', 'category'] }]
        });
        if (!scheduleItem) {
            return res.status(404).json({ error: '해당 농장의 일정 항목을 찾을 수 없습니다.' });
        }

        let finalRoomId = roomId || null;
        let finalSectionId = sectionId || null;
        if (roomId) {
            const room = await FarmRoom.findOne({ where: { id: roomId, farmId } });
            if (!room) return res.status(400).json({ error: '대상 방이 이 농장 소속이 아닙니다.' });
        }
        if (sectionId) {
            const section = await FarmSection.findOne({ where: { id: sectionId, farmId } });
            if (!section) return res.status(400).json({ error: '대상 칸이 이 농장 소속이 아닙니다.' });
        }

        const taskTypeCategory = (scheduleItem.taskType && scheduleItem.taskType.category) ? scheduleItem.taskType.category : null;

        const created = await FarmScheduleWorkPlan.create({
            farmId,
            farmScheduleItemId,
            taskTypeCategory,
            roomId: finalRoomId,
            sectionId: finalSectionId,
            plannedStartDate,
            plannedEndDate,
            entrySource: entrySource != null ? String(entrySource).trim() || null : null,
            entryCount: entryCount != null && entryCount !== '' ? parseInt(entryCount, 10) : null,
            completedDate: completedDate && String(completedDate).trim() ? String(completedDate).trim() : null
        });

        const entryCountNum = entryCount != null && entryCount !== '' ? parseInt(entryCount, 10) : null;
        const isEntryCompleted = taskTypeCategory === 'entry' && completedDate && String(completedDate).trim() && entryCountNum != null && entryCountNum > 0;
        const breedTypeVal = bodyBreedType && String(bodyBreedType).trim() ? String(bodyBreedType).trim() : null;
        if (isEntryCompleted) {
            const groupNo = 'ENT-' + Date.now();
            const pigGroup = await PigGroup.create({
                farmId,
                groupNo,
                currentSectionId: finalSectionId,
                entryDate: String(completedDate).trim(),
                headcount: entryCountNum,
                status: 'active',
                breedType: breedTypeVal,
                memo: entrySource ? String(entrySource).trim() : null
            });
            const movedAt = new Date(String(completedDate).trim() + 'T12:00:00');
            await PigMovement.create({
                farmId,
                pigGroupId: pigGroup.id,
                fromSectionId: null,
                toSectionId: finalSectionId,
                movedAt,
                headcount: entryCountNum,
                movementType: 'entry',
                scheduleItemId: farmScheduleItemId,
                movedBy: req.session && req.session.userId ? req.session.userId : null,
                memo: entrySource ? String(entrySource).trim() : null
            });
        }

        const withInclude = await FarmScheduleWorkPlan.findByPk(created.id, { include: workPlanInclude });
        res.status(201).json(withInclude);
    } catch (error) {
        console.error('작업 계획 추가 오류:', error);
        res.status(500).json({ error: '작업 계획 추가 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
