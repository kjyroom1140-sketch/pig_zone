// 로그인 확인 미들웨어
function isAuthenticated(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    }

    // API 요청인 경우
    if (req.originalUrl.startsWith('/api/')) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    // 일반 페이지 요청인 경우
    res.redirect('/login.html');
}

// 시스템 관리자/슈퍼관리자 확인 (system_admin, super_admin 허용)
function isSuperAdmin(req, res, next) {
    if (req.session && ['system_admin', 'super_admin'].includes(req.session.systemRole)) {
        return next();
    }

    if (req.originalUrl.startsWith('/api/')) {
        return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    }

    res.status(403).send('접근 권한이 없습니다.');
}

// 농장 접근 권한 확인
async function checkFarmAccess(requiredRoles = []) {
    return async (req, res, next) => {
        const { UserFarm } = require('../models');
        const userId = req.session.userId;
        const farmId = req.params.farmId || req.session.currentFarmId;

        if (!farmId) {
            return res.status(400).json({ error: '농장을 선택해주세요.' });
        }

        try {
            const userFarm = await UserFarm.findOne({
                where: {
                    userId: userId,
                    farmId: farmId,
                    isActive: true
                }
            });

            if (!userFarm) {
                return res.status(403).json({ error: '이 농장에 접근 권한이 없습니다.' });
            }

            // 역할 확인
            if (requiredRoles.length > 0 && !requiredRoles.includes(userFarm.role)) {
                return res.status(403).json({
                    error: '권한이 부족합니다.',
                    yourRole: userFarm.role,
                    requiredRoles: requiredRoles
                });
            }

            // 요청 객체에 농장 정보 추가
            req.currentFarm = userFarm;
            next();
        } catch (error) {
            console.error('권한 확인 오류:', error);
            res.status(500).json({ error: '권한 확인 중 오류가 발생했습니다.' });
        }
    };
}

module.exports = {
    isAuthenticated,
    isSuperAdmin,
    checkFarmAccess
};
