/**
 * 일정 작업유형/작업내용 옵션 (schedule_jobtypes) — 화면: 작업유형 대분류, 작업 내용 세부
 */
const express = require('express');
const router = express.Router();
const { ScheduleJobtype } = require('../models');

router.get('/', async (req, res) => {
    try {
        const list = await ScheduleJobtype.findAll({ order: [['id', 'ASC']] });
        res.json(list);
    } catch (error) {
        console.error('schedule_jobtypes 조회 오류:', error);
        res.status(500).json({ error: error.message || '목록 조회 실패' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { name, criterias, jobtypes } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: '작업유형 이름은 필수입니다.' });
        }
        const jobtypesData = typeof jobtypes === 'string'
            ? jobtypes
            : JSON.stringify(Array.isArray(jobtypes) ? jobtypes : [{ name: name.trim() }]);
        const newItem = await ScheduleJobtype.create({
            criterias: criterias || null,
            jobtypes: jobtypesData
        });
        res.status(201).json(newItem);
    } catch (error) {
        console.error('schedule_jobtypes 생성 오류:', error);
        res.status(500).json({ error: error.message || '생성 실패' });
    }
});

module.exports = router;
