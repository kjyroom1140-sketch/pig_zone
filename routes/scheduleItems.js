const express = require('express');
const router = express.Router();
const { ScheduleItem, StructureTemplate, ScheduleTaskType, ScheduleBasisType } = require('../models');
const { expandRecurrence } = require('../utils/recurrence');

router.get('/', async (req, res) => {
    try {
        const { targetType, structureTemplateId, taskTypeId, basisTypeId } = req.query;
        const where = {};
        if (targetType) where.targetType = targetType;
        if (structureTemplateId) where.structureTemplateId = structureTemplateId;
        if (taskTypeId) where.taskTypeId = taskTypeId;
        if (basisTypeId) where.basisTypeId = basisTypeId;

        const list = await ScheduleItem.findAll({
            where,
            include: [
                { model: StructureTemplate, as: 'structureTemplate', attributes: ['id', 'name', 'category'] },
                { model: ScheduleTaskType, as: 'taskType', attributes: ['id', 'code', 'name'] },
                { model: ScheduleBasisType, as: 'basisTypeRef', attributes: ['id', 'code', 'name'] }
            ],
            order: [['sortOrder', 'ASC'], ['id', 'ASC']]
        });
        res.json(list);
    } catch (error) {
        console.error('일정 항목 조회 오류:', error);
        res.status(500).json({ error: error.message || '일정 항목 목록을 불러오는 중 오류가 발생했습니다.' });
    }
});

// 기간별 발생 목록 (반복 일정 확장). ?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/occurrences', async (req, res) => {
    try {
        const { start: startStr, end: endStr } = req.query;
        const start = startStr ? new Date(startStr) : new Date();
        const end = endStr ? new Date(endStr) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
            return res.status(400).json({ error: 'start, end는 YYYY-MM-DD 형식이어야 합니다.' });
        }
        const items = await ScheduleItem.findAll({
            where: { isActive: true },
            include: [
                { model: StructureTemplate, as: 'structureTemplate', attributes: ['id', 'name'] },
                { model: ScheduleTaskType, as: 'taskType', attributes: ['id', 'name'] }
            ],
            order: [['sortOrder', 'ASC'], ['id', 'ASC']]
        });
        const occurrences = [];
        for (const item of items) {
            const list = expandRecurrence(item.toJSON(), start, end);
            for (const o of list) {
                occurrences.push({ ...o, id: `occ-${item.id}-${o.date}` });
            }
        }
        occurrences.sort((a, b) => a.date.localeCompare(b.date) || a.scheduleItemId - b.scheduleItemId);
        res.json({ occurrences });
    } catch (error) {
        console.error('occurrences 조회 오류:', error);
        res.status(500).json({ error: '기간별 일정을 불러오는 중 오류가 발생했습니다.' });
    }
});

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

router.post('/', async (req, res) => {
    try {
        const { targetType, structureTemplateId, basisTypeId, ageLabel, dayMin, dayMax, taskTypeId, description, sortOrder, isActive } = req.body;
        const recurrence = parseRecurrence(req.body);
        const created = await ScheduleItem.create({
            targetType: targetType || 'pig',
            structureTemplateId: structureTemplateId || null,
            basisTypeId: basisTypeId || null,
            ageLabel: ageLabel != null && String(ageLabel).trim() !== '' ? String(ageLabel).trim() : null,
            dayMin: dayMin != null ? parseInt(dayMin, 10) : null,
            dayMax: dayMax != null ? parseInt(dayMax, 10) : null,
            taskTypeId,
            description: description || null,
            sortOrder: sortOrder != null ? parseInt(sortOrder, 10) : 0,
            isActive: isActive !== false,
            ...recurrence
        });
        const withInclude = await ScheduleItem.findByPk(created.id, {
            include: [
                { model: StructureTemplate, as: 'structureTemplate', attributes: ['id', 'name', 'category'] },
                { model: ScheduleTaskType, as: 'taskType', attributes: ['id', 'code', 'name'] },
                { model: ScheduleBasisType, as: 'basisTypeRef', attributes: ['id', 'code', 'name'] }
            ]
        });
        res.status(201).json(withInclude);
    } catch (error) {
        console.error('일정 항목 추가 오류:', error);
        res.status(500).json({ error: error.message || '일정 항목 추가 중 오류가 발생했습니다.' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { targetType, structureTemplateId, basisTypeId, ageLabel, dayMin, dayMax, taskTypeId, description, sortOrder, isActive } = req.body;
        const row = await ScheduleItem.findByPk(id);
        if (!row) return res.status(404).json({ error: '일정 항목을 찾을 수 없습니다.' });
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
        const withInclude = await ScheduleItem.findByPk(id, {
            include: [
                { model: StructureTemplate, as: 'structureTemplate', attributes: ['id', 'name', 'category'] },
                { model: ScheduleTaskType, as: 'taskType', attributes: ['id', 'code', 'name'] },
                { model: ScheduleBasisType, as: 'basisTypeRef', attributes: ['id', 'code', 'name'] }
            ]
        });
        res.json(withInclude);
    } catch (error) {
        console.error('일정 항목 수정 오류:', error);
        res.status(500).json({ error: error.message || '일정 항목 수정 중 오류가 발생했습니다.' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const row = await ScheduleItem.findByPk(id);
        if (!row) return res.status(404).json({ error: '일정 항목을 찾을 수 없습니다.' });
        await row.destroy();
        res.json({ message: '삭제되었습니다.' });
    } catch (error) {
        console.error('일정 항목 삭제 오류:', error);
        res.status(500).json({ error: '일정 항목 삭제 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
