const express = require('express');
const router = express.Router();
const { Farm, UserFarm, FarmStructure } = require('../models');
const StructureTemplate = require('../models/StructureTemplate');
const { sequelize } = require('../config/database');
const { isAuthenticated } = require('../middleware/auth');
const { Op } = require('sequelize');

// 농장 생성
router.post('/', isAuthenticated, async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const {
            farmName,
            farmCode,
            ownerName,
            businessNumber,
            email,
            address,
            addressDetail,
            postalCode,
            phone,
            capacity,
            latitude,
            longitude,
            timezone,
            note,
            targetUserId,
            productionTemplateIds // 운영돈사로 선택한 structure_templates id 배열
        } = req.body;

        // 타겟 유저 ID 확인 (문자열 'null', 'undefined' 처리)
        let safeTargetUserId = null;
        if (targetUserId && targetUserId !== 'null' && targetUserId !== 'undefined') {
            safeTargetUserId = targetUserId;
        }

        // 기본값은 현재 로그인한 사용자
        let ownerId = req.session.userId;

        // targetUserId가 있고, 현재 사용자가 관리자(super_admin 또는 system_admin)이면 해당 사용자를 소유자로 설정
        if (safeTargetUserId && (req.session.systemRole === 'super_admin' || req.session.systemRole === 'system_admin')) {
            ownerId = safeTargetUserId;
        }

        // 필수 값 검증
        if (!farmName || !farmCode) {
            await transaction.rollback();
            return res.status(400).json({ error: '농장명과 농장 코드는 필수 입력 항목입니다.' });
        }

        // 중복 코드 확인
        const existingFarm = await Farm.findOne({ where: { farmCode } });
        if (existingFarm) {
            await transaction.rollback();
            return res.status(400).json({ error: '이미 사용 중인 농장 코드입니다.' });
        }

        // 1. 농장 생성
        const farm = await Farm.create({
            farmName,
            farmCode,
            ownerName,
            businessNumber,
            email,
            address,
            addressDetail,
            postalCode,
            phone,
            capacity,
            latitude,
            longitude,
            timezone: timezone || 'Asia/Seoul',
            ownerId,
            status: 'ACTIVE'
        }, { transaction });

        // 2. UserFarm 연결 (농장 관리자 권한)
        await UserFarm.create({
            userId: ownerId,
            farmId: farm.id,
            role: 'farm_admin'
        }, { transaction });

        // 3. 모든 시스템 관리자(system_admin)를 해당 농장의 관리자로 자동 추가
        const systemAdmins = await require('../models').User.findAll({
            where: { systemRole: 'system_admin' },
            attributes: ['id']
        });

        const additionalAdmins = systemAdmins
            .filter(admin => admin.id !== ownerId) // 이미 추가된 소유자는 제외
            .map(admin => ({
                userId: admin.id,
                farmId: farm.id,
                role: 'farm_admin' // 시스템 관리자도 농장 관리자 권한 부여
            }));

        if (additionalAdmins.length > 0) {
            await UserFarm.bulkCreate(additionalAdmins, { transaction });
        }

        // 3. 운영돈사(farm_structure) 등록
        if (Array.isArray(productionTemplateIds) && productionTemplateIds.length > 0) {
            const templates = await StructureTemplate.findAll({
                where: { id: productionTemplateIds },
                transaction
            });

            if (templates.length > 0) {
                const structures = templates.map(t => ({
                    farmId: farm.id,
                    templateId: t.id,
                    category: t.category,
                    name: t.name,
                    weight: t.weight,
                    optimalDensity: t.optimalDensity,
                    description: t.description
                }));

                await FarmStructure.bulkCreate(structures, { transaction });
            }
        }

        await transaction.commit();
        res.status(201).json({ message: '농장이 성공적으로 생성되었습니다.', farm });

    } catch (error) {
        await transaction.rollback();
        console.error('농장 생성 오류:', error);
        res.status(500).json({ error: '농장 생성 중 오류가 발생했습니다.' });
    }
});

// 농장 수정
router.put('/:farmId', isAuthenticated, async (req, res) => {
    try {
        const { farmId } = req.params;
        const {
            farmName,
            ownerName,
            businessNumber,
            email,
            address,
            addressDetail,
            postalCode,
            phone,
            capacity,
            latitude,
            longitude,
            timezone,
            status,
            note
        } = req.body;

        // 권한 확인 로직
        let hasPermission = false;

        if (req.session.systemRole === 'super_admin') {
            hasPermission = true;
        } else {
            // UserFarm 테이블에서 권한 확인 (농장 관리자 또는 manager)
            const userFarm = await UserFarm.findOne({
                where: {
                    userId: req.session.userId,
                    farmId: farmId,
                    role: {
                        [Op.or]: ['farm_admin', 'manager']
                    }
                }
            });
            if (userFarm) hasPermission = true;
        }

        if (!hasPermission) {
            return res.status(403).json({ error: '농장 정보를 수정할 권한이 없습니다.' });
        }

        // 농장 조회
        const farm = await Farm.findByPk(farmId);
        if (!farm) {
            return res.status(404).json({ error: '농장을 찾을 수 없습니다.' });
        }

        // 수정 실행
        await farm.update({
            farmName,
            ownerName,
            businessNumber,
            email,
            address,
            addressDetail,
            postalCode,
            phone,
            capacity,
            latitude,
            longitude,
            timezone: timezone || farm.timezone || 'Asia/Seoul',
            status: status || farm.status,
            note
        });

        res.json({ message: '농장 정보가 수정되었습니다.', farm });

    } catch (error) {
        console.error('농장 수정 오류:', error);
        res.status(500).json({ error: '농장 수정 중 오류가 발생했습니다.' });
    }
});

// 농장 삭제 (선택 사항 - 일단 추가)
router.delete('/:farmId', isAuthenticated, async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { farmId } = req.params;

        // 권한 확인 (Owner 또는 Super Admin만 가능)
        let hasPermission = false;
        if (req.session.systemRole === 'super_admin') {
            hasPermission = true;
        } else {
            const userFarm = await UserFarm.findOne({
                where: {
                    userId: req.session.userId,
                    farmId: farmId,
                    role: 'farm_admin'
                }
            });
            if (userFarm) hasPermission = true;
        }

        if (!hasPermission) {
            await transaction.rollback();
            return res.status(403).json({ error: '농장을 삭제할 권한이 없습니다.' });
        }

        // 1. UserFarm 관계 삭제
        await UserFarm.destroy({ where: { farmId }, transaction });

        // 2. 농장 삭제
        await Farm.destroy({ where: { id: farmId }, transaction });

        await transaction.commit();
        res.json({ message: '농장이 삭제되었습니다.' });

    } catch (error) {
        await transaction.rollback();
        console.error('농장 삭제 오류:', error);
        res.status(500).json({ error: '농장 삭제 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
