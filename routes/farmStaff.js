const express = require('express');
const router = express.Router();
const { User, UserFarm, Farm } = require('../models');
const { isAuthenticated } = require('../middleware/auth');
const { Op } = require('sequelize');

// 권한 체크: system_admin, super_admin, 또는 해당 농장의 farm_admin 만 직원 관리 가능
async function checkStaffPermission(req, res, next) {
    const { farmId } = req.params;

    if (!farmId) {
        return res.status(400).json({ error: 'farmId가 필요합니다.' });
    }

    if (['system_admin', 'super_admin'].includes(req.session.systemRole)) {
        return next();
    }

    try {
        const uf = await UserFarm.findOne({
            where: {
                userId: req.session.userId,
                farmId,
                role: 'farm_admin',
                isActive: true
            }
        });

        if (!uf) {
            return res.status(403).json({ error: '해당 농장의 직원을 관리할 권한이 없습니다.' });
        }

        return next();
    } catch (error) {
        console.error('직원 권한 확인 오류:', error);
        return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
}

// 특정 농장의 직원 목록
router.get('/:farmId/staff', isAuthenticated, checkStaffPermission, async (req, res) => {
    try {
        const { farmId } = req.params;

        const staff = await UserFarm.findAll({
            where: { farmId, isActive: true },
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'username', 'fullName', 'email', 'phone', 'systemRole']
            }],
            order: [['createdAt', 'ASC']]
        });

        // system_admin, super_admin 은 직원 목록에서 제외
        const filtered = staff.filter(uf => !['system_admin', 'super_admin'].includes(uf.user?.systemRole));

        const result = filtered.map(uf => ({
            userFarmId: uf.id,
            userId: uf.userId,
            username: uf.user?.username,
            fullName: uf.user?.fullName,
            email: uf.user?.email,
            phone: uf.user?.phone,
            role: uf.role,
            department: uf.department,
            position: uf.position,
            employmentType: uf.employmentType,
            hireDate: uf.hireDate,
            resignDate: uf.resignDate,
            isActive: uf.isActive
        }));

        res.json(result);
    } catch (error) {
        console.error('직원 목록 조회 오류:', error);
        res.status(500).json({ error: '직원 목록을 불러오는 중 오류가 발생했습니다.' });
    }
});

// 새 계정 + 직원 등록
router.post('/:farmId/staff', isAuthenticated, checkStaffPermission, async (req, res) => {
    const { farmId } = req.params;
    const { account, staff } = req.body || {};

    try {
        if (!account || !account.username || !account.password || !account.fullName) {
            return res.status(400).json({ error: '계정 정보(아이디, 비밀번호, 이름)는 필수입니다.' });
        }

        const existing = await User.findOne({ where: { username: account.username } });
        if (existing) {
            return res.status(400).json({ error: '이미 사용 중인 아이디입니다.' });
        }

        const user = await User.create({
            username: account.username,
            password: account.password, // TODO: 비밀번호 해시 적용 필요 (auth 라우트와 동일 로직 재사용 권장)
            fullName: account.fullName,
            phone: account.phone || null,
            email: (account.email && String(account.email).trim()) || null,
            birthDate: account.birthDate || null,
            gender: account.gender || null,
            nationalityType: account.nationalityType || 'domestic',
            nationality: account.nationality || null,
            visaType: account.visaType || null,
            visaExpiry: account.visaExpiry || null,
            postalCode: account.postalCode || null,
            address: account.address || null,
            addressDetail: account.addressDetail || null,
            systemRole: 'user'
        });

        const role = staff?.role || 'staff';

        const userFarm = await UserFarm.create({
            userId: user.id,
            farmId,
            role,
            department: staff?.department || null,
            position: staff?.position || null,
            employmentType: staff?.employmentType || 'full_time',
            hireDate: staff?.hireDate || null,
            salary: staff?.salary || null,
            assignedBy: req.session.userId,
            assignedAt: new Date()
        });

        res.status(201).json({ user, userFarm });
    } catch (error) {
        console.error('직원 등록 오류:', error);
        res.status(500).json({ error: '직원 등록 중 오류가 발생했습니다.' });
    }
});

// 직원(농장 소속) 수정
router.put('/:farmId/staff/:userFarmId', isAuthenticated, checkStaffPermission, async (req, res) => {
    const { farmId, userFarmId } = req.params;
    const { user: userBody, staff: staffBody } = req.body || {};

    try {
        const uf = await UserFarm.findOne({
            where: { id: userFarmId, farmId, isActive: true },
            include: [{ model: User, as: 'user', attributes: ['id', 'fullName', 'phone', 'email'] }]
        });
        if (!uf) {
            return res.status(404).json({ error: '해당 농장의 직원 정보를 찾을 수 없습니다.' });
        }

        if (staffBody) {
            if (staffBody.role != null) uf.role = staffBody.role;
            if (staffBody.department !== undefined) uf.department = staffBody.department || null;
            if (staffBody.position !== undefined) uf.position = staffBody.position || null;
            if (staffBody.employmentType != null) uf.employmentType = staffBody.employmentType;
            if (staffBody.hireDate !== undefined) uf.hireDate = staffBody.hireDate || null;
            if (staffBody.resignDate !== undefined) uf.resignDate = staffBody.resignDate || null;
            if (staffBody.salary !== undefined) uf.salary = staffBody.salary || null;
            await uf.save();
        }

        if (userBody && uf.user) {
            const user = await User.findByPk(uf.userId);
            if (user) {
                if (userBody.fullName !== undefined) user.fullName = userBody.fullName;
                if (userBody.phone !== undefined) user.phone = userBody.phone || null;
                if (userBody.email !== undefined) user.email = (userBody.email && String(userBody.email).trim()) || null;
                await user.save();
            }
        }

        const updated = await UserFarm.findByPk(uf.id, {
            include: [{ model: User, as: 'user', attributes: ['id', 'username', 'fullName', 'email', 'phone'] }]
        });
        res.json(updated);
    } catch (error) {
        console.error('직원 수정 오류:', error);
        res.status(500).json({ error: '직원 수정 중 오류가 발생했습니다.' });
    }
});

// 직원(농장 소속) 삭제 — 퇴사 처리(soft: isActive=false, resignDate=오늘)
router.delete('/:farmId/staff/:userFarmId', isAuthenticated, checkStaffPermission, async (req, res) => {
    const { farmId, userFarmId } = req.params;

    try {
        const uf = await UserFarm.findOne({ where: { id: userFarmId, farmId } });
        if (!uf) {
            return res.status(404).json({ error: '해당 농장의 직원 정보를 찾을 수 없습니다.' });
        }
        uf.isActive = false;
        uf.resignDate = uf.resignDate || new Date().toISOString().slice(0, 10);
        await uf.save();
        res.json({ success: true, message: '퇴사 처리되었습니다.' });
    } catch (error) {
        console.error('직원 삭제(퇴사) 오류:', error);
        res.status(500).json({ error: '직원 삭제 처리 중 오류가 발생했습니다.' });
    }
});

// 기존 계정(다른 농장 직원 포함)을 이 농장 직원으로 연결
router.post('/:farmId/staff/link', isAuthenticated, checkStaffPermission, async (req, res) => {
    const { farmId } = req.params;
    const { userId, role, department, position, employmentType, hireDate, salary } = req.body || {};

    try {
        if (!userId) {
            return res.status(400).json({ error: 'userId는 필수입니다.' });
        }

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: '해당 사용자를 찾을 수 없습니다.' });
        }

        const existing = await UserFarm.findOne({ where: { userId, farmId } });
        if (existing) {
            return res.status(400).json({ error: '이미 이 농장에 등록된 직원입니다.' });
        }

        const userFarm = await UserFarm.create({
            userId,
            farmId,
            role: role || 'staff',
            department: department || null,
            position: position || null,
            employmentType: employmentType || 'full_time',
            hireDate: hireDate || null,
            salary: salary || null,
            assignedBy: req.session.userId,
            assignedAt: new Date()
        });

        res.status(201).json({ user, userFarm });
    } catch (error) {
        console.error('기존 직원 연결 오류:', error);
        res.status(500).json({ error: '기존 직원을 이 농장에 추가하는 중 오류가 발생했습니다.' });
    }
});

module.exports = router;

// 직원 검색 (기존 계정/다른 농장 직원 포함)
// 경로: /api/farms/staff/search?query=...
router.get('/staff/search', isAuthenticated, async (req, res) => {
    try {
        const { query, farmId } = req.query;

        // system_admin, super_admin 만 전체 검색 허용
        if (!['system_admin', 'super_admin'].includes(req.session.systemRole)) {
            return res.status(403).json({ error: '직원 검색 권한이 없습니다.' });
        }

        const whereUser = {};
        if (query && query.trim()) {
            const q = `%${query.trim()}%`;
            whereUser[Op.or] = [
                { username: { [Op.iLike]: q } },
                { fullName: { [Op.iLike]: q } },
                { phone: { [Op.iLike]: q } },
                { email: { [Op.iLike]: q } }
            ];
        }

        const users = await User.findAll({
            where: whereUser,
            include: [{
                model: UserFarm,
                as: 'userFarms',
                include: [{
                    model: Farm,
                    as: 'farm',
                    attributes: ['id', 'farmName']
                }]
            }],
            order: [['createdAt', 'DESC']],
            limit: 30
        });

        const currentFarmId = farmId || null;

        const results = users.map(user => {
            const farms = (user.userFarms || []).map(uf => ({
                farmId: uf.farmId,
                farmName: uf.farm ? uf.farm.farmName : null,
                role: uf.role
            }));

            const isInCurrentFarm = currentFarmId
                ? farms.some(f => f.farmId === currentFarmId)
                : false;

            return {
                userId: user.id,
                username: user.username,
                fullName: user.fullName,
                phone: user.phone,
                email: user.email,
                farms,
                isInCurrentFarm
            };
        });

        res.json(results);
    } catch (error) {
        console.error('직원 검색 오류:', error);
        res.status(500).json({ error: '직원 검색 중 오류가 발생했습니다.' });
    }
});

