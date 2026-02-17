const express = require('express');
const router = express.Router();
const FeedType = require('../models/FeedType');

// 초기 데이터 시딩 함수
async function seedInitialData() {
    const count = await FeedType.count();
    if (count === 0) {
        const initialFeeds = [
            { name: '입질 사료 (1호)', manufacturer: '축협', targetStage: '포유자돈', description: '생후 7일령부터 이유 시까지 급여, 소화율 높은 유단백질 강화', nutrients: '조단백 22%, 조지방 5%' },
            { name: '이유자돈 사료 (2호)', manufacturer: '축협', targetStage: '이유자돈', description: '이유 직후 스트레스 완화, 성장 촉진 및 설사 예방', nutrients: '조단백 20%, 라이신 1.4%' },
            { name: '육성돈 사료 (전기)', manufacturer: '대한사료', targetStage: '육성돈', description: '체중 30~60kg 구간 급여, 골격 및 근육 발달 촉진', nutrients: '조단백 18%, 조지방 3.5%' },
            { name: '비육돈 사료 (후기)', manufacturer: '대한사료', targetStage: '비육돈', description: '체중 60kg~출하 시까지 급여, 육질 개선 및 증체율 향상', nutrients: '조단백 16%, 조지방 4%' },
            { name: '임신돈 사료', manufacturer: '선진', targetStage: '임신모돈', description: '임신 기간 중 태아 발달 및 모돈 체형 유지', nutrients: '조단백 13%, 조섬유 8%' },
            { name: '포유돈 사료', manufacturer: '선진', targetStage: '포유모돈', description: '포유 기간 중 비유량 극대화 및 체중 손실 최소화', nutrients: '조단백 17%, 에너지 3300kcal' }
        ];
        await FeedType.bulkCreate(initialFeeds);
        console.log('초기 사료 종류 데이터 생성 완료');
    }
}

// 모든 사료 조회
router.get('/', async (req, res) => {
    try {
        await seedInitialData();
        const feeds = await FeedType.findAll({ order: [['targetStage', 'ASC'], ['name', 'ASC']] });
        res.json(feeds);
    } catch (error) {
        console.error('사료 조회 오류:', error);
        res.status(500).json({ error: '사료 데이터를 불러오는 중 오류가 발생했습니다.' });
    }
});

// 사료 추가
router.post('/', async (req, res) => {
    try {
        const { name, manufacturer, description, targetStage, nutrients } = req.body;

        // 중복 이름 확인
        const existing = await FeedType.findOne({ where: { name } });
        if (existing) {
            return res.status(400).json({ error: '이미 존재하는 사료명입니다.' });
        }

        const newFeed = await FeedType.create({
            name, manufacturer, description, targetStage, nutrients
        });
        res.status(201).json(newFeed);
    } catch (error) {
        console.error('사료 추가 오류:', error);
        res.status(500).json({ error: '사료 추가 중 오류가 발생했습니다.' });
    }
});

// 사료 수정
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, manufacturer, description, targetStage, nutrients } = req.body;

        const feed = await FeedType.findByPk(id);
        if (!feed) {
            return res.status(404).json({ error: '사료를 찾을 수 없습니다.' });
        }

        if (name && name !== feed.name) {
            const existing = await FeedType.findOne({ where: { name } });
            if (existing) {
                return res.status(400).json({ error: '이미 존재하는 사료명입니다.' });
            }
        }

        await feed.update({ name, manufacturer, description, targetStage, nutrients });
        res.json(feed);
    } catch (error) {
        console.error('사료 수정 오류:', error);
        res.status(500).json({ error: '사료 수정 중 오류가 발생했습니다.' });
    }
});

// 사료 삭제
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const feed = await FeedType.findByPk(id);
        if (!feed) {
            return res.status(404).json({ error: '사료를 찾을 수 없습니다.' });
        }

        await feed.destroy();
        res.json({ message: '사료가 삭제되었습니다.' });
    } catch (error) {
        console.error('사료 삭제 오류:', error);
        res.status(500).json({ error: '사료 삭제 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
