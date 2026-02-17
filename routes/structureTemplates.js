const express = require('express');
const router = express.Router();
const StructureTemplate = require('../models/StructureTemplate');

// 순서 변경 핸들러 (server.js에서 직접 경로 등록 시 사용)
async function handleReorder(req, res) {
    try {
        const { id, direction } = req.body;
        if (id == null || id === '') {
            return res.status(400).json({ error: 'id가 필요합니다.' });
        }
        if (direction !== 'up' && direction !== 'down') {
            return res.status(400).json({ error: 'direction은 up 또는 down 이어야 합니다.' });
        }
        const template = await StructureTemplate.findByPk(id);
        if (!template) {
            return res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
        }
        const category = template.category;
        const currentOrder = template.sortOrder ?? 0;
        const siblings = await StructureTemplate.findAll({
            where: { category },
            attributes: ['id', 'sortOrder'],
            order: [['sortOrder', 'ASC'], ['id', 'ASC']]
        });
        const index = siblings.findIndex(s => String(s.id) === String(id));
        if (index < 0) {
            return res.status(404).json({ error: '같은 카테고리 내에서 항목을 찾을 수 없습니다.' });
        }
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        if (swapIndex < 0 || swapIndex >= siblings.length) {
            return res.json({ message: '이미 맨 위/맨 아래입니다.', template });
        }
        const swap = siblings[swapIndex];
        await Promise.all([
            template.update({ sortOrder: swap.sortOrder }),
            StructureTemplate.findByPk(swap.id).then(t => t.update({ sortOrder: currentOrder }))
        ]);
        const updated = await StructureTemplate.findByPk(id);
        res.json(updated);
    } catch (error) {
        console.error('구조 템플릿 순서 변경 오류:', error);
        res.status(500).json({ error: '순서 변경 중 오류가 발생했습니다.' });
    }
}

// 모든 템플릿 조회 (사육 시설 → 일반 시설 순, 각 카테고리 내 sortOrder 순)
router.get('/', async (req, res) => {
    try {
        const templates = await StructureTemplate.findAll({
            order: [
                ['category', 'DESC'],
                ['sortOrder', 'ASC'],
                ['id', 'ASC']
            ]
        });
        res.json(templates);
    } catch (error) {
        console.error('구조 템플릿 조회 오류:', error);
        res.status(500).json({ error: '템플릿 데이터를 불러오는 중 오류가 발생했습니다.' });
    }
});

// 템플릿 추가 (해당 카테고리 내 맨 뒤 순서로)
router.post('/', async (req, res) => {
    try {
        const { name, category, weight, optimalDensity, description } = req.body;

        const maxSort = await StructureTemplate.max('sortOrder', {
            where: { category: category || 'production' }
        });
        const sortOrder = (maxSort != null ? maxSort : -1) + 1;

        const newTemplate = await StructureTemplate.create({
            name,
            category,
            weight,
            optimalDensity,
            description,
            sortOrder
        });
        res.status(201).json(newTemplate);
    } catch (error) {
        console.error('구조 템플릿 추가 오류:', error);
        res.status(500).json({ error: '템플릿 추가 중 오류가 발생했습니다.' });
    }
});

// 순서 변경 (라우터 내부에서도 등록 — 서버에서 직접 등록 시 중복 호출 방지)
router.post('/reorder', handleReorder);

// 템플릿 수정
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, category, weight, optimalDensity, description, sortOrder } = req.body;

        const template = await StructureTemplate.findByPk(id);
        if (!template) {
            return res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
        }

        const updates = { name, category, weight, optimalDensity, description };
        if (sortOrder !== undefined) updates.sortOrder = parseInt(sortOrder, 10);
        await template.update(updates);
        res.json(template);
    } catch (error) {
        console.error('구조 템플릿 수정 오류:', error);
        res.status(500).json({ error: '템플릿 수정 중 오류가 발생했습니다.' });
    }
});

// 템플릿 삭제
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const template = await StructureTemplate.findByPk(id);
        if (!template) {
            return res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
        }

        await template.destroy();
        res.json({ message: '템플릿이 삭제되었습니다.' });
    } catch (error) {
        console.error('구조 템플릿 삭제 오류:', error);
        res.status(500).json({ error: '템플릿 삭제 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
module.exports.handleReorder = handleReorder;
