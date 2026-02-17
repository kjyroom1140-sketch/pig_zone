const express = require('express');
const router = express.Router();
const PigBreed = require('../models/PigBreed');

// 초기 데이터 시딩 함수
async function seedInitialData() {
    const count = await PigBreed.count();
    if (count === 0) {
        const initialBreeds = [
            { code: 'L', nameKo: '랜드레이스', nameEn: 'Landrace', characteristics: '번식 능력 우수, 포유 능력 좋음, 귀가 앞으로 쳐짐', usage: '모계 (번식용)', description: '덴마크 원산의 백색종으로, 체형이 길고 귀가 앞으로 쳐져 있습니다. 산자수(새끼 수)가 많고 포유 능력이 좋아 주로 모계 품종으로 사용됩니다.' },
            { code: 'Y', nameKo: '요크셔 (대요크셔)', nameEn: 'Yorkshire (Large White)', characteristics: '산자수 많음, 포유 능력 우수, 귀가 쫑긋함', usage: '모계 (번식용)', description: '영국 원산의 백색종으로, 귀가 쫑긋 서 있습니다. 번식 능력과 포유 능력이 우수하며 성장 속도도 빨라 랜드레이스와 함께 모계 품종으로 널리 사용됩니다.' },
            { code: 'D', nameKo: '듀록', nameEn: 'Duroc', characteristics: '성장 속도 빠름, 육질 우수, 적색 털', usage: '부계 (비육 생산용)', description: '미국 원산의 적색종으로, 근육량이 많고 성장 속도가 빠릅니다. 육질(마블링)이 우수하여 주로 비육돈 생산을 위한 부계 품종으로 사용됩니다.' },
            { code: 'B', nameKo: '버크셔', nameEn: 'Berkshire', characteristics: '흑돼지, 육질 최상 (마블링 우수), 600지방', usage: '육질 개량용', description: '영국 원산의 흑색종으로 코, 꼬리, 네 다리 끝이 흰색(육백)인 것이 특징입니다. 육질이 매우 뛰어나 프리미엄 돈육 생산에 활용됩니다.' },
            { code: 'H', nameKo: '햄프셔', nameEn: 'Hampshire', characteristics: '등심 단면적 넓음, 근육량 많음, 어깨 띠 무늬', usage: '육량 개량용', description: '미국/영국 원산으로 흑색 바탕에 어깨 부분에 흰 띠가 있습니다. 근육량이 많고 등지방이 얇아 육량형 돼지 생산에 유리합니다.' },
            { code: 'YLD', nameKo: '삼원교잡종 (비육돈)', nameEn: 'YLD (Yorkshire x Landrace x Duroc)', characteristics: '잡종 강세 효과, 성장 빠르고 육질 우수', usage: '비육돈 (출하용)', description: '요크셔(Y)와 랜드레이스(L)를 교잡한 F1 모돈에 듀록(D) 웅돈을 교배하여 생산한 비육돈입니다. 각 품종의 장점을 결합하여 생산성과 육질을 모두 갖췄습니다.' },
            { code: 'KNP', nameKo: '재래돼지 (흑돼지)', nameEn: 'Korean Native Pig', characteristics: '체구 작음, 번식력 낮음, 육질 및 맛 탁월', usage: '특수 육류 생산', description: '우리나라 고유의 재래종으로 검은 털을 가집니다. 성장이 느리고 새끼 수가 적지만, 고기의 맛과 풍미가 뛰어나 별미로 취급됩니다.' }
        ];
        await PigBreed.bulkCreate(initialBreeds);
        console.log('초기 품종 데이터 생성 완료');
    }
}

// 모든 품종 조회
router.get('/', async (req, res) => {
    try {
        await seedInitialData(); // 데이터가 없으면 시딩
        const breeds = await PigBreed.findAll({ order: [['id', 'ASC']] });
        res.json(breeds);
    } catch (error) {
        console.error('품종 조회 오류:', error);
        res.status(500).json({ error: '데이터를 불러오는 중 오류가 발생했습니다.' });
    }
});

// 품종 추가
router.post('/', async (req, res) => {
    try {
        const { code, nameKo, nameEn, description, characteristics, usage } = req.body;

        // 중복 코드 확인
        const existing = await PigBreed.findOne({ where: { code } });
        if (existing) {
            return res.status(400).json({ error: '이미 존재하는 품종 코드입니다.' });
        }

        const newBreed = await PigBreed.create({
            code, nameKo, nameEn, description, characteristics, usage
        });
        res.status(201).json(newBreed);
    } catch (error) {
        console.error('품종 추가 오류:', error);
        res.status(500).json({ error: '품종 추가 중 오류가 발생했습니다.' });
    }
});

// 품종 수정
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { code, nameKo, nameEn, description, characteristics, usage } = req.body;

        const breed = await PigBreed.findByPk(id);
        if (!breed) {
            return res.status(404).json({ error: '품종을 찾을 수 없습니다.' });
        }

        // 코드는 변경 시 중복 체크 필요 (자기 자신 제외)
        if (code && code !== breed.code) {
            const existing = await PigBreed.findOne({ where: { code } });
            if (existing) {
                return res.status(400).json({ error: '이미 존재하는 품종 코드입니다.' });
            }
        }

        await breed.update({ code, nameKo, nameEn, description, characteristics, usage });
        res.json(breed);
    } catch (error) {
        console.error('품종 수정 오류:', error);
        res.status(500).json({ error: '품종 수정 중 오류가 발생했습니다.' });
    }
});

// 품종 삭제
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const breed = await PigBreed.findByPk(id);
        if (!breed) {
            return res.status(404).json({ error: '품종을 찾을 수 없습니다.' });
        }

        await breed.destroy();
        res.json({ message: '품종이 삭제되었습니다.' });
    } catch (error) {
        console.error('품종 삭제 오류:', error);
        res.status(500).json({ error: '품종 삭제 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
