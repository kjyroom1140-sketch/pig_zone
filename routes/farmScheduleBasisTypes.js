const express = require('express');
const router = express.Router();
const { FarmScheduleBasisType, UserFarm } = require('../models');
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

router.get('/:farmId/schedule-basis-types', isAuthenticated, checkFarmPermission, async (req, res) => {
    try {
        const { farmId } = req.params;
        const list = await FarmScheduleBasisType.findAll({
            where: { farmId },
            order: [['sortOrder', 'ASC'], ['id', 'ASC']]
        });
        res.json(list);
    } catch (error) {
        console.error('농장 기준 유형 조회 오류:', error);
        res.status(500).json({ error: '기준 유형 목록을 불러오는 중 오류가 발생했습니다.' });
    }
});

router.post('/:farmId/schedule-basis-types', isAuthenticated, checkFarmPermission, async (req, res) => {
    try {
        const { farmId } = req.params;
        const { code, name, targetType, description, sortOrder } = req.body;
        const created = await FarmScheduleBasisType.create({
            farmId,
            originalId: null,
            code: code || null,
            name: name || '',
            targetType: targetType || null,
            description: description || null,
            sortOrder: sortOrder != null ? sortOrder : 0
        });
        res.status(201).json(created);
    } catch (error) {
        console.error('농장 기준 유형 추가 오류:', error);
        res.status(500).json({ error: '기준 유형 추가 중 오류가 발생했습니다.' });
    }
});

router.put('/:farmId/schedule-basis-types/:id', isAuthenticated, checkFarmPermission, async (req, res) => {
    try {
        const { farmId, id } = req.params;
        const { code, name, targetType, description, sortOrder } = req.body;
        const row = await FarmScheduleBasisType.findOne({ where: { id, farmId } });
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
        console.error('농장 기준 유형 수정 오류:', error);
        res.status(500).json({ error: '기준 유형 수정 중 오류가 발생했습니다.' });
    }
});

router.delete('/:farmId/schedule-basis-types/:id', isAuthenticated, checkFarmPermission, async (req, res) => {
    try {
        const { farmId, id } = req.params;
        const row = await FarmScheduleBasisType.findOne({ where: { id, farmId } });
        if (!row) return res.status(404).json({ error: '기준 유형을 찾을 수 없습니다.' });
        await row.destroy();
        res.json({ message: '삭제되었습니다.' });
    } catch (error) {
        console.error('농장 기준 유형 삭제 오류:', error);
        res.status(500).json({ error: '기준 유형 삭제 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
