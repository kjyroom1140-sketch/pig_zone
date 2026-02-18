const express = require('express');
const router = express.Router();
const { User, Farm, UserFarm } = require('../models');
const { isAuthenticated, isSuperAdmin } = require('../middleware/auth');

// 대시보드 통계 (회원/농장 수)
router.get('/stats', isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
        const userCount = await User.count();
        const farmCount = await Farm.count();
        const userFarmCount = await UserFarm.count();

        res.json({
            stats: {
                users: userCount,
                farms: farmCount,
                userFarms: userFarmCount
            }
        });
    } catch (error) {
        console.error('통계 조회 오류:', error);
        res.status(500).json({ error: '통계 정보를 가져오는 중 오류가 발생했습니다.' });
    }
});

// 모든 사용자 조회
router.get('/users', isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
        const users = await User.findAll({
            include: [
                {
                    model: UserFarm,
                    as: 'userFarms',
                    include: [
                        {
                            model: Farm,
                            as: 'farm'
                        }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json({ users });
    } catch (error) {
        console.error('사용자 조회 오류:', error);
        res.status(500).json({ error: '사용자 목록을 가져오는 중 오류가 발생했습니다.' });
    }
});

// 사용자 추가 (최고 관리자 전용 - 농장 운영 관리자 등록)
router.post('/users', isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
        const { username, email, password, fullName, phone } = req.body;

        // 입력 검증
        if (!username || !email || !password || !fullName) {
            return res.status(400).json({ error: '필수 항목을 모두 입력해주세요.' });
        }

        // 중복 확인
        const existingUser = await User.findOne({
            where: {
                [require('sequelize').Op.or]: [
                    { username },
                    { email }
                ]
            }
        });

        if (existingUser) {
            return res.status(400).json({ error: '이미 존재하는 사용자명 또는 이메일입니다.' });
        }

        // 농장 운영 관리자(super_admin)로 생성
        const user = await User.create({
            username,
            email,
            password,
            fullName,
            phone,
            systemRole: 'super_admin' // 관리자 페이지에서 생성 시 기본 권한
        });

        res.status(201).json({
            message: '농장 운영 관리자가 성공적으로 등록되었습니다.',
            user: user.toJSON()
        });

    } catch (error) {
        console.error('사용자 추가 오류:', error);
        res.status(500).json({ error: '사용자 추가 중 오류가 발생했습니다.' });
    }
});

// 사용자 활성/비활성 토글
router.patch('/users/:userId/toggle-active', isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        // 자기 자신은 비활성화할 수 없음
        if (user.id === req.session.userId) {
            return res.status(400).json({ error: '자기 자신의 계정은 비활성화할 수 없습니다.' });
        }

        await user.update({ isActive: !user.isActive });

        res.json({
            message: `사용자가 ${user.isActive ? '활성화' : '비활성화'}되었습니다.`,
            user: user.toJSON()
        });
    } catch (error) {
        console.error('사용자 상태 변경 오류:', error);
        res.status(500).json({ error: '사용자 상태를 변경하는 중 오류가 발생했습니다.' });
    }
});

// 사용자 상세 조회 (농장 목록 포함)
router.get('/users/:userId', isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findByPk(userId, {
            attributes: { exclude: ['password'] },
            include: [
                {
                    model: UserFarm,
                    as: 'userFarms',
                    include: [
                        {
                            model: Farm,
                            as: 'farm'
                        }
                    ]
                }
            ]
        });

        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        res.json({ user });
    } catch (error) {
        console.error('사용자 상세 조회 오류:', error);
        res.status(500).json({ error: '사용자 정보를 가져오는 중 오류가 발생했습니다.' });
    }
});

// 사용자 삭제
router.delete('/users/:userId', isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        // 자기 자신은 삭제할 수 없음
        if (userId === req.session.userId) {
            return res.status(400).json({ error: '자기 자신의 계정은 삭제할 수 없습니다.' });
        }

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        // 관련 UserFarm 레코드도 삭제
        await UserFarm.destroy({ where: { userId } });
        await user.destroy();

        res.json({ message: '사용자가 삭제되었습니다.' });
    } catch (error) {
        console.error('사용자 삭제 오류:', error);
        res.status(500).json({ error: '사용자를 삭제하는 중 오류가 발생했습니다.' });
    }
});

// 사용자 정보 수정
router.put('/users/:userId', isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { email, password, fullName, phone } = req.body;

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        // 업데이트할 데이터 준비
        const updateData = {
            email,
            fullName,
            phone: phone || null
        };

        // 비밀번호가 제공된 경우에만 업데이트
        if (password && password.trim().length > 0) {
            if (password.length < 8) {
                return res.status(400).json({ error: '비밀번호는 최소 8자 이상이어야 합니다.' });
            }
            updateData.password = password;
        }

        await user.update(updateData);

        res.json({
            message: '사용자 정보가 수정되었습니다.',
            user: user.toJSON()
        });
    } catch (error) {
        console.error('사용자 수정 오류:', error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ error: '이미 사용 중인 이메일입니다.' });
        }
        res.status(500).json({ error: '사용자 정보를 수정하는 중 오류가 발생했습니다.' });
    }
});

// 모든 농장 조회
router.get('/farms', isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
        const farms = await Farm.findAll({
            include: [
                {
                    model: User,
                    as: 'owner',
                    attributes: ['id', 'username', 'fullName', 'email']
                },
                {
                    model: UserFarm,
                    as: 'farmUsers',
                    include: [
                        {
                            model: User,
                            as: 'user',
                            attributes: ['id', 'username', 'fullName']
                        }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json({ farms });
    } catch (error) {
        console.error('농장 조회 오류:', error);
        res.status(500).json({ error: '농장 목록을 가져오는 중 오류가 발생했습니다.' });
    }
});

// 시스템 설정 조회 (추후 확장 가능)
router.get('/settings', isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
        // 현재는 기본 설정만 반환
        const settings = {
            systemName: '양돈농장 관리 시스템',
            version: '1.0.0',
            database: process.env.POSTGRES_DB,
            environment: process.env.NODE_ENV
        };

        res.json({ settings });
    } catch (error) {
        console.error('설정 조회 오류:', error);
        res.status(500).json({ error: '설정을 가져오는 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
