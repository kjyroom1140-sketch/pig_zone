/**
 * 일정 작업 계획 (schedule_work_plans)
 * structure_templates, schedule_sortations, schedule_criterias, schedule_jobtypes, details
 */
const express = require('express');
const router = express.Router();
const { ScheduleWorkPlanDef } = require('../models');

router.get('/', async (req, res) => {
    try {
        const list = await ScheduleWorkPlanDef.findAll({
            order: [['id', 'ASC']]
        });
        res.json(list);
    } catch (error) {
        console.error('일정 작업 계획 조회 오류:', error);
        res.status(500).json({ error: error.message || '일정 작업 계획 목록을 불러오는 중 오류가 발생했습니다.' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { structure_templates, schedule_sortations, schedule_criterias, schedule_jobtypes, details } = req.body;
        const created = await ScheduleWorkPlanDef.create({
            structure_templates: structure_templates || null,
            schedule_sortations: schedule_sortations || null,
            schedule_criterias: schedule_criterias || null,
            schedule_jobtypes: schedule_jobtypes || null,
            details: details || null
        });
        res.status(201).json(created);
    } catch (error) {
        console.error('일정 작업 계획 추가 오류:', error);
        res.status(500).json({ error: error.message || '일정 작업 계획 추가 중 오류가 발생했습니다.' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const row = await ScheduleWorkPlanDef.findByPk(req.params.id);
        if (!row) return res.status(404).json({ error: '일정 작업 계획을 찾을 수 없습니다.' });
        const { structure_templates, schedule_sortations, schedule_criterias, schedule_jobtypes, details } = req.body;
        await row.update({
            structure_templates: structure_templates !== undefined ? structure_templates : row.structure_templates,
            schedule_sortations: schedule_sortations !== undefined ? schedule_sortations : row.schedule_sortations,
            schedule_criterias: schedule_criterias !== undefined ? schedule_criterias : row.schedule_criterias,
            schedule_jobtypes: schedule_jobtypes !== undefined ? schedule_jobtypes : row.schedule_jobtypes,
            details: details !== undefined ? details : row.details
        });
        res.json(row);
    } catch (error) {
        console.error('일정 작업 계획 수정 오류:', error);
        res.status(500).json({ error: error.message || '일정 작업 계획 수정 중 오류가 발생했습니다.' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const row = await ScheduleWorkPlanDef.findByPk(req.params.id);
        if (!row) return res.status(404).json({ error: '일정 작업 계획을 찾을 수 없습니다.' });
        await row.destroy();
        res.json({ message: '삭제되었습니다.' });
    } catch (error) {
        console.error('일정 작업 계획 삭제 오류:', error);
        res.status(500).json({ error: '일정 작업 계획 삭제 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
