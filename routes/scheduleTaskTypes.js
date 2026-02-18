const express = require('express');
const router = express.Router();
const { ScheduleItemType, ScheduleTaskTypeStructure, StructureTemplate } = require('../models');
const { Op } = require('sequelize');

const TASK_KIND = 'task';

router.get('/', async (req, res) => {
    try {
        const structureTemplateId = req.query.structureTemplateId ? String(req.query.structureTemplateId).trim() : null;
        const include = [
            { model: ScheduleTaskTypeStructure, as: 'structureScopes', attributes: ['structureTemplateId'], include: [{ model: StructureTemplate, as: 'structureTemplate', attributes: ['id', 'name'] }] }
        ];
        let where = { kind: TASK_KIND };
        if (structureTemplateId) {
            const scopedRows = await ScheduleTaskTypeStructure.findAll({ where: { structureTemplateId }, attributes: ['scheduleTaskTypeId'] });
            const scopedIds = scopedRows.map(r => r.scheduleTaskTypeId);
            where = { ...where, [Op.or]: [{ appliesToAllStructures: true }, ...(scopedIds.length ? [{ id: { [Op.in]: scopedIds } }] : []) ] };
        }
        const list = await ScheduleItemType.findAll({
            where,
            include,
            order: [['sortOrder', 'ASC'], ['id', 'ASC']]
        });
        res.json(list);
    } catch (error) {
        console.error('작업 유형 조회 오류:', error);
        const message = error.message || '작업 유형 목록을 불러오는 중 오류가 발생했습니다.';
        res.status(500).json({ error: message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { code, name, category, sortOrder, appliesToAllStructures, structureTemplateIds } = req.body;
        const created = await ScheduleItemType.create({
            kind: TASK_KIND,
            code: code || null,
            name: name || '',
            category: category || null,
            sortOrder: sortOrder != null ? sortOrder : 0,
            appliesToAllStructures: appliesToAllStructures !== false
        });
        if (created.appliesToAllStructures === false && Array.isArray(structureTemplateIds) && structureTemplateIds.length > 0) {
            await ScheduleTaskTypeStructure.bulkCreate(
                structureTemplateIds.filter(id => id != null && String(id).trim() !== '').map(sid => ({ scheduleTaskTypeId: created.id, structureTemplateId: parseInt(sid, 10) }))
            );
        }
        const withScopes = await ScheduleItemType.findByPk(created.id, {
            include: [{ model: ScheduleTaskTypeStructure, as: 'structureScopes', include: [{ model: StructureTemplate, as: 'structureTemplate', attributes: ['id', 'name'] }] }]
        });
        res.status(201).json(withScopes || created);
    } catch (error) {
        console.error('작업 유형 추가 오류:', error);
        const message = error.message || '작업 유형 추가 중 오류가 발생했습니다.';
        res.status(500).json({ error: message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { code, name, category, sortOrder, appliesToAllStructures, structureTemplateIds } = req.body;
        const row = await ScheduleItemType.findOne({ where: { id, kind: TASK_KIND } });
        if (!row) return res.status(404).json({ error: '작업 유형을 찾을 수 없습니다.' });
        await row.update({
            code: code !== undefined ? code : row.code,
            name: name !== undefined ? name : row.name,
            category: category !== undefined ? category : row.category,
            sortOrder: sortOrder !== undefined ? sortOrder : row.sortOrder,
            appliesToAllStructures: appliesToAllStructures !== false
        });
        await ScheduleTaskTypeStructure.destroy({ where: { scheduleTaskTypeId: row.id } });
        if (appliesToAllStructures === false && Array.isArray(structureTemplateIds) && structureTemplateIds.length > 0) {
            await ScheduleTaskTypeStructure.bulkCreate(
                structureTemplateIds.filter(sid => sid != null && String(sid).trim() !== '').map(sid => ({ scheduleTaskTypeId: row.id, structureTemplateId: parseInt(sid, 10) }))
            );
        }
        const withScopes = await ScheduleItemType.findByPk(row.id, {
            include: [{ model: ScheduleTaskTypeStructure, as: 'structureScopes', include: [{ model: StructureTemplate, as: 'structureTemplate', attributes: ['id', 'name'] }] }]
        });
        res.json(withScopes || row);
    } catch (error) {
        console.error('작업 유형 수정 오류:', error);
        const message = error.message || '작업 유형 수정 중 오류가 발생했습니다.';
        res.status(500).json({ error: message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const row = await ScheduleItemType.findOne({ where: { id, kind: TASK_KIND } });
        if (!row) return res.status(404).json({ error: '작업 유형을 찾을 수 없습니다.' });
        await row.destroy();
        res.json({ message: '삭제되었습니다.' });
    } catch (error) {
        console.error('작업 유형 삭제 오류:', error);
        res.status(500).json({ error: '작업 유형 삭제 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
