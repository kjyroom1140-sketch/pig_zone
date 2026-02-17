const express = require('express');
const router = express.Router();
const { FarmScheduleTaskType, FarmScheduleTaskTypeStructure, StructureTemplate, UserFarm } = require('../models');
const { isAuthenticated } = require('../middleware/auth');
const { Op } = require('sequelize');

async function checkFarmPermission(req, res, next) {
    const farmId = req.params.farmId;
    if (['super_admin', 'system_admin'].includes(req.session.systemRole)) {
        return next();
    }
    try {
        const userFarm = await UserFarm.findOne({
            where: {
                userId: req.session.userId,
                farmId,
                role: { [Op.or]: ['farm_admin', 'manager'] },
                isActive: true
            }
        });
        if (userFarm) return next();
        return res.status(403).json({ error: '농장 일정을 관리할 권한이 없습니다.' });
    } catch (err) {
        console.error('권한 확인 오류:', err);
        return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
}

router.get('/:farmId/schedule-task-types', isAuthenticated, checkFarmPermission, async (req, res) => {
    try {
        const { farmId } = req.params;
        const structureTemplateId = req.query.structureTemplateId ? String(req.query.structureTemplateId).trim() : null;
        const include = [
            { model: FarmScheduleTaskTypeStructure, as: 'structureScopes', attributes: ['structureTemplateId'], include: [{ model: StructureTemplate, as: 'structureTemplate', attributes: ['id', 'name'] }] }
        ];
        let where = { farmId };
        if (structureTemplateId) {
            const farmTaskIds = (await FarmScheduleTaskType.findAll({ where: { farmId }, attributes: ['id'] })).map(t => t.id);
            const scopedRows = farmTaskIds.length
                ? await FarmScheduleTaskTypeStructure.findAll({ where: { structureTemplateId, farmScheduleTaskTypeId: { [Op.in]: farmTaskIds } }, attributes: ['farmScheduleTaskTypeId'] })
                : [];
            const scopedIds = scopedRows.map(r => r.farmScheduleTaskTypeId);
            where = { farmId, [Op.or]: [{ appliesToAllStructures: true }, ...(scopedIds.length ? [{ id: { [Op.in]: scopedIds } }] : []) ] };
        }
        const list = await FarmScheduleTaskType.findAll({
            where,
            include,
            order: [['sortOrder', 'ASC'], ['id', 'ASC']]
        });
        res.json(list);
    } catch (error) {
        console.error('농장 작업 유형 조회 오류:', error);
        res.status(500).json({ error: '작업 유형 목록을 불러오는 중 오류가 발생했습니다.' });
    }
});

router.post('/:farmId/schedule-task-types', isAuthenticated, checkFarmPermission, async (req, res) => {
    try {
        const { farmId } = req.params;
        const { code, name, category, sortOrder, appliesToAllStructures, structureTemplateIds } = req.body;
        const created = await FarmScheduleTaskType.create({
            farmId,
            originalId: null,
            code: code || null,
            name: name || '',
            category: category || null,
            sortOrder: sortOrder != null ? sortOrder : 0,
            appliesToAllStructures: appliesToAllStructures !== false
        });
        if (created.appliesToAllStructures === false && Array.isArray(structureTemplateIds) && structureTemplateIds.length > 0) {
            await FarmScheduleTaskTypeStructure.bulkCreate(
                structureTemplateIds.filter(id => id != null && String(id).trim() !== '').map(sid => ({ farmScheduleTaskTypeId: created.id, structureTemplateId: parseInt(sid, 10) }))
            );
        }
        const withScopes = await FarmScheduleTaskType.findByPk(created.id, {
            include: [{ model: FarmScheduleTaskTypeStructure, as: 'structureScopes', include: [{ model: StructureTemplate, as: 'structureTemplate', attributes: ['id', 'name'] }] }]
        });
        res.status(201).json(withScopes || created);
    } catch (error) {
        console.error('농장 작업 유형 추가 오류:', error);
        const message = error.message || '농장 작업 유형 추가 중 오류가 발생했습니다.';
        res.status(500).json({ error: message });
    }
});

router.put('/:farmId/schedule-task-types/:id', isAuthenticated, checkFarmPermission, async (req, res) => {
    try {
        const { farmId, id } = req.params;
        const { code, name, category, sortOrder, appliesToAllStructures, structureTemplateIds } = req.body;
        const row = await FarmScheduleTaskType.findOne({ where: { id, farmId } });
        if (!row) return res.status(404).json({ error: '작업 유형을 찾을 수 없습니다.' });
        await row.update({
            code: code !== undefined ? code : row.code,
            name: name !== undefined ? name : row.name,
            category: category !== undefined ? category : row.category,
            sortOrder: sortOrder !== undefined ? sortOrder : row.sortOrder,
            appliesToAllStructures: appliesToAllStructures !== false
        });
        await FarmScheduleTaskTypeStructure.destroy({ where: { farmScheduleTaskTypeId: row.id } });
        if (appliesToAllStructures === false && Array.isArray(structureTemplateIds) && structureTemplateIds.length > 0) {
            await FarmScheduleTaskTypeStructure.bulkCreate(
                structureTemplateIds.filter(sid => sid != null && String(sid).trim() !== '').map(sid => ({ farmScheduleTaskTypeId: row.id, structureTemplateId: parseInt(sid, 10) }))
            );
        }
        const withScopes = await FarmScheduleTaskType.findByPk(row.id, {
            include: [{ model: FarmScheduleTaskTypeStructure, as: 'structureScopes', include: [{ model: StructureTemplate, as: 'structureTemplate', attributes: ['id', 'name'] }] }]
        });
        res.json(withScopes || row);
    } catch (error) {
        console.error('농장 작업 유형 수정 오류:', error);
        const message = error.message || '농장 작업 유형 수정 중 오류가 발생했습니다.';
        res.status(500).json({ error: message });
    }
});

router.delete('/:farmId/schedule-task-types/:id', isAuthenticated, checkFarmPermission, async (req, res) => {
    try {
        const { farmId, id } = req.params;
        const row = await FarmScheduleTaskType.findOne({ where: { id, farmId } });
        if (!row) return res.status(404).json({ error: '작업 유형을 찾을 수 없습니다.' });
        await row.destroy();
        res.json({ message: '삭제되었습니다.' });
    } catch (error) {
        console.error('농장 작업 유형 삭제 오류:', error);
        res.status(500).json({ error: '작업 유형 삭제 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
