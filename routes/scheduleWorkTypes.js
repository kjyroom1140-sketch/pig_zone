/**
 * 작업유형 대분류 (schedule_work_types)
 * docs: schedule_structure_design.md — W01 이동, W02 사양, … W10 시설
 */
const express = require('express');
const router = express.Router();
const { ScheduleWorkType, ScheduleWorkDetailType } = require('../models');
const { Op } = require('sequelize');

router.get('/', async (req, res) => {
    try {
        const appliesToScope = req.query.appliesToScope; // pig | facility | both — 구분에 따라 필터
        const where = {};
        if (appliesToScope && ['pig', 'facility', 'both'].includes(appliesToScope)) {
            where.appliesToScope = { [Op.in]: [appliesToScope, 'both'] };
        }
        const list = await ScheduleWorkType.findAll({
            where: Object.keys(where).length ? where : undefined,
            include: [{ model: ScheduleWorkDetailType, as: 'detailTypes', attributes: ['id', 'code', 'name', 'sortOrder'], required: false }],
            order: [['sortOrder', 'ASC'], ['id', 'ASC']]
        });
        res.json(list);
    } catch (error) {
        console.error('작업유형 대분류 조회 오류:', error);
        res.status(500).json({ error: '작업유형 대분류 목록을 불러오는 중 오류가 발생했습니다.' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { code, name, description, appliesToScope, divisionId, sortOrder } = req.body;
        const created = await ScheduleWorkType.create({
            code: code || null,
            name: name || '',
            description: description || null,
            appliesToScope: appliesToScope || 'pig',
            divisionId: divisionId != null && divisionId !== '' ? parseInt(divisionId, 10) : null,
            sortOrder: sortOrder != null ? parseInt(sortOrder, 10) : 0
        });
        res.status(201).json(created);
    } catch (error) {
        console.error('작업유형 대분류 추가 오류:', error);
        res.status(500).json({ error: error.message || '작업유형 대분류 추가 중 오류가 발생했습니다.' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const row = await ScheduleWorkType.findByPk(req.params.id);
        if (!row) return res.status(404).json({ error: '작업유형 대분류를 찾을 수 없습니다.' });
        const { code, name, description, appliesToScope, divisionId, sortOrder } = req.body;
        await row.update({
            code: code !== undefined ? code : row.code,
            name: name !== undefined ? name : row.name,
            description: description !== undefined ? description : row.description,
            appliesToScope: appliesToScope !== undefined ? appliesToScope : row.appliesToScope,
            divisionId: divisionId !== undefined ? (divisionId != null && divisionId !== '' ? parseInt(divisionId, 10) : null) : row.divisionId,
            sortOrder: sortOrder !== undefined ? parseInt(sortOrder, 10) : row.sortOrder
        });
        res.json(row);
    } catch (error) {
        console.error('작업유형 대분류 수정 오류:', error);
        res.status(500).json({ error: error.message || '작업유형 대분류 수정 중 오류가 발생했습니다.' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const row = await ScheduleWorkType.findByPk(req.params.id);
        if (!row) return res.status(404).json({ error: '작업유형 대분류를 찾을 수 없습니다.' });
        await row.destroy();
        res.json({ message: '삭제되었습니다.' });
    } catch (error) {
        console.error('작업유형 대분류 삭제 오류:', error);
        res.status(500).json({ error: '작업유형 대분류 삭제 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
