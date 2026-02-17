const express = require('express');
const router = express.Router();
const VaccineType = require('../models/VaccineType');

// 초기 데이터 시딩
async function seedInitialData() {
    const count = await VaccineType.count();
    if (count === 0) {
        const initialVaccines = [
            {
                name: '구제역 O+A형 2가 백신',
                targetDisease: '구제역 (FMD)',
                manufacturer: '녹십자수의약품 / 코미팜 등',
                method: '이근부 근육주사',
                dosage: '2ml',
                timing: '육성돈: 8~12주령 1차, 4주 후 2차 권장 / 모돈: 분만 3~4주 전',
                description: '국가 필수 접종 백신. 우제류의 급성 전염병 예방. 접종 2주 전부터 스트레스 최소화 필요. 과태료 대상 항목.'
            },
            {
                name: '돼지열병 생백신 (LOM주)',
                targetDisease: '돼지열병 (CSF)',
                manufacturer: '다수 제조사',
                method: '근육주사',
                dosage: '1ml',
                timing: '자돈: 40일령(1차), 60일령(2차) / 모돈: 종부 전 교배 2~4주 전',
                description: '전염성이 매우 강한 바이러스성 질병. 백신 접종이 의무화되어 있으며, 롬주(LOM) 백신 또는 마커 백신 사용. 항체 형성률 확인 필요.'
            },
            {
                name: 'PRRS 생백신 (MLV)',
                targetDisease: '돼지생식기호흡기증후군 (PRRS)',
                manufacturer: '베링거인겔하임 등',
                method: '근육주사',
                dosage: '2ml',
                timing: '자돈: 3주령 이후 / 모돈: 분만 후 6~7일 또는 일괄 접종',
                description: '양돈 농가 생산성에 가장 큰 영향을 미치는 호흡기/번식 질병. 농장 상황(음성/양성/안정화)에 따라 접종 프로그램이 상이하므로 수의사 상담 권장.'
            },
            {
                name: '써코바이러스 백신 (PCV2)',
                targetDisease: '이유후전신소모성질병 (PMWS)',
                manufacturer: '조에티스 / MSD 등',
                method: '근육주사',
                dosage: '1ml 또는 2ml (제품별 상이)',
                timing: '자돈: 3~4주령 1회 접종 또는 3주 간격 2회',
                description: '자돈의 위축, 폐사율 증가를 유발하는 소모성 질병 예방. 마이코플라즈마 백신과 혼합 사용 가능한 제품도 있음.'
            },
            {
                name: '마이코플라즈마 백신 (유행성 폐렴)',
                targetDisease: '유행성 폐렴 (SEP)',
                manufacturer: '다수 제조사',
                method: '근육주사',
                dosage: '2ml',
                timing: '자돈: 1~3주령 1차, 3주 후 2차',
                description: '만성 호흡기 질병으로 사료 효율 저하 및 성장 지연 유발. 환기 관리와 병행하여 접종 필요.'
            },
            {
                name: '돈단독 사백신',
                targetDisease: '돈단독 (Erysipelas)',
                manufacturer: '다수 제조사',
                method: '근육주사',
                dosage: '2ml',
                timing: '육성돈: 40~60일령 1차, 4주 후 2차 / 모돈: 분만 3~4주 전',
                description: '급성 패혈증 및 관절염 유발. 여름철 발생 빈도가 높으며, 인수공통전염병이므로 관리 주의.'
            },
            {
                name: '일본뇌염 생백신',
                targetDisease: '일본뇌염 (JEV)',
                manufacturer: '다수 제조사',
                method: '근육주사',
                dosage: '1ml',
                timing: '모돈/후보돈: 모기 출현 전 (4~5월) 2회 접종',
                description: '모기를 매개로 전파되며, 임신돈 유산 및 사산(미라) 유발. 웅돈의 고환염 원인.'
            },
            {
                name: 'PED-TGE-Rota 혼합 백신',
                targetDisease: '유행성 설사병 (PED)',
                manufacturer: '다수 제조사',
                method: '근육주사 또는 경구투여',
                dosage: '제품별 상이',
                timing: '임신모돈: 분만 5주 전, 2주 전 2회 접종',
                description: '포유자돈의 급성 설사 및 높은 폐사율 유발. 초유를 통한 면역 전달이 중요하므로 모돈 접종 필수.'
            }
        ];
        await VaccineType.bulkCreate(initialVaccines);
        console.log('초기 백신 종류 데이터 생성 완료');
    }
}

// 모든 백신 조회
router.get('/', async (req, res) => {
    try {
        await seedInitialData();
        const vaccines = await VaccineType.findAll({ order: [['targetDisease', 'ASC'], ['name', 'ASC']] });
        res.json(vaccines);
    } catch (error) {
        console.error('백신 조회 오류:', error);
        res.status(500).json({ error: '백신 데이터를 불러오는 중 오류가 발생했습니다.' });
    }
});

// 백신 추가
router.post('/', async (req, res) => {
    try {
        const { name, targetDisease, manufacturer, method, dosage, timing, description } = req.body;

        const existing = await VaccineType.findOne({ where: { name } });
        if (existing) {
            return res.status(400).json({ error: '이미 존재하는 백신명입니다.' });
        }

        const newVaccine = await VaccineType.create({
            name, targetDisease, manufacturer, method, dosage, timing, description
        });
        res.status(201).json(newVaccine);
    } catch (error) {
        console.error('백신 추가 오류:', error);
        res.status(500).json({ error: '백신 추가 중 오류가 발생했습니다.' });
    }
});

// 백신 수정
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, targetDisease, manufacturer, method, dosage, timing, description } = req.body;

        const vaccine = await VaccineType.findByPk(id);
        if (!vaccine) {
            return res.status(404).json({ error: '백신을 찾을 수 없습니다.' });
        }

        if (name && name !== vaccine.name) {
            const existing = await VaccineType.findOne({ where: { name } });
            if (existing) {
                return res.status(400).json({ error: '이미 존재하는 백신명입니다.' });
            }
        }

        await vaccine.update({ name, targetDisease, manufacturer, method, dosage, timing, description });
        res.json(vaccine);
    } catch (error) {
        console.error('백신 수정 오류:', error);
        res.status(500).json({ error: '백신 수정 중 오류가 발생했습니다.' });
    }
});

// 백신 삭제
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const vaccine = await VaccineType.findByPk(id);
        if (!vaccine) {
            return res.status(404).json({ error: '백신을 찾을 수 없습니다.' });
        }

        await vaccine.destroy();
        res.json({ message: '백신이 삭제되었습니다.' });
    } catch (error) {
        console.error('백신 삭제 오류:', error);
        res.status(500).json({ error: '백신 삭제 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
