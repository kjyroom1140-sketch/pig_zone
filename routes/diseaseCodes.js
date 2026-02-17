const express = require('express');
const router = express.Router();
const DiseaseCode = require('../models/DiseaseCode');

// 초기 데이터 시딩
async function seedInitialData() {
    const count = await DiseaseCode.count();
    if (count === 0) {
        const initialDiseases = [
            {
                code: 'FMD',
                name: '구제역',
                englishName: 'Foot-and-mouth disease (FMD)',
                symptoms: '고열(40~41도), 구강, 발굽, 유두 등에 수포 형성, 식욕 부진, 절뚝거림',
                prevention: '정기적인 백신 접종(의무), 철저한 차단 방역 및 소독'
            },
            {
                code: 'PED',
                name: '돼지 유행성 설사병',
                englishName: 'Porcine Epidemic Diarrhea (PED)',
                symptoms: '심한 수양성 설사, 구토, 탈수. 특히 포유자돈(신생아)에 치명적이며 폐사율 높음',
                prevention: '임신 모돈 백신 접종을 통한 초유 면역 형성, 외부 출입 통제, 인공감염 활용'
            },
            {
                code: 'PRRS',
                name: '돼지 생식기 호흡기 증후군',
                englishName: 'Porcine Reproductive and Respiratory Syndrome (PRRS)',
                symptoms: '모돈의 유산/조산/사산, 자돈의 호흡기 질환 및 성장 지연',
                prevention: '백신 접종(생/사백신), 돈군 폐쇄 및 외부 유입 차단, 돈사 올인-올아웃 관리'
            },
            {
                code: 'CSF',
                name: '돼지열병 (콜레라)',
                englishName: 'Classical Swine Fever (CSF / Hog Cholera)',
                symptoms: '고열, 식욕 부진, 변비/설사 반복, 피부 출혈 반점, 신경 증상(경련)',
                prevention: '국가 필수 예방 접종, 미네랄/비타민 공급으로 면역력 증진'
            },
            {
                code: 'PMWS',
                name: '이유후 전신 소모성 질병 (써코)',
                englishName: 'Postweaning Multisystemic Wasting Syndrome',
                symptoms: '이유 자돈의 체중 감소, 쇠약, 호흡 곤란, 피부 창백 및 황달',
                prevention: '써코바이러스(PCV2) 백신 접종, 사육 밀도 완화, 환기 개선, 위생 관리'
            },
            {
                code: 'SEP',
                name: '유행성 폐렴 (마이코플라즈마)',
                englishName: 'Swine Enzootic Pneumonia (SEP)',
                symptoms: '만성적인 건성 기침, 사료 효율 감소, 성장 지연. 도축 시 폐 병변 관찰',
                prevention: '마이코플라즈마 백신 접종, 적절한 환기 및 온습도 관리, 올인-올아웃'
            },
            {
                code: 'JE',
                name: '일본뇌염',
                englishName: 'Japanese Encephalitis',
                symptoms: '임신돈의 유산/사산(미라), 웅돈의 고환염 및 불임, 자돈의 신경 증상',
                prevention: '모기 출현 전(4~5월) 백신 접종, 농장 주변 모기 서식지 제거'
            }
        ];
        await DiseaseCode.bulkCreate(initialDiseases);
        console.log('초기 질병 코드 데이터 생성 완료');
    }
}

// 모든 질병 조회
router.get('/', async (req, res) => {
    try {
        await seedInitialData();
        const diseases = await DiseaseCode.findAll({ order: [['code', 'ASC']] });
        res.json(diseases);
    } catch (error) {
        console.error('질병 조회 오류:', error);
        res.status(500).json({ error: '질병 데이터를 불러오는 중 오류가 발생했습니다.' });
    }
});

// 질병 추가
router.post('/', async (req, res) => {
    try {
        const { code, name, englishName, symptoms, prevention } = req.body;

        const existing = await DiseaseCode.findOne({ where: { code } });
        if (existing) {
            return res.status(400).json({ error: '이미 존재하는 질병 코드입니다.' });
        }

        const newDisease = await DiseaseCode.create({
            code, name, englishName, symptoms, prevention
        });
        res.status(201).json(newDisease);
    } catch (error) {
        console.error('질병 추가 오류:', error);
        res.status(500).json({ error: '질병 추가 중 오류가 발생했습니다.' });
    }
});

// 질병 수정
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { code, name, englishName, symptoms, prevention } = req.body;

        const disease = await DiseaseCode.findByPk(id);
        if (!disease) {
            return res.status(404).json({ error: '질병을 찾을 수 없습니다.' });
        }

        if (code && code !== disease.code) {
            const existing = await DiseaseCode.findOne({ where: { code } });
            if (existing) {
                return res.status(400).json({ error: '이미 존재하는 질병 코드입니다.' });
            }
        }

        await disease.update({ code, name, englishName, symptoms, prevention });
        res.json(disease);
    } catch (error) {
        console.error('질병 수정 오류:', error);
        res.status(500).json({ error: '질병 수정 중 오류가 발생했습니다.' });
    }
});

// 질병 삭제
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const disease = await DiseaseCode.findByPk(id);
        if (!disease) {
            return res.status(404).json({ error: '질병을 찾을 수 없습니다.' });
        }

        await disease.destroy();
        res.json({ message: '질병이 삭제되었습니다.' });
    } catch (error) {
        console.error('질병 삭제 오류:', error);
        res.status(500).json({ error: '질병 삭제 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
