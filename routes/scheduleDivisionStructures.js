/**
 * 구분 ↔ 대상장소 매핑 (schedule_division_structures)
 * docs: schedule_structure_design.md — 어떤 구분에 어떤 structure_templates 적용 가능한지
 */
const express = require('express');
const router = express.Router();
const { ScheduleDivisionStructure, ScheduleDivision, StructureTemplate } = require('../models');

router.get('/', async (req, res) => {
    try {
        const divisionId = req.query.divisionId != null && req.query.divisionId !== '' ? req.query.divisionId : null;
        const structureTemplateId = req.query.structureTemplateId != null && req.query.structureTemplateId !== '' ? req.query.structureTemplateId : null;
        const where = {};
        if (divisionId != null) where.divisionId = divisionId;
        if (structureTemplateId != null) where.structureTemplateId = structureTemplateId;
        const list = await ScheduleDivisionStructure.findAll({
            where: Object.keys(where).length ? where : undefined,
            include: [
                { model: ScheduleDivision, as: 'division', attributes: ['id', 'code', 'name'] },
                { model: StructureTemplate, as: 'structureTemplate', attributes: ['id', 'name', 'category'] }
            ],
            order: [['sortOrder', 'ASC'], ['id', 'ASC']]
        });
        res.json(list);
    } catch (error) {
        console.error('구분-장소 매핑 조회 오류:', error);
        res.status(500).json({ error: '구분-장소 매핑 목록을 불러오는 중 오류가 발생했습니다.' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { divisionId, structureTemplateId, sortOrder } = req.body;
        const created = await ScheduleDivisionStructure.create({
            divisionId,
            structureTemplateId,
            sortOrder: sortOrder != null ? parseInt(sortOrder, 10) : 0
        });
        const withInclude = await ScheduleDivisionStructure.findByPk(created.id, {
            include: [
                { model: ScheduleDivision, as: 'division', attributes: ['id', 'code', 'name'] },
                { model: StructureTemplate, as: 'structureTemplate', attributes: ['id', 'name'] }
            ]
        });
        res.status(201).json(withInclude || created);
    } catch (error) {
        console.error('구분-장소 매핑 추가 오류:', error);
        res.status(500).json({ error: error.message || '구분-장소 매핑 추가 중 오류가 발생했습니다.' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const row = await ScheduleDivisionStructure.findByPk(req.params.id);
        if (!row) return res.status(404).json({ error: '구분-장소 매핑을 찾을 수 없습니다.' });
        const { divisionId, structureTemplateId, sortOrder } = req.body;
        await row.update({
            divisionId: divisionId !== undefined ? divisionId : row.divisionId,
            structureTemplateId: structureTemplateId !== undefined ? structureTemplateId : row.structureTemplateId,
            sortOrder: sortOrder !== undefined ? parseInt(sortOrder, 10) : row.sortOrder
        });
        const withInclude = await ScheduleDivisionStructure.findByPk(row.id, {
            include: [
                { model: ScheduleDivision, as: 'division', attributes: ['id', 'code', 'name'] },
                { model: StructureTemplate, as: 'structureTemplate', attributes: ['id', 'name'] }
            ]
        });
        res.json(withInclude || row);
    } catch (error) {
        console.error('구분-장소 매핑 수정 오류:', error);
        res.status(500).json({ error: error.message || '구분-장소 매핑 수정 중 오류가 발생했습니다.' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const row = await ScheduleDivisionStructure.findByPk(req.params.id);
        if (!row) return res.status(404).json({ error: '구분-장소 매핑을 찾을 수 없습니다.' });
        await row.destroy();
        res.json({ message: '삭제되었습니다.' });
    } catch (error) {
        console.error('구분-장소 매핑 삭제 오류:', error);
        res.status(500).json({ error: '구분-장소 매핑 삭제 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
