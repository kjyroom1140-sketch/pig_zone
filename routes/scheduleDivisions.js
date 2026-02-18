/**
 * 전역 일정 구분 (schedule_divisions)
 * docs: schedule_structure_design.md — 모돈, 옹돈, 자돈, 비번식돈, 시설
 */
const express = require('express');
const router = express.Router();
const { ScheduleDivision } = require('../models');

router.get('/', async (req, res) => {
    try {
        const list = await ScheduleDivision.findAll({
            order: [['sortOrder', 'ASC'], ['id', 'ASC']]
        });
        res.json(list);
    } catch (error) {
        console.error('구분 조회 오류:', error);
        res.status(500).json({ error: '구분 목록을 불러오는 중 오류가 발생했습니다.' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { code, name, sortOrder } = req.body;
        const created = await ScheduleDivision.create({
            code: code || null,
            name: name || '',
            sortOrder: sortOrder != null ? parseInt(sortOrder, 10) : 0
        });
        res.status(201).json(created);
    } catch (error) {
        console.error('구분 추가 오류:', error);
        res.status(500).json({ error: error.message || '구분 추가 중 오류가 발생했습니다.' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const row = await ScheduleDivision.findByPk(req.params.id);
        if (!row) return res.status(404).json({ error: '구분을 찾을 수 없습니다.' });
        const { code, name, sortOrder } = req.body;
        await row.update({
            code: code !== undefined ? code : row.code,
            name: name !== undefined ? name : row.name,
            sortOrder: sortOrder !== undefined ? parseInt(sortOrder, 10) : row.sortOrder
        });
        res.json(row);
    } catch (error) {
        console.error('구분 수정 오류:', error);
        res.status(500).json({ error: error.message || '구분 수정 중 오류가 발생했습니다.' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const row = await ScheduleDivision.findByPk(req.params.id);
        if (!row) return res.status(404).json({ error: '구분을 찾을 수 없습니다.' });
        await row.destroy();
        res.json({ message: '삭제되었습니다.' });
    } catch (error) {
        console.error('구분 삭제 오류:', error);
        res.status(500).json({ error: '구분 삭제 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
