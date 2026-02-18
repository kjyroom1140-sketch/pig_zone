const express = require('express');
const router = express.Router();
const { ScheduleItemType } = require('../models');

const BASIS_KIND = 'basis';

router.get('/', async (req, res) => {
    try {
        const list = await ScheduleItemType.findAll({
            where: { kind: BASIS_KIND },
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
        const created = await ScheduleItemType.create({
            kind: BASIS_KIND,
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
        const row = await ScheduleItemType.findOne({ where: { id, kind: BASIS_KIND } });
        if (!row) return res.status(404).json({ error: '기준 유형을 찾을 수 없습니다.' });
        const { code, name, targetType, description, sortOrder } = req.body;
        await row.update({
            code: code !== undefined ? code : row.code,
            name: name !== undefined ? name : row.name,
            targetType: targetType !== undefined ? targetType : row.targetType,
            description: description !== undefined ? description : row.description,
            sortOrder: sortOrder !== undefined ? sortOrder : row.sortOrder
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
        const row = await ScheduleItemType.findOne({ where: { id, kind: BASIS_KIND } });
        if (!row) return res.status(404).json({ error: '기준 유형을 찾을 수 없습니다.' });
        await row.destroy();
        res.json({ message: '삭제되었습니다.' });
    } catch (error) {
        console.error('기준 유형 삭제 오류:', error);
        res.status(500).json({ error: '기준 유형 삭제 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
