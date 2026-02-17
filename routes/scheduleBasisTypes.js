const express = require('express');
const router = express.Router();
const { ScheduleBasisType } = require('../models');

router.get('/', async (req, res) => {
    try {
        const list = await ScheduleBasisType.findAll({
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
        const { code, name, targetType, description, sortOrder } = req.body;
        const created = await ScheduleBasisType.create({
            code: code || null,
            name: name || '',
            targetType: targetType || null,
            description: description || null,
            sortOrder: sortOrder != null ? sortOrder : 0
        });
        res.status(201).json(created);
    } catch (error) {
        console.error('기준 유형 추가 오류:', error);
        res.status(500).json({ error: '기준 유형 추가 중 오류가 발생했습니다.' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { code, name, targetType, description, sortOrder } = req.body;
        const row = await ScheduleBasisType.findByPk(id);
        if (!row) return res.status(404).json({ error: '기준 유형을 찾을 수 없습니다.' });
        await row.update({
            code: code || null,
            name: name || '',
            targetType: targetType || null,
            description: description || null,
            sortOrder: sortOrder != null ? sortOrder : 0
        });
        res.json(row);
    } catch (error) {
        console.error('기준 유형 수정 오류:', error);
        res.status(500).json({ error: '기준 유형 수정 중 오류가 발생했습니다.' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const row = await ScheduleBasisType.findByPk(id);
        if (!row) return res.status(404).json({ error: '기준 유형을 찾을 수 없습니다.' });
        await row.destroy();
        res.json({ message: '삭제되었습니다.' });
    } catch (error) {
        console.error('기준 유형 삭제 오류:', error);
        res.status(500).json({ error: '기준 유형 삭제 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
