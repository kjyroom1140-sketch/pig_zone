const express = require('express');
const router = express.Router();
const { FarmBuilding, FarmBarn, FarmRoom, FarmSection, Farm, UserFarm, FarmStructure, PigGroup, SectionGroupOccupancy } = require('../models');
const { sequelize } = require('../config/database');
const { isAuthenticated } = require('../middleware/auth');
const { Op } = require('sequelize');

// ========================================
// 권한 확인 미들웨어
// ========================================
async function checkFarmPermission(req, res, next) {
    const farmId = req.params.farmId || req.body.farmId;

    // 최고 관리자 또는 시스템 관리자는 통과
    if (['super_admin', 'system_admin'].includes(req.session.systemRole)) {
        return next();
    }

    try {
        // 해당 농장에 대한 권한 확인 (농장 관리자 또는 관리자)
        const userFarm = await UserFarm.findOne({
            where: {
                userId: req.session.userId,
                farmId: farmId,
                role: { [Op.or]: ['farm_admin', 'manager'] },
                isActive: true
            }
        });

        if (userFarm) {
            return next();
        } else {
            return res.status(403).json({ error: '농장 시설을 관리할 권한이 없습니다.' });
        }
    } catch (error) {
        console.error('권한 확인 오류:', error);
        return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
}

// 층별 돈사 정렬: 운영시설 순서에 맞게. 돈사명/돈사종류가 운영시설명과 일치하면 해당 순서, 없으면 뒤로
function getStructureOrderForBarn(barn, structureOrderMap) {
    const name = (barn.name || '').trim();
    const barnType = (barn.barnType || '').trim();
    if (structureOrderMap.has(name)) return structureOrderMap.get(name);
    if (structureOrderMap.has(barnType)) return structureOrderMap.get(barnType);
    for (const [structName, order] of structureOrderMap) {
        if (name.includes(structName) || structName.includes(name)) return order;
    }
    return 9999;
}

// ========================================
// 전체 트리 구조 조회
// ========================================
router.get('/:farmId/tree', isAuthenticated, checkFarmPermission, async (req, res) => {
    try {
        const { farmId } = req.params;

        // 건물(동) 1 row = 1동. 층은 farm_barns.floorNumber 로 구분 → 트리: 건물 → 층(1..totalFloors) → 돈사 → 방 → 칸
        const buildings = await FarmBuilding.findAll({
            where: { farmId, isActive: true },
            attributes: ['id', 'name', 'code', 'orderIndex', 'description', 'totalFloors'],
            include: [{
                model: FarmBarn,
                as: 'barns',
                where: { isActive: true },
                required: false,
                attributes: [
                    'id', 'buildingId', 'name', 'barnType', 'floorNumber',
                    'orderIndex', 'description'
                ],
                include: [{
                    model: FarmRoom,
                    as: 'rooms',
                    where: { isActive: true },
                    required: false,
                    attributes: [
                        'id', 'barnId', 'name', 'roomNumber', 'sectionCount',
                        'area', 'totalCapacity', 'orderIndex'
                    ],
                    include: [{
                        model: FarmSection,
                        as: 'sections',
                        where: { isActive: true },
                        required: false,
                        attributes: [
                            'id', 'roomId', 'name', 'sectionNumber', 'currentPigCount',
                            'averageWeight', 'entryDate', 'birthDate', 'breedType',
                            'area', 'capacity', 'orderIndex'
                        ]
                    }]
                }]
            }],
            order: [
                ['orderIndex', 'ASC'],
                ['createdAt', 'ASC'],
                [{ model: FarmBarn, as: 'barns' }, 'floorNumber', 'ASC'],
                [{ model: FarmBarn, as: 'barns' }, 'orderIndex', 'ASC'],
                [{ model: FarmBarn, as: 'barns' }, { model: FarmRoom, as: 'rooms' }, 'orderIndex', 'ASC'],
                [{ model: FarmBarn, as: 'barns' }, { model: FarmRoom, as: 'rooms' }, 'roomNumber', 'ASC'],
                [{ model: FarmBarn, as: 'barns' }, { model: FarmRoom, as: 'rooms' }, { model: FarmSection, as: 'sections' }, 'sectionNumber', 'ASC']
            ]
        });

        // 운영시설 순서(농장 운영 돈사 설정) — 층별 돈사 정렬에 사용
        const productionStructures = await FarmStructure.findAll({
            where: { farmId, category: 'production' },
            attributes: ['id', 'name'],
            order: [['id', 'ASC']]
        });
        const structureOrderMap = new Map();
        productionStructures.forEach((s, index) => {
            const name = (s.name || '').trim();
            if (name && !structureOrderMap.has(name)) structureOrderMap.set(name, index);
        });

        const treeData = buildings.map(instance => {
            const b = instance.toJSON();
            const barns = b.barns || [];
            const maxFloorFromBarns = barns.length ? Math.max(1, ...barns.map(x => x.floorNumber != null ? x.floorNumber : 1)) : 1;
            const totalFloors = Math.max(1, b.totalFloors != null ? b.totalFloors : maxFloorFromBarns);
            const barnsByFloor = new Map();
            for (let f = 1; f <= totalFloors; f++) barnsByFloor.set(f, []);

            (b.barns || []).forEach(barn => {
                const fn = barn.floorNumber != null ? barn.floorNumber : 1;
                if (!barnsByFloor.has(fn)) barnsByFloor.set(fn, []);
                barnsByFloor.get(fn).push(barn);
            });

            const floors = [];
            for (let floorNum = 1; floorNum <= totalFloors; floorNum++) {
                const barnsInFloorRaw = barnsByFloor.get(floorNum) || [];
                const barnsInFloorSorted = [...barnsInFloorRaw].sort((a, b) => {
                    const orderA = getStructureOrderForBarn(a, structureOrderMap);
                    const orderB = getStructureOrderForBarn(b, structureOrderMap);
                    if (orderA !== orderB) return orderA - orderB;
                    return (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
                });
                const barnsInFloor = barnsInFloorSorted.map(barn => {
                    const rooms = (barn.rooms || []).map(room => ({
                        ...room,
                        sections: room.sections || []
                    }));
                    const totalRooms = rooms.length;
                    const totalSections = rooms.reduce((sum, room) => sum + (room.sectionCount || 0), 0);
                    return {
                        ...barn,
                        rooms,
                        stats: { totalRooms, totalSections }
                    };
                });
                const floorTotalBarns = barnsInFloor.length;
                const floorTotalRooms = barnsInFloor.reduce((s, x) => s + (x.stats?.totalRooms || 0), 0);
                const floorTotalSections = barnsInFloor.reduce((s, x) => s + (x.stats?.totalSections || 0), 0);
                floors.push({
                    buildingId: b.id,
                    floorNumber: floorNum,
                    barns: barnsInFloor,
                    stats: { totalBarns: floorTotalBarns, totalRooms: floorTotalRooms, totalSections: floorTotalSections }
                });
            }

            const allBarns = floors.flatMap(f => f.barns);
            return {
                id: b.id,
                name: b.name,
                code: b.code,
                description: b.description,
                totalFloors,
                stats: {
                    totalBarns: allBarns.length,
                    totalRooms: allBarns.reduce((s, x) => s + (x.stats?.totalRooms || 0), 0),
                    totalSections: allBarns.reduce((s, x) => s + (x.stats?.totalSections || 0), 0)
                },
                floors
            };
        });

        // 사육 두수 하이브리드: pig_groups(또는 section_group_occupancy) 우선, 없으면 farm_sections.currentPigCount (docs: pig_object_group_movement_tables.md)
        const sectionIds = [];
        treeData.forEach(b => (b.floors || []).forEach(f => (f.barns || []).forEach(barn => (barn.rooms || []).forEach(room => (room.sections || []).forEach(sec => sectionIds.push(sec.id))))));
        const pigGroupBySection = new Map();
        const occupancyBySection = new Map();
        if (sectionIds.length > 0) {
            try {
                const pgRows = await PigGroup.findAll({
                    attributes: ['currentSectionId', [sequelize.fn('SUM', sequelize.fn('COALESCE', sequelize.col('headcount'), 0)), 'total']],
                    where: { farmId, currentSectionId: { [Op.in]: sectionIds }, status: 'active' },
                    group: ['currentSectionId'],
                    raw: true
                });
                pgRows.forEach(r => { const sid = r.currentSectionId ?? r.current_section_id; if (sid != null && r.total != null) pigGroupBySection.set(sid, parseInt(r.total, 10) || 0); });
            } catch (e) { console.error('트리 사육 두수(pig_groups) 조회 생략:', e.message); }
            try {
                const occRows = await SectionGroupOccupancy.findAll({
                    attributes: ['sectionId', [sequelize.fn('SUM', sequelize.col('headcount')), 'total']],
                    where: { sectionId: { [Op.in]: sectionIds }, endedAt: null },
                    group: ['sectionId'],
                    raw: true
                });
                occRows.forEach(r => { const sid = r.sectionId ?? r.section_id; if (sid != null && r.total != null) occupancyBySection.set(sid, parseInt(r.total, 10) || 0); });
            } catch (e) { console.error('트리 사육 두수(section_group_occupancy) 조회 생략:', e.message); }
            treeData.forEach(b => (b.floors || []).forEach(f => (f.barns || []).forEach(barn => (barn.rooms || []).forEach(room => (room.sections || []).forEach(sec => {
                const fromPg = pigGroupBySection.get(sec.id);
                const fromOcc = occupancyBySection.get(sec.id);
                const resolved = (fromPg != null && fromPg > 0) ? fromPg : (fromOcc != null && fromOcc > 0) ? fromOcc : (sec.currentPigCount != null ? sec.currentPigCount : 0);
                sec.currentPigCount = resolved;
            })))));
        }

        res.json(treeData);
    } catch (error) {
        console.error('트리 구조 조회 오류:', error);
        const message = process.env.NODE_ENV === 'development' ? error.message : '트리 구조를 불러오는 중 오류가 발생했습니다.';
        res.status(500).json({ error: message });
    }
});

// ========================================
// 건물 관련 API
// ========================================

// 건물 목록 조회
router.get('/:farmId/buildings', isAuthenticated, checkFarmPermission, async (req, res) => {
    try {
        const { farmId } = req.params;
        const buildings = await FarmBuilding.findAll({
            where: { farmId, isActive: true },
            order: [['orderIndex', 'ASC'], ['createdAt', 'ASC']]
        });
        res.json(buildings);
    } catch (error) {
        console.error('건물 목록 조회 오류:', error);
        res.status(500).json({ error: '건물 목록을 불러오는 중 오류가 발생했습니다.' });
    }
});

// 건물 추가: 1동 = 1 row, totalFloors 로 층 수만 저장 (실제 층 구분은 farm_barns.floorNumber)
router.post('/:farmId/buildings', isAuthenticated, checkFarmPermission, async (req, res) => {
    try {
        const { farmId } = req.params;
        const { name, code, description, orderIndex, totalFloors } = req.body;

        if (!name) {
            return res.status(400).json({ error: '건물명은 필수입니다.' });
        }

        const floorsInput = parseInt(totalFloors, 10);
        const total = Number.isInteger(floorsInput) && floorsInput > 0 ? floorsInput : 1;

        const building = await FarmBuilding.create({
            farmId,
            name,
            code,
            description,
            totalFloors: total,
            orderIndex: orderIndex || 0
        });

        res.status(201).json(building);
    } catch (error) {
        console.error('건물 추가 오류:', error);
        res.status(500).json({ error: '건물 추가 중 오류가 발생했습니다.' });
    }
});

// 건물 수정: 1 row만 갱신 (이름/코드/설명/층수)
router.put('/buildings/:buildingId', isAuthenticated, async (req, res) => {
    try {
        const { buildingId } = req.params;
        const { name, code, description, orderIndex, totalFloors } = req.body;

        const building = await FarmBuilding.findByPk(buildingId);
        if (!building) {
            return res.status(404).json({ error: '건물을 찾을 수 없습니다.' });
        }

        req.params.farmId = building.farmId;
        await new Promise((resolve, reject) => {
            checkFarmPermission(req, res, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        const updates = { name, code, description, orderIndex };
        const parsed = parseInt(totalFloors, 10);
        if (Number.isInteger(parsed) && parsed > 0) updates.totalFloors = parsed;

        await building.update(updates);
        res.json(await FarmBuilding.findByPk(buildingId));
    } catch (error) {
        console.error('건물 수정 오류:', error);
        res.status(500).json({ error: '건물 수정 중 오류가 발생했습니다.' });
    }
});

// 건물 삭제: farm_buildings 1 row 삭제 (동 1개 = 1 row)
router.delete('/buildings/:buildingId', isAuthenticated, async (req, res) => {
    try {
        const { buildingId } = req.params;
        if (!buildingId || typeof buildingId !== 'string') {
            return res.status(400).json({ error: '건물 UUID가 필요합니다.' });
        }

        const row = await FarmBuilding.findByPk(buildingId.trim());
        if (!row) {
            return res.status(404).json({ error: '건물을 찾을 수 없습니다.' });
        }

        req.params.farmId = row.farmId;
        await new Promise((resolve, reject) => {
            checkFarmPermission(req, res, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        await row.destroy();
        res.json({ message: '건물이 삭제되었습니다.' });
    } catch (error) {
        console.error('건물 삭제 오류:', error);
        res.status(500).json({ error: '건물 삭제 중 오류가 발생했습니다.' });
    }
});

// ========================================
// 돈사 관련 API
// ========================================

// 돈사 추가
router.post('/buildings/:buildingId/barns', isAuthenticated, async (req, res) => {
    try {
        const { buildingId } = req.params;
        const { name, barnType, description, orderIndex, floorNumber } = req.body;

        const building = await FarmBuilding.findByPk(buildingId);
        if (!building) {
            return res.status(404).json({ error: '건물을 찾을 수 없습니다.' });
        }

        // 권한 확인
        req.params.farmId = building.farmId;
        await new Promise((resolve, reject) => {
            checkFarmPermission(req, res, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        if (!name) {
            return res.status(400).json({ error: '돈사명은 필수입니다.' });
        }

        const barn = await FarmBarn.create({
            buildingId,
            farmId: building.farmId,
            name,
            barnType,
            floorNumber: Number.isInteger(parseInt(floorNumber, 10)) ? parseInt(floorNumber, 10) : null,
            description,
            orderIndex: orderIndex || 0
        });

        res.status(201).json(barn);
    } catch (error) {
        console.error('돈사 추가 오류:', error);
        res.status(500).json({ error: '돈사 추가 중 오류가 발생했습니다.' });
    }
});

// 돈사 수정
router.put('/barns/:barnId', isAuthenticated, async (req, res) => {
    try {
        const { barnId } = req.params;
        const { name, barnType, description, orderIndex } = req.body;

        const barn = await FarmBarn.findByPk(barnId);
        if (!barn) {
            return res.status(404).json({ error: '돈사를 찾을 수 없습니다.' });
        }

        // 권한 확인
        req.params.farmId = barn.farmId;
        await new Promise((resolve, reject) => {
            checkFarmPermission(req, res, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        await barn.update({ name, barnType, description, orderIndex });
        res.json(barn);
    } catch (error) {
        console.error('돈사 수정 오류:', error);
        res.status(500).json({ error: '돈사 수정 중 오류가 발생했습니다.' });
    }
});

// 돈사 삭제
router.delete('/barns/:barnId', isAuthenticated, async (req, res) => {
    try {
        const { barnId } = req.params;

        const barn = await FarmBarn.findByPk(barnId);
        if (!barn) {
            return res.status(404).json({ error: '돈사를 찾을 수 없습니다.' });
        }

        // 권한 확인
        req.params.farmId = barn.farmId;
        await new Promise((resolve, reject) => {
            checkFarmPermission(req, res, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        await barn.destroy();
        res.json({ message: '돈사가 삭제되었습니다.' });
    } catch (error) {
        console.error('돈사 삭제 오류:', error);
        res.status(500).json({ error: '돈사 삭제 중 오류가 발생했습니다.' });
    }
});

// ========================================
// 방 관련 API
// ========================================

// 방 추가 (단일)
router.post('/barns/:barnId/rooms', isAuthenticated, async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { barnId } = req.params;
        const { name, roomNumber, sectionCount, area, capacityPerSection, description, orderIndex } = req.body;

        const barn = await FarmBarn.findByPk(barnId);
        if (!barn) {
            await transaction.rollback();
            return res.status(404).json({ error: '돈사를 찾을 수 없습니다.' });
        }

        // 권한 확인
        req.params.farmId = barn.farmId;
        await new Promise((resolve, reject) => {
            checkFarmPermission(req, res, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        if (!name) {
            await transaction.rollback();
            return res.status(400).json({ error: '방 이름은 필수입니다.' });
        }

        const finalSectionCount = sectionCount ?? 1;
        const totalCapacity = capacityPerSection ? finalSectionCount * capacityPerSection : null;

        // 방 생성
        const room = await FarmRoom.create({
            barnId,
            buildingId: barn.buildingId,
            farmId: barn.farmId,
            name,
            roomNumber,
            sectionCount: finalSectionCount,
            area,
            capacityPerSection,
            totalCapacity,
            description,
            orderIndex: orderIndex || 0
        }, { transaction });

        // 칸 자동 생성
        const sections = [];
        for (let i = 1; i <= finalSectionCount; i++) {
            sections.push({
                roomId: room.id,
                barnId: barn.id,
                buildingId: barn.buildingId,
                farmId: barn.farmId,
                name: `${i}칸`,
                sectionNumber: i,
                area: room.areaPerSection || null,
                capacity: capacityPerSection || null,
                orderIndex: i - 1
            });
        }

        if (sections.length > 0) {
            await FarmSection.bulkCreate(sections, { transaction });
        }

        await transaction.commit();
        res.status(201).json(room);
    } catch (error) {
        await transaction.rollback();
        console.error('방 추가 오류:', error);
        res.status(500).json({ error: '방 추가 중 오류가 발생했습니다.' });
    }
});

// 방 일괄 추가
router.post('/barns/:barnId/rooms/bulk', isAuthenticated, async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { barnId } = req.params;
        const { rooms } = req.body; // Array of room objects

        const barn = await FarmBarn.findByPk(barnId);
        if (!barn) {
            await transaction.rollback();
            return res.status(404).json({ error: '돈사를 찾을 수 없습니다.' });
        }

        // 권한 확인
        req.params.farmId = barn.farmId;
        await new Promise((resolve, reject) => {
            checkFarmPermission(req, res, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        if (!Array.isArray(rooms) || rooms.length === 0) {
            await transaction.rollback();
            return res.status(400).json({ error: '방 데이터가 필요합니다.' });
        }

        const createdRooms = [];
        const allSections = [];

        for (const roomData of rooms) {
            const { name, roomNumber, sectionCount, area, capacityPerSection, description, orderIndex } = roomData;

            const finalSectionCount = sectionCount ?? 1;
            const totalCapacity = capacityPerSection ? finalSectionCount * capacityPerSection : null;

            // 방 생성
            const room = await FarmRoom.create({
                barnId,
                buildingId: barn.buildingId,
                farmId: barn.farmId,
                name,
                roomNumber,
                sectionCount: finalSectionCount,
                area,
                capacityPerSection,
                totalCapacity,
                description,
                orderIndex: orderIndex || 0
            }, { transaction });

            createdRooms.push(room);

            // 칸 생성
            for (let i = 1; i <= finalSectionCount; i++) {
                allSections.push({
                    roomId: room.id,
                    barnId: barn.id,
                    buildingId: barn.buildingId,
                    farmId: barn.farmId,
                    name: `${i}칸`,
                    sectionNumber: i,
                    area: room.areaPerSection || null,
                    capacity: capacityPerSection || null,
                    orderIndex: i - 1
                });
            }
        }

        if (allSections.length > 0) {
            await FarmSection.bulkCreate(allSections, { transaction });
        }

        await transaction.commit();
        res.status(201).json({
            message: `${createdRooms.length}개의 방이 추가되었습니다.`,
            rooms: createdRooms
        });
    } catch (error) {
        await transaction.rollback();
        console.error('방 일괄 추가 오류:', error);
        res.status(500).json({ error: '방 일괄 추가 중 오류가 발생했습니다.' });
    }
});

// 방 수정 (칸 수 변경 시 자동으로 칸 추가/삭제)
router.put('/rooms/:roomId', isAuthenticated, async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { roomId } = req.params;
        const { name, roomNumber, sectionCount, area, capacityPerSection, description, orderIndex } = req.body;

        const room = await FarmRoom.findByPk(roomId);
        if (!room) {
            await transaction.rollback();
            return res.status(404).json({ error: '방을 찾을 수 없습니다.' });
        }

        // 권한 확인
        req.params.farmId = room.farmId;
        await new Promise((resolve, reject) => {
            checkFarmPermission(req, res, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        const oldSectionCount = room.sectionCount;
        const newSectionCount = sectionCount !== undefined ? sectionCount : oldSectionCount;

        // 방 정보 업데이트
        const totalCapacity = capacityPerSection ? newSectionCount * capacityPerSection : room.totalCapacity;
        await room.update({
            name,
            roomNumber,
            sectionCount: newSectionCount,
            area,
            capacityPerSection,
            totalCapacity,
            description,
            orderIndex
        }, { transaction });

        // 칸 수가 변경된 경우
        if (newSectionCount !== oldSectionCount) {
            if (newSectionCount > oldSectionCount) {
                // 칸 추가
                const newSections = [];
                for (let i = oldSectionCount + 1; i <= newSectionCount; i++) {
                    newSections.push({
                        roomId: room.id,
                        barnId: room.barnId,
                        buildingId: room.buildingId,
                        farmId: room.farmId,
                        name: `${i}칸`,
                        sectionNumber: i,
                        area: room.areaPerSection || null,
                        capacity: capacityPerSection || null,
                        orderIndex: i - 1
                    });
                }
                if (newSections.length > 0) {
                    await FarmSection.bulkCreate(newSections, { transaction });
                }
            } else {
                // 칸 삭제 (마지막 칸부터)
                await FarmSection.destroy({
                    where: {
                        roomId: room.id,
                        sectionNumber: {
                            [Op.gt]: newSectionCount
                        }
                    },
                    transaction
                });
            }
        }

        await transaction.commit();
        res.json(room);
    } catch (error) {
        await transaction.rollback();
        console.error('방 수정 오류:', error);
        res.status(500).json({ error: '방 수정 중 오류가 발생했습니다.' });
    }
});

// 방 삭제
router.delete('/rooms/:roomId', isAuthenticated, async (req, res) => {
    try {
        const { roomId } = req.params;

        const room = await FarmRoom.findByPk(roomId);
        if (!room) {
            return res.status(404).json({ error: '방을 찾을 수 없습니다.' });
        }

        // 권한 확인
        req.params.farmId = room.farmId;
        await new Promise((resolve, reject) => {
            checkFarmPermission(req, res, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        await room.destroy();
        res.json({ message: '방이 삭제되었습니다.' });
    } catch (error) {
        console.error('방 삭제 오류:', error);
        res.status(500).json({ error: '방 삭제 중 오류가 발생했습니다.' });
    }
});

// ========================================
// 칸 관련 API
// ========================================

// 특정 방의 칸 목록 조회
router.get('/rooms/:roomId/sections', isAuthenticated, async (req, res) => {
    try {
        const { roomId } = req.params;

        const room = await FarmRoom.findByPk(roomId);
        if (!room) {
            return res.status(404).json({ error: '방을 찾을 수 없습니다.' });
        }

        const sections = await FarmSection.findAll({
            where: { roomId, isActive: true },
            order: [['sectionNumber', 'ASC']]
        });

        res.json(sections);
    } catch (error) {
        console.error('칸 목록 조회 오류:', error);
        res.status(500).json({ error: '칸 목록을 불러오는 중 오류가 발생했습니다.' });
    }
});

// 칸 정보 수정 (사육 데이터 업데이트)
router.put('/sections/:sectionId', isAuthenticated, async (req, res) => {
    try {
        const { sectionId } = req.params;
        const {
            currentPigCount, averageWeight, entryDate, birthDate,
            breedType, area, capacity
        } = req.body;

        const section = await FarmSection.findByPk(sectionId);
        if (!section) {
            return res.status(404).json({ error: '칸을 찾을 수 없습니다.' });
        }

        // 권한 확인
        req.params.farmId = section.farmId;
        await new Promise((resolve, reject) => {
            checkFarmPermission(req, res, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        await section.update({
            currentPigCount,
            averageWeight,
            entryDate,
            birthDate,
            breedType,
            area,
            capacity
        });

        res.json(section);
    } catch (error) {
        console.error('칸 정보 수정 오류:', error);
        res.status(500).json({ error: '칸 정보 수정 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
