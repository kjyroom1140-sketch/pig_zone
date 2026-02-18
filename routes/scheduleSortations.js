/**
 * 일정 구분 옵션 (schedule_sortations) — 화면: 대상장소 다음 구분
 */
const express = require('express');
const router = express.Router();
const { ScheduleSortation } = require('../models');

router.get('/', async (req, res) => {
    try {
        const list = await ScheduleSortation.findAll({ order: [['id', 'ASC']] });
        res.json(list);
    } catch (error) {
        console.error('schedule_sortations 조회 오류:', error);
        res.status(500).json({ error: error.message || '목록 조회 실패' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { name, structure_template_id, sortations } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: '구분 이름은 필수입니다.' });
        }
        const sortationsData = typeof sortations === 'string'
            ? sortations
            : JSON.stringify(Array.isArray(sortations) ? sortations : [{ name: name.trim() }]);
        const structureTemplateId = structure_template_id != null && structure_template_id !== ''
            ? parseInt(structure_template_id, 10)
            : null;
        const newItem = await ScheduleSortation.create({
            structure_template_id: Number.isNaN(structureTemplateId) ? null : structureTemplateId,
            sortations: sortationsData
        });
        res.status(201).json(newItem);
    } catch (error) {
        const dbMsg = error.original?.message || error.message;
        console.error('schedule_sortations 생성 오류:', error);
        res.status(500).json({ error: dbMsg || '생성 실패' });
    }
});

module.exports = router;
