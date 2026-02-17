const express = require('express');
const router = express.Router();
const { Role, UserFarm } = require('../models');
const { isAuthenticated, isSuperAdmin } = require('../middleware/auth');
const { Op } = require('sequelize');

// 모든 역할/직책 조회 (관리자용)
router.get('/', isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
        const roles = await Role.findAll({
            order: [['level', 'ASC'], ['code', 'ASC']]
        });
        res.json({ roles });
    } catch (error) {
        console.error('권한 목록 조회 오류:', error);
        res.status(500).json({ error: '권한(직책) 목록을 불러오는 중 오류가 발생했습니다.' });
    }
});

// 활성화된 역할/직책 조회 (읽기 전용, 누구나 사용 가능 - 예: 직원 등록용)
router.get('/public', isAuthenticated, async (req, res) => {
    try {
        const { farmId } = req.query;

        const where = { isActive: true };

        // farmId 가 있으면: 공통(NULL) + 해당 농장(farmId) 전용 직책 모두 반환
        if (farmId) {
            where[Op.or] = [
                { farmId: null },
                { farmId }
            ];
        }

        const roles = await Role.findAll({
            where,
            order: [
                ['level', 'ASC'],
                ['code', 'ASC']
            ]
        });

        res.json({ roles });
    } catch (error) {
        console.error('공개 권한 목록 조회 오류:', error);
        res.status(500).json({ error: '권한(직책) 목록을 불러오는 중 오류가 발생했습니다.' });
    }
});

// 역할/직책 생성
router.post('/', isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
        const {
            code,
            name,
            description,
            level,
            isDefault,
            isActive,
            farmId,
            baseRoleCode,
            permissionRole
        } = req.body;

        if (!code || !name) {
            return res.status(400).json({ error: '코드와 이름은 필수입니다.' });
        }

        const existing = await Role.findOne({ where: { code } });
        if (existing) {
            return res.status(400).json({ error: '이미 존재하는 권한 코드입니다.' });
        }

        const role = await Role.create({
            code,
            name,
            description: description || null,
            level: typeof level === 'number' ? level : 10,
            isDefault: !!isDefault,
            isActive: isActive !== false,
            farmId: farmId || null,
            baseRoleCode: baseRoleCode || null,
            permissionRole: permissionRole || null
        });

        res.status(201).json(role);
    } catch (error) {
        console.error('권한 생성 오류:', error);
        res.status(500).json({ error: '권한(직책)을 생성하는 중 오류가 발생했습니다.' });
    }
});

// 역할/직책 수정
router.put('/:id', isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            code,
            name,
            description,
            level,
            isDefault,
            isActive,
            farmId,
            baseRoleCode,
            permissionRole
        } = req.body;

        const role = await Role.findByPk(id);
        if (!role) {
            return res.status(404).json({ error: '권한(직책)을 찾을 수 없습니다.' });
        }

        if (code && code !== role.code) {
            const existing = await Role.findOne({ where: { code } });
            if (existing) {
                return res.status(400).json({ error: '이미 존재하는 권한 코드입니다.' });
            }
        }

        await role.update({
            code: code || role.code,
            name: name || role.name,
            description: description !== undefined ? description : role.description,
            level: typeof level === 'number' ? level : role.level,
            isDefault: typeof isDefault === 'boolean' ? isDefault : role.isDefault,
            isActive: typeof isActive === 'boolean' ? isActive : role.isActive,
            farmId: farmId !== undefined ? farmId : role.farmId,
            baseRoleCode: baseRoleCode !== undefined ? baseRoleCode : role.baseRoleCode,
            permissionRole: permissionRole !== undefined ? permissionRole : role.permissionRole
        });

        res.json(role);
    } catch (error) {
        console.error('권한 수정 오류:', error);
        res.status(500).json({ error: '권한(직책)을 수정하는 중 오류가 발생했습니다.' });
    }
});

// 역할/직책 삭제
router.delete('/:id', isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const role = await Role.findByPk(id);
        if (!role) {
            return res.status(404).json({ error: '권한(직책)을 찾을 수 없습니다.' });
        }

        await role.destroy();
        res.json({ message: '권한(직책)이 삭제되었습니다.' });
    } catch (error) {
        console.error('권한 삭제 오류:', error);
        res.status(500).json({ error: '권한(직책)을 삭제하는 중 오류가 발생했습니다.' });
    }
});

/**
 * 농장별 직책 관리용 API
 *
 * - super_admin 전용으로, 특정 농장(farmId)에 한정된 직책을 추가/수정할 수 있게 함
 * - 조회는 향후 farm_admin 에게도 열어줄 수 있지만, 현재는 super_admin 전용으로 시작
 */

// 특정 농장의 직책 목록 (공통 + 농장 전용)
router.get('/by-farm/:farmId', isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
        const { farmId } = req.params;

        if (!farmId) {
            return res.status(400).json({ error: 'farmId가 필요합니다.' });
        }

        const roles = await Role.findAll({
            where: {
                isActive: true,
                [Op.or]: [
                    { farmId: null },
                    { farmId }
                ]
            },
            order: [
                ['level', 'ASC'],
                ['code', 'ASC']
            ]
        });

        res.json({ roles });
    } catch (error) {
        console.error('농장별 권한 목록 조회 오류:', error);
        res.status(500).json({ error: '농장별 권한(직책) 목록을 불러오는 중 오류가 발생했습니다.' });
    }
});

// 특정 농장 전용 직책 생성 (super_admin 전용)
router.post('/by-farm/:farmId', isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
        const { farmId } = req.params;
        const { code, name, description, level, isActive, baseRoleCode, permissionRole } = req.body || {};

        if (!farmId) {
            return res.status(400).json({ error: 'farmId가 필요합니다.' });
        }
        if (!code || !name) {
            return res.status(400).json({ error: '코드와 이름은 필수입니다.' });
        }

        // 전역적으로 code 는 여전히 유니크하게 유지
        const existing = await Role.findOne({ where: { code } });
        if (existing) {
            return res.status(400).json({ error: '이미 존재하는 권한 코드입니다.' });
        }

        const role = await Role.create({
            code,
            name,
            description: description || null,
            level: typeof level === 'number' ? level : 10,
            isDefault: false,
            isActive: isActive !== false,
            farmId,
            baseRoleCode: baseRoleCode || null,
            permissionRole: permissionRole || null
        });

        res.status(201).json(role);
    } catch (error) {
        console.error('농장 전용 권한 생성 오류:', error);
        res.status(500).json({ error: '농장 전용 권한(직책)을 생성하는 중 오류가 발생했습니다.' });
    }
});

// 특정 농장 전용 직책 수정 (super_admin 전용)
router.put('/by-farm/:farmId/:id', isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
        const { farmId, id } = req.params;
        const { name, description, level, isActive, permissionRole } = req.body || {};

        if (!farmId) {
            return res.status(400).json({ error: 'farmId가 필요합니다.' });
        }

        const role = await Role.findOne({
            where: {
                id,
                farmId
            }
        });

        if (!role) {
            return res.status(404).json({ error: '해당 농장 전용 권한(직책)을 찾을 수 없습니다.' });
        }

        await role.update({
            name: name || role.name,
            description: description !== undefined ? description : role.description,
            level: typeof level === 'number' ? level : role.level,
            isActive: typeof isActive === 'boolean' ? isActive : role.isActive,
            permissionRole: permissionRole !== undefined ? permissionRole : role.permissionRole
        });

        res.json(role);
    } catch (error) {
        console.error('농장 전용 권한 수정 오류:', error);
        res.status(500).json({ error: '농장 전용 권한(직책)을 수정하는 중 오류가 발생했습니다.' });
    }
});

// 특정 농장 전용 직책 삭제 (super_admin 전용)
router.delete('/by-farm/:farmId/:id', isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
        const { farmId, id } = req.params;

        if (!farmId) {
            return res.status(400).json({ error: 'farmId가 필요합니다.' });
        }

        const role = await Role.findOne({
            where: {
                id,
                farmId
            }
        });

        if (!role) {
            return res.status(404).json({ error: '해당 농장 전용 권한(직책)을 찾을 수 없습니다.' });
        }

        await role.destroy();
        res.json({ message: '농장 전용 권한(직책)이 삭제되었습니다.' });
    } catch (error) {
        console.error('농장 전용 권한 삭제 오류:', error);
        res.status(500).json({ error: '농장 전용 권한(직책)을 삭제하는 중 오류가 발생했습니다.' });
    }
});


module.exports = router;

