/**
 * 세부 작업유형 (schedule_work_detail_types)
 * 대상 장소·구분은 조인 테이블로 다중 선택 (structureScopes, divisionScopes)
 */
const express = require('express');
const router = express.Router();
const { ScheduleWorkDetailType, ScheduleWorkType, ScheduleWorkDetailTypeStructure, ScheduleWorkDetailTypeDivision, StructureTemplate, ScheduleDivision, ScheduleItem } = require('../models');
const { Op } = require('sequelize');

router.get('/', async (req, res) => {
    try {
        const workTypeId = req.query.workTypeId != null && req.query.workTypeId !== '' ? req.query.workTypeId : null;
        const structureTemplateId = req.query.structureTemplateId != null && req.query.structureTemplateId !== '' ? req.query.structureTemplateId : null;
        const divisionId = req.query.divisionId != null && req.query.divisionId !== '' ? req.query.divisionId : null;
        const appliesToScope = req.query.appliesToScope;
        const conditions = [];
        if (workTypeId != null) conditions.push({ workTypeId });
        const where = conditions.length ? { [Op.and]: conditions } : {};
        let include = [
            { model: ScheduleWorkType, as: 'workType', attributes: ['id', 'code', 'name', 'appliesToScope'] },
            { model: ScheduleWorkDetailTypeStructure, as: 'structureScopes', required: false, include: [{ model: StructureTemplate, as: 'structureTemplate', attributes: ['id', 'name'] }] },
            { model: ScheduleWorkDetailTypeDivision, as: 'divisionScopes', required: false, include: [{ model: ScheduleDivision, as: 'division', attributes: ['id', 'name'] }] }
        ];
        if (appliesToScope && workTypeId == null) {
            include[0].where = { appliesToScope: { [Op.in]: [appliesToScope, 'both'] } };
            include[0].required = true;
        }
        let list = await ScheduleWorkDetailType.findAll({
            where: Object.keys(where).length ? where : undefined,
            include,
            order: [['sortOrder', 'ASC'], ['id', 'ASC']]
        });
        if (structureTemplateId != null) {
            const sid = parseInt(structureTemplateId, 10);
            list = list.filter(row => {
                const scopes = row.structureScopes || [];
                if (scopes.length === 0) return true;
                return scopes.some(s => s.structureTemplateId === sid);
            });
        }
        if (divisionId != null) {
            const did = parseInt(divisionId, 10);
            list = list.filter(row => {
                const scopes = row.divisionScopes || [];
                if (scopes.length === 0) return true;
                return scopes.some(d => d.divisionId === did);
            });
        }
        const payload = list.map(row => {
            const structureTemplates = (row.structureScopes || []).map(s => s.structureTemplate).filter(Boolean);
            const divisions = (row.divisionScopes || []).map(d => d.division).filter(Boolean);
            return { ...row.toJSON(), structureTemplates, divisions };
        });
        res.json(payload);
    } catch (error) {
        console.error('세부 작업유형 조회 오류:', error);
        res.status(500).json({ error: '세부 작업유형 목록을 불러오는 중 오류가 발생했습니다.' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { workTypeId, structureTemplateIds, divisionIds, code, name, sortOrder } = req.body;
        const created = await ScheduleWorkDetailType.create({
            workTypeId: workTypeId,
            code: code || null,
            name: name || '',
            sortOrder: sortOrder != null ? parseInt(sortOrder, 10) : 0
        });
        const sIds = Array.isArray(structureTemplateIds) ? structureTemplateIds.filter(Boolean).map(id => parseInt(id, 10)).filter(n => !isNaN(n)) : [];
        const dIds = Array.isArray(divisionIds) ? divisionIds.filter(Boolean).map(id => parseInt(id, 10)).filter(n => !isNaN(n)) : [];
        await Promise.all([
            ...sIds.map(sid => ScheduleWorkDetailTypeStructure.create({ workDetailTypeId: created.id, structureTemplateId: sid })),
            ...dIds.map(did => ScheduleWorkDetailTypeDivision.create({ workDetailTypeId: created.id, divisionId: did }))
        ]);
        const full = await ScheduleWorkDetailType.findByPk(created.id, {
            include: [
                { model: ScheduleWorkType, as: 'workType', attributes: ['id', 'code', 'name', 'appliesToScope'] },
                { model: ScheduleWorkDetailTypeStructure, as: 'structureScopes', include: [{ model: StructureTemplate, as: 'structureTemplate', attributes: ['id', 'name'] }] },
                { model: ScheduleWorkDetailTypeDivision, as: 'divisionScopes', include: [{ model: ScheduleDivision, as: 'division', attributes: ['id', 'name'] }] }
            ]
        });
        const structureTemplates = (full.structureScopes || []).map(s => s.structureTemplate).filter(Boolean);
        const divisions = (full.divisionScopes || []).map(d => d.division).filter(Boolean);
        res.status(201).json({ ...full.toJSON(), structureTemplates, divisions });
    } catch (error) {
        console.error('세부 작업유형 추가 오류:', error);
        res.status(500).json({ error: error.message || '세부 작업유형 추가 중 오류가 발생했습니다.' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const row = await ScheduleWorkDetailType.findByPk(req.params.id);
        if (!row) return res.status(404).json({ error: '세부 작업유형을 찾을 수 없습니다.' });
        const { workTypeId, structureTemplateIds, divisionIds, code, name, sortOrder } = req.body;
        await row.update({
            workTypeId: workTypeId !== undefined ? workTypeId : row.workTypeId,
            code: code !== undefined ? code : row.code,
            name: name !== undefined ? name : row.name,
            sortOrder: sortOrder !== undefined ? parseInt(sortOrder, 10) : row.sortOrder
        });
        if (structureTemplateIds !== undefined) {
            await ScheduleWorkDetailTypeStructure.destroy({ where: { workDetailTypeId: row.id } });
            const sIds = Array.isArray(structureTemplateIds) ? structureTemplateIds.filter(Boolean).map(id => parseInt(id, 10)).filter(n => !isNaN(n)) : [];
            await Promise.all(sIds.map(sid => ScheduleWorkDetailTypeStructure.create({ workDetailTypeId: row.id, structureTemplateId: sid })));
        }
        if (divisionIds !== undefined) {
            await ScheduleWorkDetailTypeDivision.destroy({ where: { workDetailTypeId: row.id } });
            const dIds = Array.isArray(divisionIds) ? divisionIds.filter(Boolean).map(id => parseInt(id, 10)).filter(n => !isNaN(n)) : [];
            await Promise.all(dIds.map(did => ScheduleWorkDetailTypeDivision.create({ workDetailTypeId: row.id, divisionId: did })));
        }
        const full = await ScheduleWorkDetailType.findByPk(row.id, {
            include: [
                { model: ScheduleWorkType, as: 'workType', attributes: ['id', 'code', 'name', 'appliesToScope'] },
                { model: ScheduleWorkDetailTypeStructure, as: 'structureScopes', include: [{ model: StructureTemplate, as: 'structureTemplate', attributes: ['id', 'name'] }] },
                { model: ScheduleWorkDetailTypeDivision, as: 'divisionScopes', include: [{ model: ScheduleDivision, as: 'division', attributes: ['id', 'name'] }] }
            ]
        });
        const structureTemplates = (full.structureScopes || []).map(s => s.structureTemplate).filter(Boolean);
        const divisions = (full.divisionScopes || []).map(d => d.division).filter(Boolean);
        res.json({ ...full.toJSON(), structureTemplates, divisions });
    } catch (error) {
        console.error('세부 작업유형 수정 오류:', error);
        res.status(500).json({ error: error.message || '세부 작업유형 수정 중 오류가 발생했습니다.' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: '잘못된 ID입니다.' });
        const row = await ScheduleWorkDetailType.findByPk(id);
        if (!row) return res.status(404).json({ error: '세부 작업유형을 찾을 수 없습니다.' });
        const usedByItems = await ScheduleItem.count({ where: { workDetailTypeId: id } });
        if (usedByItems > 0) {
            return res.status(409).json({
                error: `이 작업 내용을 사용하는 일정 항목이 ${usedByItems}건 있어 삭제할 수 없습니다. 해당 일정 항목을 먼저 수정하거나 삭제하세요.`
            });
        }
        await row.destroy();
        res.json({ message: '삭제되었습니다.' });
    } catch (error) {
        console.error('세부 작업유형 삭제 오류:', error);
        res.status(500).json({ error: error.message || '세부 작업유형 삭제 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
