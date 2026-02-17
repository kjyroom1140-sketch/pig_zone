const express = require('express');
const router = express.Router();
const { User, Farm, UserFarm } = require('../models');
const { isAuthenticated } = require('../middleware/auth');

// 회원가입
router.post('/register', async (req, res) => {
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

        // 첫 번째 사용자는 system_admin으로 설정 (플랫폼 시스템 관리자)
        const userCount = await User.count();
        const systemRole = userCount === 0 ? 'system_admin' : 'user';

        // 사용자 생성
        const user = await User.create({
            username,
            email,
            password,
            fullName,
            phone,
            systemRole
        });

        res.status(201).json({
            message: '회원가입이 완료되었습니다.',
            user: user.toJSON(),
            isFirstUser: systemRole === 'system_admin'
        });

    } catch (error) {
        console.error('회원가입 오류:', error);
        res.status(500).json({ error: '회원가입 중 오류가 발생했습니다.' });
    }
});

// 로그인
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: '사용자명과 비밀번호를 입력해주세요.' });
        }

        // 사용자 찾기
        const user = await User.findOne({ where: { username } });

        if (!user) {
            return res.status(401).json({ error: '사용자명 또는 비밀번호가 올바르지 않습니다.' });
        }

        // 비밀번호 확인
        const isValid = await user.validatePassword(password);

        if (!isValid) {
            return res.status(401).json({ error: '사용자명 또는 비밀번호가 올바르지 않습니다.' });
        }

        // 활성 상태 확인
        if (!user.isActive) {
            return res.status(403).json({ error: '비활성화된 계정입니다. 관리자에게 문의하세요.' });
        }

        // 세션 설정
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.fullName = user.fullName;
        req.session.systemRole = user.systemRole;

        // 마지막 로그인 시간 업데이트
        await user.update({ lastLogin: new Date() });

        res.json({
            message: '로그인 성공',
            user: user.toJSON()
        });

    } catch (error) {
        console.error('로그인 오류:', error);
        res.status(500).json({ error: '로그인 중 오류가 발생했습니다.' });
    }
});

// 로그아웃
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: '로그아웃 중 오류가 발생했습니다.' });
        }
        res.json({ message: '로그아웃되었습니다.' });
    });
});

// 현재 사용자 정보
router.get('/me', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findByPk(req.session.userId, {
            include: [
                {
                    model: UserFarm,
                    as: 'userFarms',
                    where: { isActive: true },
                    required: false,
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

        res.json({
            user: user.toJSON(),
            currentFarmId: req.session.currentFarmId || null
        });

    } catch (error) {
        console.error('사용자 정보 조회 오류:', error);
        res.status(500).json({ error: '사용자 정보를 가져오는 중 오류가 발생했습니다.' });
    }
});

// 내 정보 수정
router.put('/me', isAuthenticated, async (req, res) => {
    try {
        const { fullName, email, phone, password, currentPassword } = req.body;
        const user = await User.findByPk(req.session.userId);

        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        // 비밀번호 변경 시 현재 비밀번호 확인
        if (password) {
            if (!currentPassword) {
                return res.status(400).json({ error: '비밀번호를 변경하려면 현재 비밀번호를 입력해야 합니다.' });
            }
            const isMatch = await user.validatePassword(currentPassword);
            if (!isMatch) {
                return res.status(401).json({ error: '현재 비밀번호가 일치하지 않습니다.' });
            }
            user.password = password; // Setter will hash it
        }

        if (fullName) user.fullName = fullName;
        if (email) user.email = email;
        if (phone) user.phone = phone;

        await user.save();

        // 세션 정보 업데이트
        req.session.fullName = user.fullName;

        res.json({
            message: '회원 정보가 수정되었습니다.',
            user: {
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                email: user.email,
                phone: user.phone,
                systemRole: user.systemRole
            }
        });

    } catch (error) {
        console.error('회원 정보 수정 오류:', error);
        res.status(500).json({ error: '회원 정보를 수정하는 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
