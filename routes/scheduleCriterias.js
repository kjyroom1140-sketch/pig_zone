/**
 * 일정 기준 옵션 (schedule_criterias) — 화면: 기준, 기준일로부터 일수
 */
const express = require('express');
const router = express.Router();
const { ScheduleCriteria } = require('../models');

router.get('/', async (req, res) => {
    try {
        const list = await ScheduleCriteria.findAll({ order: [['id', 'ASC']] });
        res.json(list);
    } catch (error) {
        console.error('schedule_criterias 조회 오류:', error);
        res.status(500).json({ error: error.message || '목록 조회 실패' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { name, schedule_sortations_id, sortations, criterias } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: '기준 이름은 필수입니다.' });
        }
        const criteriasData = typeof criterias === 'string'
            ? criterias
            : JSON.stringify(Array.isArray(criterias) ? criterias : [{ name: name.trim() }]);
        const sortationsId = schedule_sortations_id != null && schedule_sortations_id !== ''
            ? parseInt(schedule_sortations_id, 10)
            : null;
        const newItem = await ScheduleCriteria.create({
            schedule_sortations_id: Number.isNaN(sortationsId) ? null : sortationsId,
            sortations: sortations || null,
            criterias: criteriasData
        });
        res.status(201).json(newItem);
    } catch (error) {
        console.error('schedule_criterias 생성 오류:', error);
        res.status(500).json({ error: error.message || '생성 실패' });
    }
});

module.exports = router;
