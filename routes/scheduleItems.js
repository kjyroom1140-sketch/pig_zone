/**
 * 전역 일정 항목 (schedule_items)
 * docs: schedule_structure_design.md — 구분·대상장소·기준·작업유형(세부) + 일수·반복
 */
const express = require('express');
const router = express.Router();
const {
    ScheduleItem,
    ScheduleDivision,
    StructureTemplate,
    ScheduleBase,
    ScheduleWorkDetailType,
    ScheduleWorkType
} = require('../models');

const defaultInclude = [
    { model: ScheduleDivision, as: 'division', attributes: ['id', 'code', 'name'] },
    { model: StructureTemplate, as: 'structureTemplate', attributes: ['id', 'name', 'category'] },
    { model: ScheduleBase, as: 'basis', attributes: ['id', 'name'] },
    { model: ScheduleWorkDetailType, as: 'workDetailType', attributes: ['id', 'code', 'name'], include: [{ model: ScheduleWorkType, as: 'workType', attributes: ['id', 'code', 'name', 'appliesToScope', 'divisionId'] }] }
];

router.get('/', async (req, res) => {
    try {
        const { divisionId, structureTemplateId, basisId, workDetailTypeId } = req.query;
        const where = {};
        if (divisionId != null && divisionId !== '') where.divisionId = divisionId;
        if (structureTemplateId != null && structureTemplateId !== '') where.structureTemplateId = structureTemplateId;
        if (basisId != null && basisId !== '') where.basisId = basisId;
        if (workDetailTypeId != null && workDetailTypeId !== '') where.workDetailTypeId = workDetailTypeId;

        const list = await ScheduleItem.findAll({
            where,
            include: defaultInclude,
            order: [['sortOrder', 'ASC'], ['id', 'ASC']]
        });
        res.json(list);
    } catch (error) {
        console.error('일정 항목 조회 오류:', error);
        res.status(500).json({ error: error.message || '일정 항목 목록을 불러오는 중 오류가 발생했습니다.' });
    }
});

function parseRecurrence(body) {
    const recurrenceType = (body.recurrenceType || '').trim() || null;
    return {
        recurrenceType,
        recurrenceInterval: recurrenceType && body.recurrenceInterval != null ? parseInt(body.recurrenceInterval, 10) : null,
        recurrenceWeekdays: recurrenceType && body.recurrenceWeekdays != null ? String(body.recurrenceWeekdays).trim() || null : null,
        recurrenceMonthDay: recurrenceType && body.recurrenceMonthDay !== '' && body.recurrenceMonthDay != null ? parseInt(body.recurrenceMonthDay, 10) : null,
        recurrenceStartDate: (body.recurrenceStartDate || '').trim() || null,
        recurrenceEndDate: (body.recurrenceEndDate || '').trim() || null
    };
}

router.post('/', async (req, res) => {
    try {
        const {
            divisionId,
            structureTemplateId,
            basisId,
            workDetailTypeId,
            dayMin,
            dayMax,
            sortOrder,
            isActive,
            appliesToAllStructures
        } = req.body;
        const recurrence = parseRecurrence(req.body);
        const created = await ScheduleItem.create({
            divisionId,
            structureTemplateId: structureTemplateId || null,
            basisId,
            workDetailTypeId,
            dayMin: dayMin != null ? parseInt(dayMin, 10) : null,
            dayMax: dayMax != null ? parseInt(dayMax, 10) : null,
            sortOrder: sortOrder != null ? parseInt(sortOrder, 10) : 0,
            isActive: isActive !== false,
            appliesToAllStructures: appliesToAllStructures === true || appliesToAllStructures === 'true',
            ...recurrence
        });
        const withInclude = await ScheduleItem.findByPk(created.id, { include: defaultInclude });
        res.status(201).json(withInclude);
    } catch (error) {
        console.error('일정 항목 추가 오류:', error);
        res.status(500).json({ error: error.message || '일정 항목 추가 중 오류가 발생했습니다.' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const row = await ScheduleItem.findByPk(req.params.id);
        if (!row) return res.status(404).json({ error: '일정 항목을 찾을 수 없습니다.' });
        const {
            divisionId,
            structureTemplateId,
            basisId,
            workDetailTypeId,
            dayMin,
            dayMax,
            sortOrder,
            isActive,
            appliesToAllStructures
        } = req.body;
        const recurrence = parseRecurrence(req.body);
        await row.update({
            divisionId: divisionId ?? row.divisionId,
            structureTemplateId: structureTemplateId !== undefined ? (structureTemplateId || null) : row.structureTemplateId,
            basisId: basisId ?? row.basisId,
            workDetailTypeId: workDetailTypeId ?? row.workDetailTypeId,
            dayMin: dayMin != null ? parseInt(dayMin, 10) : row.dayMin,
            dayMax: dayMax != null ? parseInt(dayMax, 10) : row.dayMax,
            sortOrder: sortOrder != null ? parseInt(sortOrder, 10) : row.sortOrder,
            isActive: isActive !== false,
            appliesToAllStructures: appliesToAllStructures !== undefined ? (appliesToAllStructures === true || appliesToAllStructures === 'true') : row.appliesToAllStructures,
            ...recurrence
        });
        const withInclude = await ScheduleItem.findByPk(row.id, { include: defaultInclude });
        res.json(withInclude);
    } catch (error) {
        console.error('일정 항목 수정 오류:', error);
        res.status(500).json({ error: error.message || '일정 항목 수정 중 오류가 발생했습니다.' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const row = await ScheduleItem.findByPk(req.params.id);
        if (!row) return res.status(404).json({ error: '일정 항목을 찾을 수 없습니다.' });
        await row.destroy();
        res.json({ message: '삭제되었습니다.' });
    } catch (error) {
        console.error('일정 항목 삭제 오류:', error);
        res.status(500).json({ error: '일정 항목 삭제 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
