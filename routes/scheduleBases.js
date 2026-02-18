/**
 * 전역 일정 기준 (schedule_bases)
 * docs: schedule_structure_design.md — 전입일, 입식일, 교배일, 분만일 등
 */
const express = require('express');
const router = express.Router();
const { ScheduleBase, ScheduleDivision } = require('../models');

router.get('/', async (req, res) => {
    try {
        const divisionId = req.query.divisionId != null && req.query.divisionId !== '' ? req.query.divisionId : null;
        const where = {};
        if (divisionId != null) where.divisionId = divisionId;
        const list = await ScheduleBase.findAll({
            where: Object.keys(where).length ? where : undefined,
            include: [{ model: ScheduleDivision, as: 'division', attributes: ['id', 'code', 'name'], required: false }],
            order: [['sortOrder', 'ASC'], ['id', 'ASC']]
        });
        res.json(list);
    } catch (error) {
        console.error('기준 유형 조회 오류:', error);
        res.status(500).json({ error: '기준 유형 목록을 불러오는 중 오류가 발생했습니다.' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { name, description, divisionId, sortOrder } = req.body;
        const created = await ScheduleBase.create({
            name: name || '',
            description: description != null ? String(description).trim() || null : null,
            divisionId: divisionId || null,
            sortOrder: sortOrder != null ? parseInt(sortOrder, 10) : 0
        });
        res.status(201).json(created);
    } catch (error) {
        console.error('기준 유형 추가 오류:', error);
        res.status(500).json({ error: error.message || '기준 유형 추가 중 오류가 발생했습니다.' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const row = await ScheduleBase.findByPk(req.params.id);
        if (!row) return res.status(404).json({ error: '기준 유형을 찾을 수 없습니다.' });
        const { name, description, divisionId, sortOrder } = req.body;
        await row.update({
            name: name !== undefined ? name : row.name,
            description: description !== undefined ? (description != null ? String(description).trim() || null : null) : row.description,
            divisionId: divisionId !== undefined ? (divisionId || null) : row.divisionId,
            sortOrder: sortOrder !== undefined ? parseInt(sortOrder, 10) : row.sortOrder
        });
        res.json(row);
    } catch (error) {
        console.error('기준 유형 수정 오류:', error);
        res.status(500).json({ error: error.message || '기준 유형 수정 중 오류가 발생했습니다.' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const row = await ScheduleBase.findByPk(req.params.id);
        if (!row) return res.status(404).json({ error: '기준 유형을 찾을 수 없습니다.' });
        await row.destroy();
        res.json({ message: '삭제되었습니다.' });
    } catch (error) {
        console.error('기준 유형 삭제 오류:', error);
        res.status(500).json({ error: '기준 유형 삭제 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
